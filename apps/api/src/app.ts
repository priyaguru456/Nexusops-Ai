import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { notFound, errorHandler } from "./middleware/errorHandler";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "nexusops-api",
    timestamp: new Date().toISOString(),
  });
});

app.use(notFound);
app.use(errorHandler);
