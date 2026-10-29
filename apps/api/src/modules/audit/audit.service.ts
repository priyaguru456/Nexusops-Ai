import { auditRepository, type CreateAuditLogData } from "./audit.repository";
import { logger } from "../../lib/logger";

export class AuditService {
  async log(data: CreateAuditLogData): Promise<void> {
    try {
      await auditRepository.createLog(data);
    } catch (err) {
      logger.error(err, `Failed to write audit log for action: ${data.action}`);
    }
  }
}

export const auditService = new AuditService();
