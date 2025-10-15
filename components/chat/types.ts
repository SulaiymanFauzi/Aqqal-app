export type Role = 'user' | 'assistant' | 'system';

export type StreamEvent = {
  kind: 'thought' | 'answer';
  text: string;
};

export type Message = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  thoughts?: string | null;
  thoughtTitle?: string | null;
  thoughtTitles?: string[] | null;
  streamEvents?: StreamEvent[] | null;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};
