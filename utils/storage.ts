import { Platform } from 'react-native';
import type { Conversation } from '@/components/chat/types';

const KEY = '@aqqal/conversations';

type StorageLike = {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
};

// Simple in-memory fallback for native until AsyncStorage is added
const memory: Record<string, string> = {};

const storage: StorageLike = Platform.OS === 'web'
  ? {
      getItem: (k) => {
        try {
          return (globalThis as any)?.localStorage?.getItem(k) ?? null;
        } catch {
          return null;
        }
      },
      setItem: (k, v) => {
        try {
          (globalThis as any)?.localStorage?.setItem(k, v);
        } catch {}
      },
      removeItem: (k) => {
        try {
          (globalThis as any)?.localStorage?.removeItem(k);
        } catch {}
      },
    }
  : {
      getItem: async (k) => memory[k] ?? null,
      setItem: async (k, v) => {
        memory[k] = v;
      },
      removeItem: async (k) => {
        delete memory[k];
      },
    };

export async function loadConversations(): Promise<Conversation[]> {
  const raw = await storage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveConversations(convos: Conversation[]): Promise<void> {
  try {
    await storage.setItem(KEY, JSON.stringify(convos));
  } catch {}
}
