import { Queue } from "bullmq";
import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "./logger";

export const DOCUMENT_QUEUE_NAME = "document-processing";

export interface DocumentJobData {
  documentId: string;
}

/**
 * Creates an ioredis connection configured for BullMQ.
 * maxRetriesPerRequest MUST be set to null as required by BullMQ.
 */
export function createRedisConnection(): Redis {
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
  });

  connection.on("error", (err) => {
    logger.error({ err }, "Redis connection error in BullMQ client");
  });

  return connection;
}

let _documentQueue: Queue<DocumentJobData> | null = null;

/**
 * Returns the lazily-initialized Document BullMQ queue instance
 */
export function getDocumentQueue(): Queue<DocumentJobData> {
  if (!_documentQueue) {
    _documentQueue = new Queue<DocumentJobData>(DOCUMENT_QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000, // 1s, 2s, 4s...
        },
        removeOnComplete: {
          age: 24 * 3600, // keep completed jobs for 24h
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // keep failed jobs for 7 days
          count: 5000,
        },
      },
    });
  }
  return _documentQueue;
}

/**
 * Lazy proxy to document processing BullMQ queue
 */
export const documentQueue = new Proxy({} as Queue<DocumentJobData>, {
  get(_target, prop) {
    const queue = getDocumentQueue();
    const val = (queue as any)[prop];
    if (typeof val === "function") {
      return val.bind(queue);
    }
    return val;
  },
});
