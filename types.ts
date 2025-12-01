export interface Message {
  id: string;
  role: 'user' | 'model';
  text?: string;
  imageUrl?: string;
  isError?: boolean;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export enum AppMode {
  CHAT = 'CHAT',
  IMAGE_EDIT = 'IMAGE_EDIT', // Use for both generation and editing
}

export interface GenerationResult {
  text?: string;
  imageUrl?: string;
}
