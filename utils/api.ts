import { Platform } from 'react-native';
import EventSource from 'react-native-sse';
import type { Message, StreamEvent } from '@/components/chat/types';
export type { StreamEvent } from '@/components/chat/types';

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
  thoughts?: string | null;
  stream_events?: StreamEvent[] | null;
};

export type ChatStreamHandlers = {
  onEvent?: (event: StreamEvent) => void;
  onFinal?: (response: ChatResponse) => void;
  onError?: (payload: { status: number; detail: string }) => void;
};

type SSEState = {
  buffer: string;
  finalResponse: ChatResponse | null;
  errorPayload?: { status: number; detail: string };
};

function parseSSEChunk(
  chunk: string,
  state: SSEState,
  handlers?: ChatStreamHandlers,
) {
  state.buffer += chunk;

  let newlineIndex: number;
  while ((newlineIndex = state.buffer.indexOf('\n\n')) !== -1) {
    const rawEvent = state.buffer.slice(0, newlineIndex);
    state.buffer = state.buffer.slice(newlineIndex + 2);

    if (!rawEvent.trim()) {
      continue;
    }

    const lines = rawEvent.split('\n');
    let eventName = 'message';
    let dataPayload = '';
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataPayload += line.slice(5).trim();
      }
    }

    if (!dataPayload) {
      continue;
    }

    try {
      const parsed = JSON.parse(dataPayload);
      if (eventName === 'chunk') {
        console.debug('[SSE] chunk event', parsed);
        handlers?.onEvent?.(parsed as StreamEvent);
      } else if (eventName === 'final') {
        const parsedFinal = parsed as ChatResponse;
        const normalizedFinal: ChatResponse = {
          ...parsedFinal,
          thoughts: parsedFinal.thoughts ?? undefined,
          stream_events: parsedFinal.stream_events ?? undefined,
        };
        console.debug('[SSE] final event received', normalizedFinal);
        state.finalResponse = normalizedFinal;
        handlers?.onFinal?.(normalizedFinal);
      } else if (eventName === 'error') {
        console.warn('[SSE] error event payload', parsed);
        state.errorPayload = parsed as { status: number; detail: string };
        handlers?.onError?.(parsed as { status: number; detail: string });
      }
    } catch (err) {
      console.warn('Failed to parse SSE message', err);
    }
  }
}

export async function chat(
  messages: Message[],
  opts: ChatOptions & { stream?: boolean; streamHandlers?: ChatStreamHandlers } = {},
): Promise<ChatResponse> {
  const { stream = false, streamHandlers, ...restOpts } = opts;

  const payload = {
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    use_tools: restOpts.use_tools ?? true,
    ...restOpts,
    stream,
  };

  if (stream && Platform.OS !== 'web') {
    return new Promise<ChatResponse>((resolve, reject) => {
      const eventSource = new (EventSource as any)(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        pollingInterval: 0,
        withCredentials: false,
      });

      let settled = false;

      const cleanup = () => {
        try {
          eventSource.close();
        } catch (err) {
          // ignore close issues
        }
        (eventSource as any).removeEventListener('chunk', handleChunk);
        (eventSource as any).removeEventListener('final', handleFinal);
        (eventSource as any).removeEventListener('error', handleError);
        (eventSource as any).removeEventListener('exception', handleError);
      };

      const handleChunk = (event: any) => {
        if (!event?.data) return;
        try {
          const parsed = JSON.parse(event.data) as StreamEvent;
          streamHandlers?.onEvent?.(parsed);
        } catch (err) {
          console.warn('Failed to parse chunk event', err);
        }
      };

      const handleFinal = (event: any) => {
        if (settled) return;
        if (!event?.data) {
          handleError({ message: 'Stream ended without final response.' });
          return;
        }
        try {
          const parsed = JSON.parse(event.data) as ChatResponse;
          const normalized: ChatResponse = {
            ...parsed,
            thoughts: parsed.thoughts ?? undefined,
            stream_events: parsed.stream_events ?? undefined,
          };
          streamHandlers?.onFinal?.(normalized);
          settled = true;
          cleanup();
          resolve(normalized);
        } catch (err) {
          handleError({ message: err instanceof Error ? err.message : String(err) });
        }
      };

      const handleError = (event: any) => {
        if (settled) {
          cleanup();
          return;
        }
        const detail = event?.message || event?.data || 'Stream connection error';
        streamHandlers?.onError?.({ status: 0, detail: String(detail) });
        settled = true;
        cleanup();
        reject(new Error(String(detail)));
      };

      (eventSource as any).addEventListener('chunk', handleChunk);
      (eventSource as any).addEventListener('final', handleFinal);
      (eventSource as any).addEventListener('error', handleError);
      (eventSource as any).addEventListener('exception', handleError);
    });
  }

  const controller = new AbortController();
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend error ${res.status}: ${text}`);
  }

  if (!stream) {
    const data: ChatResponse = await res.json();
    const normalized = {
      ...data,
      thoughts: data.thoughts ?? undefined,
      stream_events: data.stream_events ?? undefined,
    };
    streamHandlers?.onFinal?.(normalized);
    return normalized;
  }

  const supportsReadableStream = typeof res.body?.getReader === 'function';
  const sseState: SSEState = { buffer: '', finalResponse: null };

  if (supportsReadableStream && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          const flushChunk = decoder.decode();
          if (flushChunk) {
            console.debug('[SSE] flush chunk', flushChunk);
            parseSSEChunk(flushChunk, sseState, streamHandlers);
          }
          if (sseState.buffer.trim()) {
            console.debug('[SSE] parsing trailing buffer');
            parseSSEChunk('\n\n', sseState, streamHandlers);
          }
          break;
        }
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) {
            console.debug('[SSE] raw chunk', chunk);
            parseSSEChunk(chunk, sseState, streamHandlers);
          }
        }
      }
    } finally {
      controller.abort();
    }
  } else {
    // Fallback: environment (e.g., React Native) lacks ReadableStream support.
    const textPayload = await res.text();
    console.debug('[SSE] fallback payload', textPayload);
    parseSSEChunk(textPayload, sseState, streamHandlers);
    controller.abort();
  }

  if (!sseState.finalResponse) {
    if (sseState.errorPayload) {
      console.warn('[SSE] stream ended with error payload', sseState.errorPayload);
      throw new Error(sseState.errorPayload.detail || `Stream error ${sseState.errorPayload.status}`);
    }
    console.warn('[SSE] stream completed without final response', {
      buffered: sseState.buffer,
    });
    throw new Error('Stream ended without final response.');
  }
  return sseState.finalResponse;
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
