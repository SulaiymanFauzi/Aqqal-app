from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types as genai_types

from api_tools import execute_tool
from models import ChatMessage, ChatRequest, ChatResponse
from settings import (
    ALLOW_ALL_ORIGINS,
    ALLOWED_ORIGINS,
    DEFAULT_MAX_OUTPUT_TOKENS,
    DEFAULT_MODEL,
    DEFAULT_SYSTEM_PROMPT,
    GOOGLE_API_KEY,
    MAX_OUTPUT_TOKENS_CAP,
    PORT,
    TOOL_USAGE_DIRECTIVE,
)
from utils import (
    build_tools_instruction,
    extract_function_call_from_response,
    get_function_declaration_models,
    get_tool_names,
)

app = FastAPI(title="Aqqal FastAPI Backend", version="0.1.0")

# CORS setup
if ALLOW_ALL_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
# ----- Utilities -----

def _split_system_and_convert_contents(messages: List[ChatMessage]):
    system_parts: List[str] = []
    contents = []

    for m in messages:
        if m.role == "system":
            if m.content and m.content.strip():
                system_parts.append(m.content.strip())
            continue

        role = "user" if m.role == "user" else "model"  # assistant -> model
        contents.append({
            "role": role,
            "parts": [
                {"text": m.content}
            ],
        })

    system_instruction = "\n\n".join(system_parts) if system_parts else None
    return system_instruction, contents


def _extract_text_from_genai2_response(resp) -> Optional[str]:
    """Safely extract text from google-genai response without triggering quick accessor errors."""
    # Try quick accessor but guard exceptions
    try:
        t = getattr(resp, "text", None)
        if t:
            return t
    except Exception:
        pass

    # Fallback to candidates -> content -> parts
    try:
        candidates = getattr(resp, "candidates", None)
        if not candidates:
            return None
        first = candidates[0]
        content = getattr(first, "content", None)
        parts = getattr(content, "parts", None) if content is not None else None
        if not parts:
            return None
        buf: List[str] = []
        for p in parts:
            try:
                pt = getattr(p, "text", None)
            except Exception:
                pt = None
            if pt:
                buf.append(pt)
            elif isinstance(p, dict):
                pt = p.get("text")
                if pt:
                    buf.append(pt)
        return "".join(buf) if buf else None
    except Exception:
        return None


