import os
import re
import inspect
from typing import Any, Dict, List, Optional, Tuple, Union, Callable

import httpx

# Base URLs and credentials from environment (with safe defaults)
AQQAL_API_BASE = os.getenv("AQQAL_API_BASE", "https://api.aqqal.com")
QURAN_API_BASE = os.getenv("QURAN_API_BASE", "https://api.quran.com/api/v4")
JSDELIVR_BASE = os.getenv("JSDELIVR_BASE", "https://cdn.jsdelivr.net")
AQQAL_API_KEY = os.getenv("AQQAL_API_KEY")
AQQAL_API_KEY_HEADER = os.getenv("AQQAL_API_KEY_HEADER", "Authorization")
AQQAL_API_KEY_PREFIX = os.getenv("AQQAL_API_KEY_PREFIX", "Bearer")

# Aqqal semanticSearch credentials
AQQAL_SEMANTIC_APIKEY = os.getenv("AQQAL_SEMANTIC_APIKEY")
AQQAL_SEMANTIC_SERVICE_ACCOUNT = os.getenv("AQQAL_SEMANTIC_SERVICE_ACCOUNT", "aqqal")

# Timeouts
DEFAULT_TIMEOUT = float(os.getenv("API_HTTP_TIMEOUT", "15"))


# ------------- Internal HTTP helpers -------------
async def _request_json(
    method: str,
    url: str,
    params: Optional[Dict[str, Any]] = None,
    json_body: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
) -> Union[Dict[str, Any], List[Any]]:
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT, follow_redirects=True) as client:
        resp = await client.request(method, url, params=params, json=json_body, headers=headers)
        resp.raise_for_status()
        return resp.json()


def _format_http_error(e: Exception) -> Dict[str, Any]:
    status = getattr(getattr(e, "response", None), "status_code", None)
    text: Optional[str] = None
    try:
        if hasattr(e, "response") and getattr(e, "response") is not None:
            text = e.response.text
    except Exception:
        text = None
    return {
        "ok": False,
        "error": str(e),
        "status": status,
        "response_text": text,
    }


# ------------- Argument normalization helpers -------------

_CAMEL_TO_SNAKE_RE = re.compile(r"(?<!^)(?=[A-Z])")


def _camel_to_snake(name: str) -> str:
    return _CAMEL_TO_SNAKE_RE.sub("_", name).lower()


def _normalize_arguments(fn: Callable[..., Any], args: Dict[str, Any]) -> Dict[str, Any]:
    if not args:
        return {}
    try:
        params = inspect.signature(fn).parameters
    except (TypeError, ValueError):
        # Builtins or C extensions might not expose a signature; fall back to original args
        return args

    normalized: Dict[str, Any] = {}
    for key, value in args.items():
        if key in params and key not in normalized:
            normalized[key] = value
            continue

        snake_key = _camel_to_snake(key)
        if snake_key in params and snake_key not in normalized:
            normalized[snake_key] = value
            continue

        # Preserve original key if no better match found
        if key not in normalized:
            normalized[key] = value

    return normalized


# ------------- Aqqal API wrappers -------------
def _aqqal_headers() -> Optional[Dict[str, str]]:
    if not AQQAL_API_KEY:
        return None

    header_name = AQQAL_API_KEY_HEADER.strip() if AQQAL_API_KEY_HEADER else "Authorization"
    value = AQQAL_API_KEY.strip()
    prefix = AQQAL_API_KEY_PREFIX.strip() if AQQAL_API_KEY_PREFIX else ""
    if prefix:
        value = f"{prefix} {value}"
    return {header_name: value}


async def search_narrators(limit: Optional[int] = 5, name_en: Optional[str] = None) -> Any:
    url = f"{AQQAL_API_BASE}/library/hadiths/narrators/search"
    params: Dict[str, Any] = {}
    if limit is not None:
        params["limit"] = int(limit)
    body: Dict[str, Any] = {}
    if name_en:
        body["name_en"] = name_en
    return await _request_json("POST", url, params=params, json_body=body, headers=_aqqal_headers())


