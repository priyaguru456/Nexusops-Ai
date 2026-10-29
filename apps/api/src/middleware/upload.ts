import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import type { Request } from "express";
import { env } from "../config/env";
import { AppError } from "../lib/errors";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function sanitizeFilename(originalName: string): string {
  // Strip path traversal characters and directory components
  const baseName = path.basename(originalName);
  // Replace any character not alphanumeric, dot, dash, or underscore
  const cleaned = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Prepend timestamp and random hex to guarantee uniqueness
  const uniquePrefix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  return `${uniquePrefix}-${cleaned}`;
}

const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    cb(null, sanitizeFilename(file.originalname));
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      AppError.badRequest(
        `Invalid file type "${file.mimetype}". Allowed types: PDF, images, Word, Excel, CSV, TXT.`
      )
    );
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
  },
  fileFilter,
});
