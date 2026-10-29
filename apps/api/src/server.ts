import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";

const server = app.listen(env.PORT, () => {
  logger.info(`NexusOps API listening on port ${env.PORT} [${env.NODE_ENV}]`);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info("Database connection closed. Process terminated.");
      process.exit(0);
    } catch (err) {
      logger.error(err, "Error disconnecting from database during shutdown");
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
