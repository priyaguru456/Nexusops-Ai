export interface Citation {
  documentId: string;
  documentTitle: string;
  pageNumber: number | null;
  snippet: string;
}

export type MessageRole = "USER" | "ASSISTANT" | "user" | "assistant";

export interface ChatMessage {
  id: string;
  sessionId?: string;
  role: MessageRole;
  content: string;
  citations?: Citation[] | null;
  tokensUsed?: number | null;
  latencyMs?: number | null;
  feedback?: number | null; // 1 for +1 (thumbs up), -1 for -1 (thumbs down), null
  createdAt?: string;
  notFound?: boolean;
  isStreaming?: boolean;
  error?: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string | null;
  createdAt: string;
  messages?: ChatMessage[];
  _count?: {
    messages: number;
  };
}

export interface TokenEvent {
  token: string;
}

export interface CitationsEvent {
  citations: Citation[];
}

export interface DoneEvent {
  messageId: string;
  sessionId: string;
  content: string;
  citations: Citation[];
  tokensUsed: number;
  latencyMs: number;
  notFound: boolean;
}

export interface ErrorEvent {
  error: string;
}

export interface FeedbackPayload {
  feedback?: number;
  vote?: "up" | "down";
}
