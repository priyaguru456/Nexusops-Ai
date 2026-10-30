import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import { env } from "../../config/env";
import { logger } from "../logger";

export interface StorageResult {
  storedFilename: string;
  relativePath: string;
  fullPath: string;
  sizeBytes: number;
}

export interface StorageService {
  save(buffer: Buffer, originalFilename: string): Promise<StorageResult>;
  read(relativePath: string): Promise<Buffer>;
  getStream(relativePath: string): Promise<Readable>;
  delete(relativePath: string): Promise<void>;
  exists(relativePath: string): Promise<boolean>;
  getFullPath(relativePath: string): string;
}

export class LocalStorageService implements StorageService {
  private uploadDir: string;

  constructor(customUploadDir?: string) {
    // Resolve upload dir strictly outside src (e.g. apps/api/uploads)
    if (customUploadDir) {
      this.uploadDir = path.isAbsolute(customUploadDir)
        ? customUploadDir
        : path.resolve(process.cwd(), customUploadDir);
    } else {
      // Default to apps/api/uploads regardless of working directory
      const baseAppDir = path.resolve(__dirname, "../../..");
      this.uploadDir = path.resolve(baseAppDir, "uploads");
    }

    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  public getFullPath(relativePath: string): string {
    // Prevent path traversal
    const safeName = path.basename(relativePath);
    return path.join(this.uploadDir, safeName);
  }

  public async save(buffer: Buffer, originalFilename: string): Promise<StorageResult> {
    const ext = path.extname(originalFilename).toLowerCase();
    // Generate stored filename with UUID - never use the original filename as a path
    const storedFilename = `${crypto.randomUUID()}${ext}`;
    const fullPath = this.getFullPath(storedFilename);

    await fs.promises.writeFile(fullPath, buffer);

    return {
      storedFilename,
      relativePath: storedFilename,
      fullPath,
      sizeBytes: buffer.length,
    };
  }

  public async read(relativePath: string): Promise<Buffer> {
    const fullPath = this.getFullPath(relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${relativePath}`);
    }
    return fs.promises.readFile(fullPath);
  }

  public async getStream(relativePath: string): Promise<Readable> {
    const fullPath = this.getFullPath(relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${relativePath}`);
    }
    return fs.createReadStream(fullPath);
  }

  public async delete(relativePath: string): Promise<void> {
    const fullPath = this.getFullPath(relativePath);
    try {
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
    } catch (err) {
      logger.warn({ err, fullPath }, "Failed to delete file from local storage");
    }
  }

  public async exists(relativePath: string): Promise<boolean> {
    const fullPath = this.getFullPath(relativePath);
    return fs.existsSync(fullPath);
  }
}

/**
 * S3-compatible interface stub for production / cloud object storage.
 */
export class S3StorageService implements StorageService {
  private bucket: string;

  constructor(bucket = process.env.S3_BUCKET || "nexusops-uploads") {
    this.bucket = bucket;
  }

  public getFullPath(relativePath: string): string {
    return `s3://${this.bucket}/${relativePath}`;
  }

  public async save(_buffer: Buffer, _originalFilename: string): Promise<StorageResult> {
    throw new Error(
      "S3 storage adapter is not yet implemented. Set storage provider to local disk."
    );
  }

  public async read(_relativePath: string): Promise<Buffer> {
    throw new Error(
      "S3 storage adapter is not yet implemented. Set storage provider to local disk."
    );
  }

  public async getStream(_relativePath: string): Promise<Readable> {
    throw new Error(
      "S3 storage adapter is not yet implemented. Set storage provider to local disk."
    );
  }

  public async delete(_relativePath: string): Promise<void> {
    throw new Error(
      "S3 storage adapter is not yet implemented. Set storage provider to local disk."
    );
  }

  public async exists(_relativePath: string): Promise<boolean> {
    throw new Error(
      "S3 storage adapter is not yet implemented. Set storage provider to local disk."
    );
  }
}

export const storageService = new LocalStorageService();
