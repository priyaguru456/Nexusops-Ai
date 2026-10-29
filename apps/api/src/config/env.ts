import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
  dotenv.config({ path: "apps/api/.env" });
}

const isTest = (process.env.NODE_ENV || "").toLowerCase() === "test";

const optionalString = z
  .preprocess((val) => (typeof val === "string" && val.trim() === "" ? undefined : val), z.string().optional());

const booleanFromStr = z
  .preprocess((val) => {
    if (typeof val === "string") {
      const lower = val.trim().toLowerCase();
      if (lower === "true") return true;
      if (lower === "false" || lower === "") return false;
    }
    return val;
  }, z.boolean())
  .default(false);

const coerceNumber = (def: number) =>
  z.preprocess((val) => (typeof val === "string" && val.trim() === "" ? undefined : val), z.coerce.number().default(def));

const coerceString = (def: string) =>
  z.preprocess((val) => (typeof val === "string" && val.trim() === "" ? undefined : val), z.string().default(def));

const requiredInNonTest = (minLen: number, dummy: string, errorMsg: string) =>
  z.preprocess((val) => {
    if (isTest && (!val || (typeof val === "string" && val.trim() === ""))) {
      return dummy;
    }
    return val;
  }, z.string().min(minLen, errorMsg));

const envSchema = z.object({
  PORT: coerceNumber(4000),
  NODE_ENV: z
    .preprocess(
      (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
      z.enum(["development", "test", "production"]).default("development")
    ),
  CLIENT_URL: coerceString("http://localhost:5173"),
  CORS_ORIGINS: coerceString("http://localhost:5173"),

  DATABASE_URL: requiredInNonTest(
    1,
    "postgresql://postgres:postgres@localhost:5432/nexusops_ai_test?schema=public",
    "DATABASE_URL is required"
  ),
  DIRECT_URL: optionalString,
  REDIS_URL: coerceString("redis://localhost:6379"),

  JWT_ACCESS_SECRET: requiredInNonTest(
    32,
    "test_dummy_jwt_access_secret_min_32_characters_long_123456",
    "JWT_ACCESS_SECRET must be at least 32 characters"
  ),
  JWT_REFRESH_SECRET: requiredInNonTest(
    32,
    "test_dummy_jwt_refresh_secret_min_32_characters_long_123456",
    "JWT_REFRESH_SECRET must be at least 32 characters"
  ),
  JWT_ACCESS_EXPIRES: coerceString("15m"),
  JWT_REFRESH_EXPIRES: coerceString("7d"),
  COOKIE_SECURE: booleanFromStr,
  BCRYPT_ROUNDS: coerceNumber(10),

  UPLOAD_DIR: coerceString("./uploads"),
  MAX_UPLOAD_MB: coerceNumber(20),

  LLM_API_KEY: optionalString,
  EMBEDDING_API_KEY: optionalString,
  LLM_MODEL: optionalString,
  EMBEDDING_MODEL: coerceString("text-embedding-3-small"),
  EMBEDDING_DIMENSIONS: coerceNumber(1536),
  RAG_TOP_K: coerceNumber(6),
  SIMILARITY_THRESHOLD: coerceNumber(0.3),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Environment validation failed:");
  for (const issue of parsed.error.issues) {
    const varName = issue.path.join(".") || "unknown";
    console.error(`- ${varName}: ${issue.message}`);
  }
  process.exit(1);
}

const rawEnv = parsed.data;

const parsedOrigins = Array.from(
  new Set([
    rawEnv.CLIENT_URL,
    ...rawEnv.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
  ])
);

export const env = {
  ...rawEnv,
  CORS_WHITELIST: parsedOrigins,
};

export type Env = typeof env;
