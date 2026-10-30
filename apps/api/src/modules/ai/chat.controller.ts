import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/errors";
import { chatService } from "./chat.service";
import { logger } from "../../lib/logger";

export const chatController = {
  /**
   * POST /api/ai/chat (SSE streaming)
   * Streams LLM tokens using Server-Sent Events (SSE).
   * Events emitted:
   * - token:     { token: string }
   * - citations: { citations: Citation[] }
   * - done:      { messageId, sessionId, content, citations, tokensUsed, latencyMs, notFound }
   * - error:     { error: string }
   */
  async chat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const { message, sessionId } = req.body;

      // Set headers for Server-Sent Events
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      const sendSSE = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        // If compression or flushing is supported on the response stream:
        (res as any).flush?.();
      };

      const abortController = new AbortController();
      req.on("close", () => {
        abortController.abort();
      });

      const result = await chatService.streamChat(
        req.user,
        message,
        sessionId,
        {
          onToken: (token: string) => {
            sendSSE("token", { token });
          },
          onCitations: (citations) => {
            sendSSE("citations", { citations });
          },
          signal: abortController.signal,
        }
      );

      sendSSE("done", {
        messageId: result.messageId,
        sessionId: result.sessionId,
        content: result.content,
        citations: result.citations,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
        notFound: result.notFound,
      });

      res.end();
    } catch (error: any) {
      logger.error(error, "Error during SSE chat streaming");

      if (res.headersSent) {
        res.write(
          `event: error\ndata: ${JSON.stringify({
            error: error?.message || "Internal streaming error",
          })}\n\n`
        );
        res.end();
      } else {
        next(error);
      }
    }
  },

  /**
   * GET /api/ai/sessions
   * Returns all chat sessions for the authenticated user.
   */
  async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();

      const sessions = await chatService.getUserSessions(req.user.id);
      res.status(200).json({
        status: "success",
        sessions,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/ai/sessions/:id
   * Returns a specific chat session with full message history.
   */
  async getSessionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = req.params.id as string;

      const session = await chatService.getSessionById(id, req.user.id);
      res.status(200).json({
        status: "success",
        session,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/ai/sessions/:id
   * Deletes a chat session and all messages within it.
   */
  async deleteSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = req.params.id as string;

      await chatService.deleteSession(id, req.user.id);
      res.status(200).json({
        status: "success",
        message: "Chat session deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/ai/messages/:id/feedback
   * Updates feedback on a message (+1 for up, -1 for down).
   */
  async submitFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = req.params.id as string;
      const { feedback, vote } = req.body;

      let score = feedback;
      if (score === undefined) {
        score = vote === "up" ? 1 : -1;
      }

      const updated = await chatService.submitFeedback(id, req.user.id, score);
      res.status(200).json({
        status: "success",
        message: "Feedback submitted successfully",
        chatMessage: updated,
      });
    } catch (error) {
      next(error);
    }
  },
};
