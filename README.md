# Aqqal App

Full-stack Expo + FastAPI experience designed around the Aqqal chat assistant.

## Project Structure
- `app/` – Expo Router application (React Native / web)
- `components/` – shared UI (chat components documented in `docs/components-chatmessage.md`)
- `constants/` – theme colors, fonts, etc.
- `utils/` – frontend helper APIs and storage wrappers
- `backend/` – FastAPI service powering chat completions and optional tool calls (see `docs/backend-how-it-works.md`)
- `docs/` – additional architecture notes

## Prerequisites
- Node.js 18+
- Yarn 1.x (this repo pins `yarn@1.22.22`)
- Python 3.10+
- Google AI Studio / Gemini API key
- Xcode (with Command Line Tools) for running the iOS simulator

## 1. Clone & Install
```bash
# frontend deps
yarn install

# backend deps
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2. Environment Variables
1. Copy the sample file and fill in secrets (keep `.env` out of Git):
   ```bash
   cd backend
   cp .env.example .env
   ```
2. Set the following in `backend/.env`:
   - `GOOGLE_API_KEY`
   - `GEMINI_MODEL` (defaults to `gemini-2.5-flash`)
   - `PORT` (default `8000`)
   - `ALLOWED_ORIGINS` (comma-separated list for production)
   - `SYSTEM_PROMPT_PATH` (defaults to `./top-secret-prompt.txt`)
   - Optional tool credentials (see `.env.example`)

> **Note:** `backend/.gitignore` already excludes `.env`, so secrets stay local.

## 3. Run the Backend
```bash
cd backend
source .venv/bin/activate  # or use your shell equivalent
uvicorn main:app --reload --port 8000
```
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

For Android emulators use `http://10.0.2.2:8000`; for physical devices, use your machine's LAN IP.

## 4. Run the Expo App
```bash
# from repo root
yarn start

# or launch the iOS simulator directly
npm run ios
```
- Press `i` for iOS Simulator, `a` for Android, `w` for web when using the Expo CLI prompt.
- `npm run ios` compiles and opens the iOS simulator in one step once Xcode is installed.
- Update `API_BASE_URL` in `utils/api.ts` if the backend runs on a different host.

### Chat UI Highlights
- Grey-highlighted terms are interactive: tap/click to fetch a quick definition from the backend LLM (`utils/api.defineTerm`).
- Styling and behavior are described in `docs/components-chatmessage.md`.

## 5. Testing & Linting
- Jest component tests: `yarn test`
- Expo TypeScript check: `yarn tsc`

## 6. Helpful Scripts
- Format with Prettier: `yarn prettier --check .`
- Clear Expo cache: `yarn expo start -c`

## 7. Deployment Notes
- Configure production CORS domains via `ALLOWED_ORIGINS`.
- Store secrets in a vault (never in Git).
- For server hosting, use `uvicorn` or `gunicorn` behind a reverse proxy (e.g., Nginx) and ensure HTTPS.
- Build mobile binaries with Expo EAS (`yarn expo build`) once the backend endpoint is accessible over HTTPS.

## Troubleshooting
- `500 GOOGLE_API_KEY is not set` → populate `backend/.env`.
- `Network request failed` in the app → check device-to-backend connectivity and CORS settings.
- Trailing whitespace warnings on commit → enable your editor's trim-on-save.

## Further Reading
- `docs/backend-how-it-works.md`
- `docs/utils-api.md`
- `docs/components-chatmessage.md`
