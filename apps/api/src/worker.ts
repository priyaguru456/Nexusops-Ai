import { Worker, Job } from "bullmq";
import { DocStatus } from "@prisma/client";
import { DOCUMENT_QUEUE_NAME, DocumentJobData, createRedisConnection } from "./lib/queue";
import { processDocument } from "./jobs/document.processor";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";

logger.info("Initializing NexusOps AI background worker process...");

const redisConnection = createRedisConnection();

export const documentWorker = new Worker<DocumentJobData>(
  DOCUMENT_QUEUE_NAME,
  async (job: Job<DocumentJobData>) => {
    const { documentId } = job.data;
    logger.info(
      { jobId: job.id, documentId, attempt: job.attemptsMade + 1 },
      "Worker picked up document ingestion job"
    );

    try {
      await processDocument(documentId);
    } catch (err: any) {
      const maxAttempts = job.opts.attempts ?? 3;
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

      logger.warn(
        {
          jobId: job.id,
          documentId,
          attempt: job.attemptsMade + 1,
          maxAttempts,
          error: err?.message,
        },
        isFinalAttempt
          ? "Document ingestion failed on final attempt"
          : "Document ingestion attempt failed, will retry"
      );

      // On final attempt, guarantee the document status is updated to FAILED with error message
      if (isFinalAttempt) {
        try {
          await prisma.document.update({
            where: { id: documentId },
            data: {
              status: DocStatus.FAILED,
              errorMessage: err?.message || "Document processing failed unexpectedly",
            },
          });
        } catch (dbErr) {
          logger.error({ dbErr, documentId }, "Failed to update document status to FAILED in DB");
        }
      }

      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

documentWorker.on("completed", (job) => {
  logger.info({ jobId: job?.id, documentId: job?.data?.documentId }, "Worker completed job");
});

documentWorker.on("failed", async (job, err) => {
  if (job) {
    const { documentId } = job.data;
    logger.error(
      { jobId: job.id, documentId, error: err.message, attemptsMade: job.attemptsMade },
      "BullMQ job permanently failed"
    );

    try {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: DocStatus.FAILED,
          errorMessage: err.message || "Document processing failed",
        },
      });
    } catch (dbErr) {
      logger.error({ dbErr, documentId }, "Failed to persist FAILED status to document");
    }
  }
});

documentWorker.on("error", (err) => {
  logger.error({ err }, "BullMQ Worker encountered an internal error");
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info({ signal }, "Received shutdown signal, closing worker gracefully...");
  try {
    await documentWorker.close();
    await redisConnection.quit();
    await prisma.$disconnect();
    logger.info("Worker process exited cleanly.");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during worker graceful shutdown");
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

logger.info(`Worker listening for jobs on queue: ${DOCUMENT_QUEUE_NAME}`);
