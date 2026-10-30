import {
  auditRepository,
  type CreateAuditLogData,
  type AuditLogFilters,
} from "./audit.repository";
import { logger } from "../../lib/logger";

export class AuditService {
  async log(data: CreateAuditLogData): Promise<void> {
    try {
      await auditRepository.createLog(data);
    } catch (err) {
      logger.error(err, `Failed to write audit log for action: ${data.action}`);
    }
  }

  async getLogs(filters: AuditLogFilters) {
    return auditRepository.findAll(filters);
  }
}

export const auditService = new AuditService();