async def get_hadith_by_id(id: int, include_chain: Optional[bool] = None) -> Any:
    url = f"{AQQAL_API_BASE}/library/hadiths/{int(id)}"
    params: Dict[str, Any] = {}
    if include_chain is not None:
        params["include_chain"] = bool(include_chain)
    return await _request_json("GET", url, params=params, headers=_aqqal_headers())


async def search_hadith(
    include_chains: Optional[bool] = False,
    text_en: Optional[str] = None,
    top_narrator: Optional[str] = None,
    book: Optional[str] = None,
) -> Any:
    url = f"{AQQAL_API_BASE}/library/hadiths/search"
    params: Dict[str, Any] = {}
    if include_chains is not None:
        params["include_chains"] = bool(include_chains)
    body: Dict[str, Any] = {}
    if text_en:
        body["text_en"] = text_en
    if top_narrator:
        body["top_narrator"] = top_narrator
    if book:
        body["book"] = book
    return await _request_json("POST", url, params=params, json_body=body, headers=_aqqal_headers())


# ------------- Quran.com API wrappers -------------
async def search_ayah(q: str, language: str) -> Any:
    url = f"{QURAN_API_BASE}/search"
    params = {"q": q, "language": language}
    return await _request_json("GET", url, params=params)


async def get_verse_key_arabic(
    chapter_number: Optional[str] = None,
    juz_number: Optional[str] = None,
    page_number: Optional[str] = None,
    verse_key: Optional[str] = None,
) -> Any:
    url = f"{QURAN_API_BASE}/quran/verses/uthmani"
    params: Dict[str, Any] = {}
    if chapter_number:
        params["chapter_number"] = chapter_number
    if juz_number:
        params["juz_number"] = juz_number
    if page_number:
        params["page_number"] = page_number
    if verse_key:
        params["verse_key"] = verse_key
    if not params:
        raise ValueError("Provide at least one of chapter_number, juz_number, page_number, or verse_key.")
    return await _request_json("GET", url, params=params)


async def get_translations(language: Optional[str] = None) -> Any:
    url = f"{QURAN_API_BASE}/resources/translations"
    params: Dict[str, Any] = {}
    if language:
        params["language"] = language
    return await _request_json("GET", url, params=params)


async def get_single_translation(translation_id: int, verse_key: str) -> Any:
    url = f"{QURAN_API_BASE}/quran/translations/{int(translation_id)}"
    params = {"verse_key": verse_key}
    return await _request_json("GET", url, params=params)


# ------------- JSDelivr Tafsir & Hadith wrappers -------------
# Tafsir (spa5k/tafsir_api)
async def list_tafsir_editions(tafsir_version: str = "main") -> Any:
    url = f"{JSDELIVR_BASE}/gh/spa5k/tafsir_api@{tafsir_version}/tafsir/editions.json"
    return await _request_json("GET", url)


async def get_single_ayah(
    tafsir_version: str,
    edition_slug: str,
    surah_number: int,
    ayah_number: int,
) -> Any:
    url = (
        f"{JSDELIVR_BASE}/gh/spa5k/tafsir_api@{tafsir_version}/tafsir/{edition_slug}/{int(surah_number)}/{int(ayah_number)}.json"
    )
    return await _request_json("GET", url)

# ------------- Tool Declarations (JSON Schema) -------------
# These declarations are suitable for google-generativeai tools (as JSON). Consumers can pass:
# tools=[{"function_declarations": get_function_declarations_json()}]

