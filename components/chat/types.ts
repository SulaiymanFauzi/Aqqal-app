export type Role = 'user' | 'assistant' | 'system';

export type Message = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};
