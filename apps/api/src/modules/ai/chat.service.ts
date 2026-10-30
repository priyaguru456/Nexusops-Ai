import { ChatRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { retrievalService } from "./retrieval.service";
import {
  getLLMProvider,
  DEFAULT_RAG_SYSTEM_PROMPT,
  formatSourcesContext,
  parseAndCleanCitations,
  Citation,
  LLMMessage,
} from "../../lib/llm";
import { AuthenticatedUser } from "../../types/express";

export interface StreamChatCallbacks {
  onToken: (token: string) => void;
  onCitations: (citations: Citation[]) => void;
  signal?: AbortSignal;
}

export interface ChatResult {
  messageId: string;
  sessionId: string;
  content: string;
  citations: Citation[];
  tokensUsed: number;
  latencyMs: number;
  notFound: boolean;
}

export const chatService = {
  /**
   * Main chat logic with SSE streaming:
   * 1. Resolves or initializes ChatSession, verifying user authorization.
   * 2. Persists the user's message.
   * 3. Fetches up to 6 previous messages from session history.
   * 4. Retrieves document chunks via hybrid vector + full-text search with strict RBAC.
   * 5. Checks best cosine similarity against SIMILARITY_THRESHOLD.
   *    - Chunks returned purely by keyword full-text search have similarityScore = 0.
   *    - If no chunks or best similarity < threshold, immediately returns "not found"
   *      without calling the LLM.
   * 6. Formats sources into secure <source> blocks and calls Claude with streaming.
   * 7. Parses [n] citation markers, deduplicates per (doc, page), strips unmapped [n] markers.
   * 8. Persists assistant message with citations, token usage, and latency.
   */
  async streamChat(
    user: AuthenticatedUser,
    messageText: string,
    sessionId: string | undefined,
    callbacks: StreamChatCallbacks
  ): Promise<ChatResult> {
    const startTime = Date.now();

    // 1. Resolve or create chat session
    let session;
    if (sessionId) {
      session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) {
        throw AppError.notFound("Chat session not found");
      }
      if (session.userId !== user.id) {
        throw AppError.forbidden("You do not have access to this chat session");
      }
    } else {
      const generatedTitle =
        messageText.length > 60
          ? `${messageText.slice(0, 57)}...`
          : messageText;

      session = await prisma.chatSession.create({
        data: {
          userId: user.id,
          title: generatedTitle,
        },
      });
    }

    // 2. Fetch last 6 messages of history (chronological order)
    const historyRows = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    });
    const history = historyRows.reverse();

    // 3. Save incoming user message
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: ChatRole.USER,
        content: messageText,
      },
    });

    // 4. Retrieve document chunks with RBAC filtering inside SQL
    const { results: retrievedChunks } = await retrievalService.retrieve(
      messageText,
      user,
      {
        topK: env.RAG_TOP_K || 8,
        hybrid: true,
      }
    );

    // 5. Evaluate similarity threshold:
    // Chunks resulting solely from full-text keyword search have similarityScore = 0.
    // If user's role cannot see documents, or retrieval returns 0 results,
    // or highest raw cosine similarity is below SIMILARITY_THRESHOLD, take "not found" path.
    const bestCosineSimilarity =
      retrievedChunks.length > 0
        ? Math.max(...retrievedChunks.map((c) => c.similarityScore || 0))
        : 0;

    const threshold = env.SIMILARITY_THRESHOLD ?? 0.3;
    const isNotFound =
      retrievedChunks.length === 0 || bestCosineSimilarity < threshold;

    if (isNotFound) {
      logger.info(
        {
          userId: user.id,
          role: user.role,
          bestCosineSimilarity,
          threshold,
          chunksFound: retrievedChunks.length,
        },
        "Retrieval similarity below threshold; executing 'not found' path without calling LLM"
      );

      const notFoundText = "I couldn't find this in the company documents.";
      callbacks.onToken(notFoundText);
      callbacks.onCitations([]);

      const latencyMs = Date.now() - startTime;
      const assistantMessage = await prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: ChatRole.ASSISTANT,
          content: notFoundText,
          citations: [],
          tokensUsed: 0,
          latencyMs,
        },
      });

      return {
        messageId: assistantMessage.id,
        sessionId: session.id,
        content: notFoundText,
        citations: [],
        tokensUsed: 0,
        latencyMs,
        notFound: true,
      };
    }

    // 6. Build prompt context with delimited <source> tags
    const sourcesContext = formatSourcesContext(retrievedChunks);
    const systemPrompt = `${DEFAULT_RAG_SYSTEM_PROMPT}\n\nSOURCES:\n${sourcesContext}`;

    const llmMessages: LLMMessage[] = [
      ...history.map((m) => ({
        role: (m.role === ChatRole.USER ? "user" : "assistant") as
          | "user"
          | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: messageText },
    ];

    // 7. Invoke LLM with streaming and abort signal support
    const llmProvider = getLLMProvider();
    const streamResult = await llmProvider.stream({
      systemPrompt,
      messages: llmMessages,
      signal: callbacks.signal,
    });

    let rawAccumulated = "";
    for await (const token of streamResult.textStream) {
      if (callbacks.signal?.aborted) {
        logger.info({ sessionId: session.id }, "LLM stream aborted by client disconnect");
        break;
      }
      rawAccumulated += token;
      callbacks.onToken(token);
    }

    const latencyMs = Date.now() - startTime;
    const usage = await streamResult.getUsage();
    const tokensUsed = usage.inputTokens + usage.outputTokens;

    // 8. Citation parsing: map [n] to real chunks, deduplicate per (doc, page), strip unmapped [n]
    const { cleanedText, citations } = parseAndCleanCitations(
      rawAccumulated,
      retrievedChunks
    );

    callbacks.onCitations(citations);

    // 9. Persist assistant message
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: ChatRole.ASSISTANT,
        content: cleanedText,
        citations: citations as any,
        tokensUsed,
        latencyMs,
      },
    });

    return {
      messageId: assistantMessage.id,
      sessionId: session.id,
      content: cleanedText,
      citations,
      tokensUsed,
      latencyMs,
      notFound: false,
    };
  },

  /**
   * Retrieves all chat sessions owned by the authenticated user.
   */
  async getUserSessions(userId: string) {
    return prisma.chatSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { messages: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  },

  /**
   * Retrieves a single chat session with its full message history.
   * Enforces user ownership check.
   */
  async getSessionById(sessionId: string, userId: string) {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      throw AppError.notFound("Chat session not found");
    }

    if (session.userId !== userId) {
      throw AppError.forbidden("You do not have access to this chat session");
    }

    return session;
  },

  /**
   * Deletes a chat session and all cascading messages.
   * Enforces user ownership check.
   */
  async deleteSession(sessionId: string, userId: string) {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw AppError.notFound("Chat session not found");
    }

    if (session.userId !== userId) {
      throw AppError.forbidden("You do not have access to this chat session");
    }

    await prisma.chatSession.delete({
      where: { id: sessionId },
    });
  },

  /**
   * Records user thumbs up (+1) or thumbs down (-1) feedback on a message.
   * Enforces ownership of the underlying session.
   */
  async submitFeedback(messageId: string, userId: string, feedbackValue: number) {
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { session: true },
    });

    if (!message) {
      throw AppError.notFound("Chat message not found");
    }

    if (message.session.userId !== userId) {
      throw AppError.forbidden("You do not have access to this message");
    }

    return prisma.chatMessage.update({
      where: { id: messageId },
      data: { feedback: feedbackValue },
    });
  },
};
