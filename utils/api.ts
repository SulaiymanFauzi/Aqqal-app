import { Platform } from 'react-native';
import type { Message } from '@/components/chat/types';

// Configure the backend base URL
// Preferred: set EXPO_PUBLIC_API_BASE_URL in your env (e.g., http://192.168.x.y:8000)
const ENV_BASE = process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined;
const DEFAULT_BASE = Platform.select({
  android: 'http://10.0.2.2:8000', // Android emulator -> host
  default: 'http://localhost:8000', // iOS simulator / web
});

export const API_BASE_URL = ENV_BASE || DEFAULT_BASE!;

export type ChatOptions = {
  model?: string;
  temperature?: number;
  max_output_tokens?: number;
  system_instruction?: string;
  use_search?: boolean;
  use_tools?: boolean;
};

export type ChatResponse = {
  model: string;
  text: string;
};

export async function chat(messages: Message[], opts: ChatOptions = {}): Promise<ChatResponse> {
  // Transform to backend schema (drop id/createdAt)
  const payload = {
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    use_tools: opts.use_tools ?? true,
    ...opts,
  };

  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function defineTerm(term: string): Promise<string> {
  // Call backend directly with minimal message shape to avoid strict Message typing
  const payload = {
    messages: [
      {
        role: 'system',
        content:
          'You are an expert lexicographer. Provide a concise, plain-text definition (1–2 sentences, <80 words). Include brief etymology if relevant. Avoid markdown or lists.',
      },
      { role: 'user', content: `Define: ${term}` },
    ],
    temperature: 0.2,
    max_output_tokens: 256,
    use_search: false,
  };

  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend error ${res.status}: ${text}`);
  }
  const data: ChatResponse = await res.json();
  return (data.text || '').trim();
}
