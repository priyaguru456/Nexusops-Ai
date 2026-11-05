import {
  auditRepository,
  type CreateAuditLogData,
  type AuditLogFilters,
} from "./audit.repository";
import { logger } from "../../lib/logger";
import { Prisma } from "@prisma/client";

/**
 * Regex matching keys that contain sensitive credentials, secrets, or tokens.
 * Any key matching this pattern will be strictly stripped and excluded from metadata.
 */
const SENSITIVE_KEY_REGEX = /(password|passwd|pwd|token|secret|authorization|cookie|bearer|credential|api[_-]?key)/i;

/**
 * Recursively sanitizes JSON metadata so sensitive fields (passwords, tokens, secrets) never appear.
 */
export function sanitizeMetadata(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeMetadata(item));
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        // Strip sensitive field completely so it never appears in metadata
        continue;
      }
      sanitized[key] = sanitizeMetadata(value);
    }
    return sanitized;
  }

  return data;
}

/**
 * Generates a clean human-readable default summary if not provided.
 */
export function generateDefaultSummary(
  action: string,
  entityType: string,
  entityId?: string | null
): string {
  const words = action
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const shortId = entityId ? ` #${entityId.slice(0, 8)}` : "";
  return `${words} on ${entityType}${shortId}`;
}

export class AuditService {
  /**
   * Central audit logging helper.
   * Ensures all metadata is sanitized before persistence and guarantees append-only integrity.
   */
  async log(data: CreateAuditLogData): Promise<void> {
    try {
      const sanitizedMeta =
        data.metadata !== undefined && data.metadata !== null
          ? (sanitizeMetadata(data.metadata) as Prisma.InputJsonValue)
          : undefined;

      const summary =
        data.summary?.trim() ||
        generateDefaultSummary(data.action, data.entityType, data.entityId);

      await auditRepository.createLog({
        ...data,
        summary,
        metadata: sanitizedMeta,
      });
    } catch (err) {
      logger.error(err, `Failed to write audit log for action: ${data.action}`);
    }
  }

  async getLogs(filters: AuditLogFilters) {
    return auditRepository.findAll(filters);
  }

  async getLogsForExport(filters: Omit<AuditLogFilters, "page" | "limit">) {
    return auditRepository.findForExport(filters);
  }
}

export const auditService = new AuditService();
