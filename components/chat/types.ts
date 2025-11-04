export type Role = 'user' | 'assistant' | 'system';

export type StreamEvent = {
  kind: 'thought' | 'answer';
  text: string;
};

export type Attachment = {
  id: string;
  type: 'image';
  uri: string;
  width?: number;
  height?: number;
  fileName?: string;
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
  isStreaming?: boolean;
  toolStatus?: string | null;
  toolLogs?: string[] | null;
  replacedContent?: string | null;
  shouldAnimateReplacement?: boolean;
  attachments?: Attachment[];
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};
