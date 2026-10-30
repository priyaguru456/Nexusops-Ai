import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { aiChatRateLimiter } from "../../middleware/rateLimiter";
import { aiController } from "./ai.controller";
import { chatController } from "./chat.controller";
import {
  debugRetrieveSchema,
  chatInputSchema,
  feedbackInputSchema,
  uuidParamSchema,
} from "./ai.schema";

export const aiRouter = Router();

/**
 * POST /api/ai/chat
 * SSE streaming chat endpoint with RBAC-filtered RAG and Claude integration.
 * Rate limited per authenticated user ID.
 */
aiRouter.post(
  "/chat",
  authenticate,
  aiChatRateLimiter,
  validate({ body: chatInputSchema }),
  chatController.chat
);

/**
 * GET /api/ai/sessions
 * List all chat sessions belonging to the authenticated user.
 */
aiRouter.get(
  "/sessions",
  authenticate,
  chatController.getSessions
);

/**
 * GET /api/ai/sessions/:id
 * Retrieve a single chat session with full history.
 */
aiRouter.get(
  "/sessions/:id",
  authenticate,
  validate({ params: uuidParamSchema }),
  chatController.getSessionById
);

/**
 * DELETE /api/ai/sessions/:id
 * Delete a chat session and its messages.
 */
aiRouter.delete(
  "/sessions/:id",
  authenticate,
  validate({ params: uuidParamSchema }),
  chatController.deleteSession
);

/**
 * POST /api/ai/messages/:id/feedback
 * Submit thumbs up (+1) / thumbs down (-1) feedback for an assistant response.
 */
aiRouter.post(
  "/messages/:id/feedback",
  authenticate,
  validate({ params: uuidParamSchema, body: feedbackInputSchema }),
  chatController.submitFeedback
);

/**
 * POST /api/ai/debug/retrieve
 * Admin only: inspect vector, text, and hybrid RRF retrieval scores and RBAC filtering
 */
aiRouter.post(
  "/debug/retrieve",
  authenticate,
  authorize(Role.ADMIN),
  validate({ body: debugRetrieveSchema }),
  aiController.debugRetrieve
);

/**
 * POST /api/ai/admin/reembed
 * Admin only: batch generates vector embeddings for existing READY documents
 */
aiRouter.post(
  "/admin/reembed",
  authenticate,
  authorize(Role.ADMIN),
  aiController.reembedReadyDocuments
);
