# Frontend API Utils (`utils/api.ts`)

Utilities for calling the FastAPI backend from the Expo app.

- **Location**: `utils/api.ts`
- **Exports**:
  - `API_BASE_URL`: resolved backend base URL
  - `chat(messages, opts?)` → `Promise<{ model, text }>`
  - `defineTerm(term)` → `Promise<string>`
- **Types**:
  - `ChatOptions`: `{ model?, temperature?, max_output_tokens?, system_instruction?, use_search? }`
  - `ChatResponse`: `{ model: string, text: string }`

## Base URL Resolution

```ts
const ENV_BASE = process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined;
const DEFAULT_BASE = Platform.select({
  android: 'http://10.0.2.2:8000', // Android emulator → host
  default: 'http://localhost:8000', // iOS simulator / web
});
export const API_BASE_URL = ENV_BASE || DEFAULT_BASE!;
```

- Prefer configuring `EXPO_PUBLIC_API_BASE_URL` (e.g., `http://192.168.x.y:8000`) when testing on a physical device.
- Defaults:
  - Android emulator → `http://10.0.2.2:8000`
  - iOS simulator / web → `http://localhost:8000`

## `chat(messages, opts?)`

Sends a conversation to the backend `/chat` endpoint.

- Input `messages` are of type `Message` from `components/chat/types.ts` but are transformed to the backend schema by stripping `id` and `createdAt`.
- `opts` is `ChatOptions`, forwarded to the backend:
  - `model` to override default Gemini model.
  - `temperature`
  - `max_output_tokens`
  - `system_instruction`
  - `use_search` to enable Google Search grounding on the backend.
- Errors: throws `Error("Backend error <status>: <text>")` if the HTTP response is not OK.

Example:

```ts
import { chat } from '@/utils/api';
import type { Message } from '@/components/chat/types';

const messages: Message[] = [
  { id: '1', role: 'system', content: 'You are concise.', createdAt: Date.now() },
  { id: '2', role: 'user', content: 'Explain FastAPI in one sentence.', createdAt: Date.now() },
];

const res = await chat(messages, { temperature: 0.4 });
console.log(res.model, res.text);
```

## `defineTerm(term)`

Fetches a concise definition (1–2 sentences) for a tapped term by calling the same `/chat` endpoint with a special system message.

- System instruction asks for a plain-text definition (no markdown/lists) and brief etymology if relevant.
- Returns the trimmed `text` field from the backend response.
- Used by `components/chat/ChatMessage.tsx` when a user taps a grey-highlighted term.

Example:

```ts
import { defineTerm } from '@/utils/api';

const meaning = await defineTerm('tafsir');
// e.g., "Exegesis or commentary on the Qur’an..."
```

## Notes & Tips

- Ensure the backend is running and reachable at `API_BASE_URL`.
- For physical devices, set `EXPO_PUBLIC_API_BASE_URL` to your machine’s LAN IP (e.g., `http://192.168.x.y:8000`) and keep both on the same network.
- The backend already retries once upon token-limit finishes; you can tune `max_output_tokens` via `opts` if needed.
