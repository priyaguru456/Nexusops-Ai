-- Migration: 20261103180000_notification_center
-- Description: Add title, entityType, entityId, and readAt columns to Notification

-- UP Migration:
ALTER TABLE "Notification" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Notification" ADD COLUMN "entityType" TEXT;
ALTER TABLE "Notification" ADD COLUMN "entityId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "readAt" TIMESTAMP(3);

-- Composite index for fast chronological querying per user
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- Backfill readAt for already read notifications
UPDATE "Notification"
SET "readAt" = "createdAt"
WHERE "isRead" = true
  AND "readAt" IS NULL;

-- DOWN Migration (Reversible rollback commands):
-- DROP INDEX IF EXISTS "Notification_userId_createdAt_idx";
-- ALTER TABLE "Notification" DROP COLUMN IF EXISTS "readAt";
-- ALTER TABLE "Notification" DROP COLUMN IF EXISTS "entityId";
-- ALTER TABLE "Notification" DROP COLUMN IF EXISTS "entityType";
-- ALTER TABLE "Notification" DROP COLUMN IF EXISTS "title";