_FUNCTION_DECLARATIONS: List[Dict[str, Any]] = [
    # Aqqal
    {
        "name": "searchNarrators",
        "description": "Search narrators. Use this to find narrators by English name.",
        "parameters": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Number of results.", "default": 5},
                "name_en": {"type": "string", "description": "Narrator English name (optional)."},
            },
        },
    },
    {
        "name": "getHadithById",
        "description": "Retrieve a Hadith by ID, optionally including its chain.",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "include_chain": {"type": "boolean"},
            },
            "required": ["id"],
        },
    },
    {
        "name": "searchHadith",
        "description": "Exact keyword search of Hadiths. If semantic results are insufficient, use this.",
        "parameters": {
            "type": "object",
            "properties": {
                "include_chains": {"type": "boolean", "default": False},
                "text_en": {"type": "string"},
                "top_narrator": {"type": "string"},
                "book": {"type": "string"},
            },
        },
    },
    # Quran.com
    {
        "name": "SearchAyah",
        "description": "Search Quran verses by query and language.",
        "parameters": {
            "type": "object",
            "properties": {
                "q": {"type": "string"},
                "language": {"type": "string"},
            },
            "required": ["q", "language"],
        },
    },
    {
        "name": "GetVerseKeyArabic",
        "description": "Get Arabic Quran verse(s) via chapter_number, juz_number, page_number, or a specific verse_key (e.g., 1:5).",
        "parameters": {
            "type": "object",
            "properties": {
                "chapter_number": {"type": "string"},
                "juz_number": {"type": "string"},
                "page_number": {"type": "string"},
                "verse_key": {"type": "string"},
            },
        },
    },
    {
        "name": "GetTranslations",
        "description": "List available translations, optionally filtered by language.",
        "parameters": {
            "type": "object",
            "properties": {
                "language": {"type": "string"},
            },
        },
    },
    {
        "name": "GetSingleTranslation",
        "description": "Get a single translation for a specific verse (verse_key) by translation_id.",
        "parameters": {
            "type": "object",
            "properties": {
                "translation_id": {"type": "integer"},
                "verse_key": {"type": "string"},
            },
            "required": ["translation_id", "verse_key"],
        },
    },
    # Tafsir via JSDelivr
    {
        "name": "listEditions",
        "description": "List all available Tafsir editions (spa5k/tafsir_api).",
        "parameters": {
            "type": "object",
            "properties": {
                "tafsirVersion": {"type": "string", "description": "Branch/commit (e.g., main)", "default": "main"},
            },
        },
    },
    {
        "name": "getSingleAyah",
        "description": "Fetch a single ayah for a specific Tafsir edition.",
        "parameters": {
            "type": "object",
            "properties": {
                "tafsirVersion": {"type": "string", "default": "main"},
                "editionSlug": {"type": "string"},
                "surahNumber": {"type": "integer"},
                "ayahNumber": {"type": "integer"},
            },
            "required": ["tafsirVersion", "editionSlug", "surahNumber", "ayahNumber"],
        },
    },
]


def get_function_declarations_json() -> List[Dict[str, Any]]:
    """Return the function declarations (JSON Schema) for tool registration."""
    return _FUNCTION_DECLARATIONS


# ------------- Dispatcher -------------
async def execute_tool(name: str, arguments: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Execute a tool function by name with provided arguments.
    Returns a structured dict: { ok: bool, data?: Any, error?: str, status?: int }
    """
    arguments = arguments or {}

    async def _call(fn: Callable[..., Any], args: Dict[str, Any]) -> Dict[str, Any]:
        try:
            normalized_args = _normalize_arguments(fn, args)
            data = await fn(**normalized_args)
            return {"ok": True, "data": data}
        except Exception as e:
            return _format_http_error(e)

    # Map operationId -> wrapper
    mapping: Dict[str, Callable[..., Any]] = {
        # Aqqal
        "searchNarrators": search_narrators,
        "getHadithById": get_hadith_by_id,
        "searchHadith": search_hadith,
        # Quran.com
        "SearchAyah": search_ayah,
        "GetVerseKeyArabic": get_verse_key_arabic,
        "GetTranslations": get_translations,
        "GetSingleTranslation": get_single_translation,
        # Tafsir (JSDelivr)
        "listEditions": list_tafsir_editions,
        "getSingleAyah": get_single_ayah,
    }

    fn = mapping.get(name)
    if not fn:
        return {"ok": False, "error": f"Unknown tool: {name}"}

    return await _call(fn, arguments)
