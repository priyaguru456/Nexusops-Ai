import { api, getAccessToken, refreshAccessToken, baseURL } from "../../api/client";
import type {
  ChatSession,
  Citation,
  DoneEvent,
  FeedbackPayload,
} from "../../types/ai";

export interface StreamChatCallbacks {
  onToken: (token: string) => void;
  onCitations: (citations: Citation[]) => void;
  onDone: (data: DoneEvent) => void;
  onError: (error: string) => void;
}

export interface StreamChatParams {
  message: string;
  sessionId?: string;
  signal?: AbortSignal;
}

export const aiApi = {
  /**
   * Fetch all chat sessions for the authenticated user.
   */
  async getSessions(): Promise<ChatSession[]> {
    const res = await api.get<{ status: string; sessions: ChatSession[] }>("/ai/sessions");
    return res.data.sessions;
  },

  /**
   * Retrieve a single session with its messages.
   */
  async getSessionById(sessionId: string): Promise<ChatSession> {
    const res = await api.get<{ status: string; session: ChatSession }>(`/ai/sessions/${sessionId}`);
    return res.data.session;
  },

  /**
   * Rename a chat session.
   */
  async renameSession(sessionId: string, title: string): Promise<ChatSession> {
    const res = await api.patch<{ status: string; session: ChatSession }>(`/ai/sessions/${sessionId}`, {
      title,
    });
    return res.data.session;
  },

  /**
   * Delete a chat session.
   */
  async deleteSession(sessionId: string): Promise<void> {
    await api.delete(`/ai/sessions/${sessionId}`);
  },

  /**
   * Submit thumbs up (+1) or thumbs down (-1) feedback on an assistant message.
   */
  async submitFeedback(messageId: string, payload: FeedbackPayload): Promise<void> {
    await api.post(`/ai/messages/${messageId}/feedback`, payload);
  },

  /**
   * Fetch a document's file using the in-memory access token as a blob,
   * create an object URL, and open it with #page=N appended.
   * Revokes the object URL afterwards. Does NOT put the token in the URL.
   */
  async openDocumentAtPage(documentId: string, pageNumber: number | null = 1): Promise<Window | null> {
    const token = getAccessToken();

    const response = await fetch(`${baseURL}/documents/${documentId}/file`, {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Try refreshing once
        const newToken = await refreshAccessToken();
        if (newToken) {
          const retryRes = await fetch(`${baseURL}/documents/${documentId}/file`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${newToken}`,
            },
            credentials: "include",
          });
          if (retryRes.ok) {
            const blob = await retryRes.blob();
            return this._openBlobUrl(blob, pageNumber);
          }
        }
      }
      throw new Error(`Failed to load document (Status ${response.status})`);
    }

    const blob = await response.blob();
    return this._openBlobUrl(blob, pageNumber);
  },

  _openBlobUrl(blob: Blob, pageNumber: number | null): Window | null {
    // If mime type is not explicit, default to pdf for pdf viewing
    const fileBlob = blob.type ? blob : new Blob([blob], { type: "application/pdf" });
    const objectUrl = window.URL.createObjectURL(fileBlob);
    const targetUrl = pageNumber ? `${objectUrl}#page=${pageNumber}` : objectUrl;

    const newTab = window.open(targetUrl, "_blank", "noopener,noreferrer");

    // Revoke object URL after 60 seconds to release memory
    window.setTimeout(() => {
      window.URL.revokeObjectURL(objectUrl);
    }, 60000);

    return newTab;
  },

  /**
   * Streams chat answers token by token using fetch + ReadableStream for SSE.
   * Buffers partial chunks, splits on blank lines, handles typed events:
   * 'token', 'citations', 'done', 'error'.
   * Handles 401 retry with token refresh, 429 rate limit messages, and AbortController.
   */
  async streamChat(
    params: StreamChatParams,
    callbacks: StreamChatCallbacks
  ): Promise<void> {
    const { message, sessionId, signal } = params;

    const executeFetch = async (token: string | null): Promise<Response> => {
      return fetch(`${baseURL}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ message, sessionId }),
        signal,
      });
    };

    const token = getAccessToken();
    let res: Response;

    try {
      res = await executeFetch(token);
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError" || signal?.aborted) {
        return;
      }
      throw err;
    }

    // If 401, refresh token once and retry before showing an error
    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        try {
          res = await executeFetch(newToken);
        } catch (err: unknown) {
          if ((err as Error)?.name === "AbortError" || signal?.aborted) {
            return;
          }
          throw err;
        }
      }
    }

    // Handle HTTP errors cleanly
    if (!res.ok) {
      if (res.status === 429) {
        let friendlyMessage = "Rate limit reached. Please wait a moment before sending another message.";
        try {
          const errData = await res.json();
          if (errData.retryAfter || errData.retryAfterSeconds) {
            const secs = errData.retryAfter || errData.retryAfterSeconds;
            friendlyMessage = `Rate limit exceeded. Please wait ${secs} seconds before sending another message.`;
          } else if (errData.message) {
            friendlyMessage = errData.message;
          }
        } catch {
          const retryHeader = res.headers.get("Retry-After");
          if (retryHeader) {
            friendlyMessage = `Rate limit exceeded. Please wait ${retryHeader} seconds before sending another message.`;
          }
        }
        callbacks.onError(friendlyMessage);
        return;
      }

      let errorDetail = `Request failed with status ${res.status}`;
      try {
        const errData = await res.json();
        errorDetail = errData.message || errData.error || errorDetail;
      } catch {
        // ignore
      }
      callbacks.onError(errorDetail);
      return;
    }

    if (!res.body) {
      callbacks.onError("No response body received from server");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        if (signal?.aborted) {
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
          return;
        }

        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // SSE messages are delimited by two consecutive newlines: \n\n or \r\n\r\n
        while (true) {
          const rnIndex = buffer.indexOf("\r\n\r\n");
          const nnIndex = buffer.indexOf("\n\n");

          if (rnIndex === -1 && nnIndex === -1) {
            break;
          }

          let boundaryIndex: number;
          let delimiterLength: number;

          if (rnIndex !== -1 && (nnIndex === -1 || rnIndex <= nnIndex)) {
            boundaryIndex = rnIndex;
            delimiterLength = 4;
          } else {
            boundaryIndex = nnIndex;
            delimiterLength = 2;
          }

          const rawEvent = buffer.slice(0, boundaryIndex);
          buffer = buffer.slice(boundaryIndex + delimiterLength);

          parseAndDispatchSSE(rawEvent, callbacks);
        }
      }

      // Flush any trailing event in buffer if stream closed without trailing blank line
      if (buffer.trim()) {
        parseAndDispatchSSE(buffer, callbacks);
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError" || signal?.aborted) {
        return;
      }
      callbacks.onError((err as Error)?.message || "Connection interrupted while streaming");
    } finally {
      reader.releaseLock();
    }
  },
};

/**
 * Small, robust SSE event parser that splits an event block into lines,
 * extracts event type and data payload, and dispatches to appropriate callbacks.
 */
function parseAndDispatchSSE(rawBlock: string, callbacks: StreamChatCallbacks): void {
  const lines = rawBlock.split(/\r?\n/);
  let eventType = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) {
    return;
  }

  const rawData = dataLines.join("\n");
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(rawData) as Record<string, unknown>;
  } catch {
    parsed = { error: rawData };
  }

  switch (eventType) {
    case "token":
      if (typeof parsed?.token === "string") {
        callbacks.onToken(parsed.token);
      }
      break;

    case "citations":
      if (Array.isArray(parsed?.citations)) {
        callbacks.onCitations(parsed.citations as Citation[]);
      }
      break;

    case "done":
      callbacks.onDone(parsed as unknown as DoneEvent);
      break;

    case "error":
      callbacks.onError(
        typeof parsed?.error === "string"
          ? parsed.error
          : "An error occurred during generation"
      );
      break;

    default:
      // Fallback for unnamed events with done/token properties
      if (typeof parsed?.token === "string") {
        callbacks.onToken(parsed.token);
      } else if (Array.isArray(parsed?.citations)) {
        callbacks.onCitations(parsed.citations as Citation[]);
      } else if (parsed?.messageId !== undefined) {
        callbacks.onDone(parsed as unknown as DoneEvent);
      } else if (typeof parsed?.error === "string") {
        callbacks.onError(parsed.error);
      }
      break;
  }
}
