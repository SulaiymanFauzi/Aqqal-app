import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from google.genai import types as genai_types

from api_tools import get_function_declarations_json


_FUNCTION_DECLARATIONS_CACHE: Optional[List[genai_types.FunctionDeclaration]] = None
_TOP_SECRET_PROMPT: Optional[str] = None


def get_top_secret_prompt() -> str:
    # Disable caching in development - always reload the prompt file
    # global _TOP_SECRET_PROMPT
    # if _TOP_SECRET_PROMPT is not None:
    #     return _TOP_SECRET_PROMPT

    try:
        prompt_path = Path(__file__).with_name("top-secret-prompt.txt")
        prompt = prompt_path.read_text(encoding="utf-8").strip()
        # Debug: print first 200 chars to verify it's loading
        print(f"[DEBUG] Loaded prompt (first 200 chars): {prompt[:200]}")
    except Exception as e:
        print(f"[ERROR] Failed to load prompt: {e}")
        prompt = ""

    return prompt


def get_function_declaration_models() -> List[genai_types.FunctionDeclaration]:
    global _FUNCTION_DECLARATIONS_CACHE
    if _FUNCTION_DECLARATIONS_CACHE is not None:
        return _FUNCTION_DECLARATIONS_CACHE

    declarations: List[genai_types.FunctionDeclaration] = []
    try:
        raw_decls = get_function_declarations_json()
    except Exception:
        raw_decls = []

    for decl in raw_decls:
        if not isinstance(decl, dict):
            continue
        try:
            declarations.append(genai_types.FunctionDeclaration(**decl))
        except Exception:
            continue

    _FUNCTION_DECLARATIONS_CACHE = declarations
    return _FUNCTION_DECLARATIONS_CACHE


def get_tool_names() -> List[str]:
    try:
        declarations = get_function_declarations_json()
        names = [d.get("name") for d in declarations if isinstance(d, dict) and d.get("name")]
        return [n for n in names if isinstance(n, str)]
    except Exception:
        return []


def build_tools_instruction(tool_names: List[str]) -> str:
    prefix = get_top_secret_prompt()

    if not tool_names:
        instruction = (
            "You MAY return a single fenced JSON object to call a tool with schema: "
            '{"name": string, "arguments": object}. If no tool is needed, answer normally.'
        )
    else:
        names_csv = ", ".join(tool_names)
        tool_count = len(tool_names)
        instruction = (
            f"You have access to {tool_count} external tools containing canonical Aqqal data ({names_csv}). These tools are your first priority. "
            "Always check whether one or more tool calls are required before you answer. "
            "If the user's request depends on factual Tafsir/Hadith/Quran content, you MUST call the appropriate tool(s) instead of guessing. "
            "Return a single fenced JSON object exactly in this schema and nothing else: \n"
            "```json\n{\n  \"name\": \"<one of: %s>\",\n  \"arguments\": { /* key-value args */ }\n}\n```\n"
            "If and only if no tool is applicable, answer succinctly. After a tool result is provided, incorporate it into the final answer using only supported facts."
        ) % names_csv

    if prefix:
        return f"{prefix}\n\n{instruction}"
    return instruction


def extract_function_call_from_response(resp: Any) -> Optional[Tuple[str, Dict[str, Any], Optional[Dict[str, Any]]]]:
    try:
        candidates = getattr(resp, "candidates", None)
        if not candidates:
            return None
        first = candidates[0]
        content = getattr(first, "content", None)
        if content is None:
            return None
        parts = getattr(content, "parts", None)
        if not parts:
            return None
        for part in parts:
            function_call = getattr(part, "function_call", None)
            if function_call is None and isinstance(part, dict):
                function_call = part.get("function_call")
            if not function_call:
                continue

            name = getattr(function_call, "name", None)
            if name is None and isinstance(function_call, dict):
                name = function_call.get("name")

            raw_args = getattr(function_call, "args", None)
            if raw_args is None and isinstance(function_call, dict):
                raw_args = function_call.get("args")

            if hasattr(raw_args, "to_json_dict"):
                arguments = raw_args.to_json_dict()
            elif hasattr(raw_args, "items"):
                arguments = dict(raw_args)
            else:
                arguments = raw_args

            if hasattr(content, "model_dump"):
                content_dict = content.model_dump(exclude_none=True)
            elif isinstance(content, dict):
                content_dict = content
            else:
                content_dict = None

            return name, arguments or {}, content_dict
        return None
    except Exception:
        return None


def extract_tool_call_from_text(text: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    if not text:
        return None
    fenced = re.search(r"```json\s*(\{[\s\S]*?\})\s*```", text)
    candidate = fenced.group(1) if fenced else None
    if candidate is None:
        brace_start = text.find("{")
        brace_end = text.rfind("}")
        if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
            candidate = text[brace_start : brace_end + 1]
    if not candidate:
        return None
    try:
        obj = json.loads(candidate)
        if not isinstance(obj, dict):
            return None
        call = obj["tool_call"] if "tool_call" in obj and isinstance(obj["tool_call"], dict) else obj
        name = call.get("name")
        arguments = call.get("arguments") or {}
        if isinstance(name, str) and isinstance(arguments, dict):
            return name, arguments
        return None
    except Exception:
        return None
