# Aqqal FastAPI Backend (Gemini Chat)

A lightweight FastAPI backend that exposes a `/chat` endpoint to converse with Google Gemini (default: `gemini-2.5-flash`).

## Prerequisites
- Python 3.10+
- A Google AI Studio API key (`GOOGLE_API_KEY`)

## Setup
1. Create a virtual environment and install dependencies:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Create your environment file:
   ```bash
   cp .env.example .env
   # edit .env to set GOOGLE_API_KEY and any options you want
   ```

## Run
```bash
uvicorn main:app --reload --port ${PORT:-8000}
```
- Server runs at `http://localhost:8000`
- Interactive docs: `http://localhost:8000/docs`

If you just pulled changes, reinstall requirements:
```bash
pip install -r requirements.txt
```

## Endpoints
- `GET /health` → `{ "status": "ok" }`
- `POST /chat` → `{ model: string, text: string }`

### POST /chat
Request body:
```json
{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "model": "gemini-2.5-flash",
  "temperature": 0.7,
  "max_output_tokens": 1024
}
```
- `role` can be `system`, `user`, or `assistant`.
- You may omit `model` to use the default from `.env` (`GEMINI_MODEL`).

#### Enable Google Search grounding
Set `use_search: true` to allow the model to call Google Search via tools for fresher answers and grounding.

Request body example:
```json
{
  "messages": [
    { "role": "system", "content": "Be factual. Cite current info succinctly." },
    { "role": "user", "content": "Who won the euro 2024?" }
  ],
  "use_search": true,
  "model": "gemini-2.5-flash"
}
```

Response example:
```json
{
  "model": "gemini-2.5-flash",
  "text": "Hi there! How can I help you today?"
}
```

### curl example
```bash
curl -X POST http://localhost:8000/chat \
  -H 'Content-Type: application/json' \
  -d '{
        "messages": [
          {"role": "system", "content": "You are concise."},
          {"role": "user", "content": "Explain FastAPI in 1 sentence."}
        ],
        "model": "gemini-2.5-flash",
        "temperature": 0.4
      }'
```

With Google Search grounding:
```bash
curl -X POST http://localhost:8000/chat \
  -H 'Content-Type: application/json' \
  -d '{
        "messages": [
          {"role": "system", "content": "Be factual and current."},
          {"role": "user", "content": "Who won the Euro 2024 final?"}
        ],
        "use_search": true,
        "model": "gemini-2.5-flash"
      }'
```

## Environment variables
- `GOOGLE_API_KEY` (required for `/chat`)
- `GEMINI_MODEL` default model (e.g., `gemini-2.5-flash`)
- `PORT` server port (default `8000`)
- `ALLOWED_ORIGINS` comma-separated origins; leave empty to allow all in dev

Note: Keep secrets in `.env` (which is gitignored). Do not put real keys in `.env.example`.

## CORS
By default in development, all origins are allowed. Set `ALLOWED_ORIGINS` in `.env` for production.

## Notes on Models
- If the provided model name is unavailable in your account or region, the API will return an error. Update `GEMINI_MODEL` or the request `model` accordingly.

## Using from the Expo app
Basic example fetch from React/Expo:
```ts
const BASE_URL = 'http://localhost:8000'; // replace with your LAN IP on device

async function sendChat(messages) {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

Tip: When testing on a physical device, use your machine's LAN IP (e.g., `http://192.168.x.y:8000`) and ensure both are on the same network.

## API Tools (Function Calling)
A new module `backend/api_tools.py` wraps external APIs so an LLM can use them via tool/function calls.

- **Location**: `backend/api_tools.py`
- **Provides**:
  - `get_function_declarations_json()` → JSON Schemas describing available functions (operationIds) you can register with your model.
  - `execute_tool(name, arguments)` → Async dispatcher to call a tool by its `operationId`.
  - Async wrappers for:
    - Aqqal API: `searchNarrators`, `getHadithById`, `searchHadith`, `semanticSearch`
    - Quran.com API: `SearchAyah`, `GetVerseKeyArabic`, `GetTranslations`, `GetSingleTranslation`
    - JSDelivr Tafsir: `listEditions`, `getSurahAyahs`, `getSingleAyah`, `getEmptyAyahs`
    - JSDelivr Hadith: `listHadithEditions`, `getHadithEdition`, `getSingleHadith`, `getHadithSection`, `getHadithInfo`

### Environment
Set these in `backend/.env` (see `.env.example`):
- **AQQAL_API_BASE** (default `https://api.aqqal.com`)
- **QURAN_API_BASE** (default `https://api.quran.com/api/v4`)
- **JSDELIVR_BASE** (default `https://cdn.jsdelivr.net`)
- **AQQAL_SEMANTIC_APIKEY** (required for `semanticSearch`)
- **AQQAL_SEMANTIC_SERVICE_ACCOUNT** (default `aqqal`)
- **API_HTTP_TIMEOUT** (default `15` seconds)

### Usage pattern
1. Register function declarations with your LLM as tools (per your SDK's function-calling interface).
2. When the model emits a tool/function call with `{ name, arguments }`, pass them to:
   ```py
   from api_tools import execute_tool
   result = await execute_tool(name, arguments)
   # result = { ok: bool, data?: Any, error?: str, status?: int }
   ```
3. Return the `result` (or a summarized form) back to the model as the tool response.

Note: The current `/chat` endpoint does not perform function calling automatically. If you want the backend to mediate function calls, extend `POST /chat` to:
- register tools with the model
- parse tool call responses from the model
- dispatch via `execute_tool()` and feed results back into the conversation
