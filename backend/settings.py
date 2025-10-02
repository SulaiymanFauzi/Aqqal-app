import os
from typing import List, Optional

from dotenv import load_dotenv


load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
PORT = int(os.getenv("PORT", "8000"))
DEFAULT_MAX_OUTPUT_TOKENS = int(os.getenv("DEFAULT_MAX_OUTPUT_TOKENS", "2048"))
MAX_OUTPUT_TOKENS_CAP = int(os.getenv("MAX_OUTPUT_TOKENS_CAP", "8192"))
TOOL_USAGE_DIRECTIVE = (
    "Always evaluate and invoke the available registered tools to ground your responses before composing any reply."
)

_ALLOWS_RAW = os.getenv("ALLOWED_ORIGINS", "").strip()
ALLOWED_ORIGINS: List[str] = [origin.strip() for origin in _ALLOWS_RAW.split(",") if origin.strip()]
ALLOW_ALL_ORIGINS = len(ALLOWED_ORIGINS) == 0

SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT")
SYSTEM_PROMPT_PATH = os.getenv("SYSTEM_PROMPT_PATH")


def _load_default_system_prompt() -> Optional[str]:
    if SYSTEM_PROMPT_PATH and os.path.exists(SYSTEM_PROMPT_PATH):
        try:
            with open(SYSTEM_PROMPT_PATH, "r", encoding="utf-8") as file:
                content = file.read().strip()
                if content:
                    return content
        except Exception:
            return None
    if SYSTEM_PROMPT:
        prompt = SYSTEM_PROMPT.strip()
        return prompt or None
    return None


DEFAULT_SYSTEM_PROMPT: Optional[str] = _load_default_system_prompt()