# ----- Routes -----

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {
        "name": "Aqqal FastAPI Backend",
        "version": "0.1.0",
        "endpoints": ["GET /health", "POST /chat"],
        "default_model": DEFAULT_MODEL,
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest):
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY is not set. Provide it in backend/.env.")

    client = genai.Client(api_key=GOOGLE_API_KEY)
    model_name = body.model or DEFAULT_MODEL

    # Extract system instruction from messages unless explicitly provided
    extracted_system_instruction, contents = _split_system_and_convert_contents(body.messages)
    effective_base_system_instruction = (
        body.system_instruction or extracted_system_instruction or DEFAULT_SYSTEM_PROMPT
    )
    if effective_base_system_instruction:
        system_instruction = f"{effective_base_system_instruction}\n\n{TOOL_USAGE_DIRECTIVE}"
    else:
        system_instruction = TOOL_USAGE_DIRECTIVE
    # Effective output token budget (request overrides env default)
    effective_max_output_tokens = body.max_output_tokens or DEFAULT_MAX_OUTPUT_TOKENS

    if not contents:
        raise HTTPException(status_code=400, detail="No user/assistant messages provided.")

    try:
        tools_used: List[str] = []
        use_search = body.use_search if body.use_search is not None else False

        # Always build tool-aware system instruction
        tool_names = get_tool_names()
        announced_tool_names = list(tool_names)
        if use_search:
            announced_tool_names.append("google_search")
        tool_si = build_tools_instruction(announced_tool_names)
        si_for_tools = (
            f"{system_instruction}\n\n{tool_si}" if system_instruction else tool_si
        )

        # Assemble tool entries (function declarations + optional Google Search)
        function_declarations = get_function_declaration_models()
        tool_entries: List[genai_types.Tool] = []
        if function_declarations:
            tool_entries.append(genai_types.Tool(function_declarations=function_declarations))
        if use_search:
            tool_entries.append(genai_types.Tool(google_search=genai_types.GoogleSearch()))

        cfg_kwargs = {
            "temperature": body.temperature,
            "max_output_tokens": effective_max_output_tokens,
            "system_instruction": si_for_tools,
            "tools": tool_entries or None,
        }
        try:
            generation_config = genai_types.GenerateContentConfig(
                **{k: v for k, v in cfg_kwargs.items() if v is not None}
            )
        except Exception:
            fallback_kwargs = {"system_instruction": si_for_tools}
            if tool_entries:
                fallback_kwargs["tools"] = tool_entries
            generation_config = genai_types.GenerateContentConfig(**fallback_kwargs)

        result = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=generation_config,
        )

        def _extract_text_from_genai1_response(resp) -> Optional[str]:
            # Attempt quick accessor but guard exceptions
            try:
                t = getattr(resp, "text", None)
                if t:
                    return t
            except Exception:
                pass
            # Fallback to candidates -> content -> parts traversal
            try:
                candidates = getattr(resp, "candidates", None)
                if not candidates:
                    return None
                first = candidates[0]
                content = getattr(first, "content", None)
                parts = getattr(content, "parts", None) if content is not None else None
                if not parts:
                    return None
                buf: List[str] = []
                for p in parts:
                    try:
                        pt = getattr(p, "text", None)
                    except Exception:
                        pt = None
                    if pt:
                        buf.append(pt)
                    elif isinstance(p, dict):
                        pt = p.get("text")
                        if pt:
                            buf.append(pt)
                return "".join(buf) if buf else None
            except Exception:
                return None

        def _get_genai1_finish_reason(resp) -> Optional[str]:
            try:
                candidates = getattr(resp, "candidates", None)
                if not candidates:
                    return None
                first = candidates[0]
                fr = getattr(first, "finish_reason", None)
                if fr is None and isinstance(first, dict):
                    fr = first.get("finish_reason") or first.get("finishReason")
                return str(fr) if fr is not None else None
            except Exception:
                return None

        text = _extract_text_from_genai1_response(result)

        # Try function call if requested by the model
        function_call = extract_function_call_from_response(result)
        if function_call:
            name, arguments, _ = function_call
            if isinstance(name, str) and (not tool_names or name in tool_names):
                try:
                    print(f"[tools] calling name={name} args={arguments}")
                    tool_result = await execute_tool(name, arguments or {})
                except Exception as _:
                    tool_result = {"ok": False, "error": "Tool execution failed"}
                finally:
                    try:
                        ok = tool_result.get("ok") if isinstance(tool_result, dict) else None
                        status = tool_result.get("status") if isinstance(tool_result, dict) else None
                        print(f"[tools] result name={name} ok={ok} status={status}")
                    except Exception:
                        pass

                tools_used.append(name)

                # Provide tool response back to the model
                contents_with_tool = contents + [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "function_response": {
                                    "name": name,
                                    "response": tool_result,
                                }
                            }
                        ],
                    }
                ]
                result2 = client.models.generate_content(
                    model=model_name,
                    contents=contents_with_tool,
                    config=generation_config,
                )
                text2 = _extract_text_from_genai1_response(result2)
                if text2:
                    text = text2

        if not text:
            fr = _get_genai1_finish_reason(result)
            if fr is not None:
                fr_str = str(fr)
                if fr_str in ("2", "MAX_TOKENS", "FinishReason.MAX_TOKENS"):
                    new_tokens = min(
                        max(effective_max_output_tokens * 2, effective_max_output_tokens + 512),
                        MAX_OUTPUT_TOKENS_CAP,
                    )
                    if new_tokens > effective_max_output_tokens:
                        try:
                            retry_kwargs = {
                                "temperature": body.temperature,
                                "max_output_tokens": new_tokens,
                                "system_instruction": si_for_tools,
                                "tools": tool_entries or None,
                            }
                            generation_config_retry = genai_types.GenerateContentConfig(
                                **{k: v for k, v in retry_kwargs.items() if v is not None}
                            )
                        except Exception:
                            fallback_retry_kwargs = {"system_instruction": si_for_tools}
                            if tool_entries:
                                fallback_retry_kwargs["tools"] = tool_entries
                            generation_config_retry = genai_types.GenerateContentConfig(
                                **fallback_retry_kwargs
                            )
                        try:
                            result_retry = client.models.generate_content(
                                model=model_name,
                                contents=contents,
                                config=generation_config_retry,
                            )
                            text = _extract_text_from_genai1_response(result_retry)
                        except Exception:
                            text = None
                if not text:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Model returned no text. finish_reason={fr_str}. Try increasing max_output_tokens or adjusting prompt.",
                    )

        if not text:
            raise HTTPException(status_code=502, detail="Model returned no text response.")

        return ChatResponse(model=model_name, text=text, tools_used=tools_used or None)
    except HTTPException as http_exc:
        # Re-raise HTTPExceptions so specific status codes (e.g., 4xx/5xx) are preserved
        raise http_exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini error: {e}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
