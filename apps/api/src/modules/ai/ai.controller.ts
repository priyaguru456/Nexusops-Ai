import type { Request, Response, NextFunction } from "express";
import { Prisma, DocStatus } from "@prisma/client";
import { retrievalService } from "./retrieval.service";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { getEmbeddingsProvider, formatVectorForPg } from "../../lib/embeddings";
import { logger } from "../../lib/logger";

export const aiController = {
  /**
   * POST /api/ai/debug/retrieve
   * Debug inspection endpoint (Admin only) to test cosine similarity, full-text search,
   * hybrid RRF fusion, and role/department permission filtering.
   */
  async debugRetrieve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();

      const { question, topK, hybrid, asUserId } = req.body;

      let targetUser = req.user;
      if (asUserId) {
        const found = await prisma.user.findUnique({
          where: { id: asUserId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            departmentId: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            managerId: true,
          },
        });
        if (!found) {
          throw AppError.notFound(`Test user with ID ${asUserId} not found`);
        }
        targetUser = found;
      }

      const { results, vectorCount, textCount } = await retrievalService.retrieve(
        question,
        targetUser,
        { topK, hybrid }
      );

      // Log scores in debug endpoint so admin can tune similarity thresholds
      logger.info(
        {
          question,
          testedAsUser: {
            id: targetUser.id,
            email: targetUser.email,
            role: targetUser.role,
            departmentId: targetUser.departmentId,
          },
          vectorCandidatesFound: vectorCount,
          textCandidatesFound: textCount,
          finalResultCount: results.length,
          scores: results.map((r) => ({
            chunkId: r.id,
            documentTitle: r.documentTitle,
            pageNumber: r.pageNumber,
            similarityScore: r.similarityScore,
            cosineDistance: r.cosineDistance,
            textRank: r.textRank,
            fusedScore: r.fusedScore,
          })),
        },
        "[AI DEBUG] Retrieval results and similarity scores"
      );

      res.status(200).json({
        status: "success",
        query: question,
        hybrid,
        testedAs: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          departmentId: targetUser.departmentId,
        },
        counts: {
          vectorMatches: vectorCount,
          textMatches: textCount,
          totalReturned: results.length,
        },
        results,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/ai/admin/reembed
   * Re-embeds all existing chunks for READY documents that lack embeddings.
   */
  async reembedReadyDocuments(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const provider = getEmbeddingsProvider();

      // Find chunks with null embeddings belonging to READY documents
      const chunks = await prisma.documentChunk.findMany({
        where: {
          document: {
            status: DocStatus.READY,
          },
        },
        select: {
          id: true,
          documentId: true,
          content: true,
        },
        orderBy: { createdAt: "asc" },
      });

      if (chunks.length === 0) {
        res.status(200).json({
          status: "success",
          message: "No chunks found needing embedding.",
          chunksProcessed: 0,
        });
        return;
      }

      logger.info(
        { totalChunks: chunks.length },
        "Re-embedding chunks for existing READY documents"
      );

      const batchSize = 64;
      let totalTokens = 0;
      let processedCount = 0;

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const texts = batch.map((c) => c.content);

        const { embeddings, tokensUsed } = await provider.embedBatch(texts, batchSize);
        totalTokens += tokensUsed;

        for (let j = 0; j < batch.length; j++) {
          const chunkId = batch[j].id;
          const vectorStr = formatVectorForPg(embeddings[j]);

          await prisma.$executeRaw(
            Prisma.sql`UPDATE "DocumentChunk" SET "embedding" = ${vectorStr}::vector WHERE "id" = ${chunkId}`
          );
          processedCount++;
        }
      }

      logger.info(
        { processedCount, totalTokens },
        "Re-embedding for existing READY documents finished"
      );

      res.status(200).json({
        status: "success",
        message: `Successfully generated and saved embeddings for ${processedCount} chunks.`,
        chunksProcessed: processedCount,
        totalTokensUsed: totalTokens,
      });
    } catch (error) {
      next(error);
    }
  },
};
