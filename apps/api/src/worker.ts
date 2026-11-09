import { Worker, Job } from "bullmq";
import { DocStatus } from "@prisma/client";
import {
  DOCUMENT_QUEUE_NAME,
  ESCALATION_QUEUE_NAME,
  DIGEST_QUEUE_NAME,
  DocumentJobData,
  EscalationJobData,
  DigestJobData,
  createRedisConnection,
  getEscalationQueue,
  getDigestQueue,
} from "./lib/queue";
import { processDocument } from "./jobs/document.processor";
import { approvalEscalationService } from "./modules/approvals/approval-escalation.service";
import { digestService } from "./modules/analytics/digest.service";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";

logger.info("Initializing NexusOps AI background worker process...");

const redisConnection = createRedisConnection();

// 1. Document ingestion and embedding worker
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
  logger.info({ jobId: job?.id, documentId: job?.data?.documentId }, "Worker completed document job");
});

documentWorker.on("failed", async (job, err) => {
  if (job) {
    const { documentId } = job.data;
    logger.error(
      { jobId: job.id, documentId, error: err.message, attemptsMade: job.attemptsMade },
      "BullMQ document job permanently failed"
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
  logger.error({ err }, "BullMQ Document Worker encountered an internal error");
});

// 2. Approval escalation check worker
export const escalationWorker = new Worker<EscalationJobData>(
  ESCALATION_QUEUE_NAME,
  async (job: Job<EscalationJobData>) => {
    logger.info({ jobId: job.id }, "Starting overdue approval escalation scan");
    const result = await approvalEscalationService.checkAndEscalateOverdueApprovals(
      env.ESCALATION_AFTER_HOURS
    );
    logger.info({ jobId: job.id, ...result }, "Completed overdue approval escalation scan");
    return result;
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
);

escalationWorker.on("completed", (job) => {
  logger.info({ jobId: job?.id }, "Escalation check job completed");
});

escalationWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, "Escalation check job failed");
});

escalationWorker.on("error", (err) => {
  logger.error({ err }, "BullMQ Escalation Worker encountered an internal error");
});

// 3. Analytics Weekly Digest Worker
export const digestWorker = new Worker<DigestJobData>(
  DIGEST_QUEUE_NAME,
  async (job: Job<DigestJobData>) => {
    logger.info({ jobId: job.id, data: job.data }, "Worker processing analytics digest job");
    if (job.data.isTest && job.data.testRecipients) {
      return digestService.sendDigest({
        scheduleId: job.data.scheduleId,
        recipients: job.data.testRecipients,
        isTest: true,
      });
    }

    const count = await digestService.checkAndTriggerDueSchedules();
    logger.info({ jobId: job.id, triggeredCount: count }, "Completed due weekly digest check");
    return { triggeredCount: count };
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
);

digestWorker.on("completed", (job) => {
  logger.info({ jobId: job?.id }, "Digest job completed successfully");
});

digestWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, "Digest job failed");
});

digestWorker.on("error", (err) => {
  logger.error({ err }, "BullMQ Digest Worker encountered an internal error");
});

// 4. Register repeatable escalation schedule with fixed job ID
async function registerEscalationSchedule(): Promise<void> {
  try {
    const queue = getEscalationQueue();
    await queue.add(
      "check-overdue-approvals",
      { triggeredAt: new Date().toISOString() },
      {
        jobId: "escalation-check-schedule",
        repeat: {
          every: env.ESCALATION_CHECK_INTERVAL_MINUTES * 60 * 1000,
        },
      }
    );
    logger.info(
      {
        intervalMinutes: env.ESCALATION_CHECK_INTERVAL_MINUTES,
        thresholdHours: env.ESCALATION_AFTER_HOURS,
      },
      "Registered repeatable approval escalation check job with fixed ID"
    );
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Could not register repeatable escalation schedule (Redis might be starting)");
  }
}

// 5. Register repeatable analytics digest schedule with fixed job ID
async function registerDigestSchedule(): Promise<void> {
  try {
    const queue = getDigestQueue();
    await queue.add(
      "check-due-digests",
      { triggeredAt: new Date().toISOString() },
      {
        jobId: "analytics-digest-schedule",
        repeat: {
          every: (env.DIGEST_CHECK_INTERVAL_MINUTES || 15) * 60 * 1000,
        },
      }
    );
    logger.info(
      { intervalMinutes: env.DIGEST_CHECK_INTERVAL_MINUTES || 15 },
      "Registered repeatable analytics weekly digest check job with fixed ID"
    );
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Could not register repeatable digest schedule (Redis might be starting)");
  }
}

registerEscalationSchedule();
registerDigestSchedule();

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info({ signal }, "Received shutdown signal, closing workers gracefully...");
  try {
    await documentWorker.close();
    await escalationWorker.close();
    await digestWorker.close();
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

logger.info(
  `Workers listening on queues: [${DOCUMENT_QUEUE_NAME}, ${ESCALATION_QUEUE_NAME}, ${DIGEST_QUEUE_NAME}]`
);
