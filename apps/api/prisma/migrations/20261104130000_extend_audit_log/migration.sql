-- Migration: 20261104130000_extend_audit_log
-- Description: Add summary, ipAddress columns and indexes on actorId and action to AuditLog table

-- UP Migration:
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");

-- DOWN Migration (Reversible rollback commands):
-- DROP INDEX IF EXISTS "AuditLog_action_idx";
-- DROP INDEX IF EXISTS "AuditLog_actorId_idx";
-- ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "ipAddress";
-- ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "summary";
