-- Migration: 20261104140000_generic_approval_entities
-- Description: Add entityType and entityId to ApprovalStep to support generic entities (REQUEST, LEAVE, EXPENSE)
-- and make requestId nullable while preserving backward compatibility.

-- UP Migration:
-- 1. Add entityType column with default 'REQUEST'
ALTER TABLE "ApprovalStep" ADD COLUMN IF NOT EXISTS "entityType" TEXT NOT NULL DEFAULT 'REQUEST';

-- 2. Add entityId column (temporarily nullable during migration)
ALTER TABLE "ApprovalStep" ADD COLUMN IF NOT EXISTS "entityId" TEXT;

-- 3. Backfill entityId with requestId for all existing rows
UPDATE "ApprovalStep" SET "entityId" = "requestId", "entityType" = 'REQUEST' WHERE "entityId" IS NULL;

-- 4. Set entityId as NOT NULL now that existing rows have been backfilled
ALTER TABLE "ApprovalStep" ALTER COLUMN "entityId" SET NOT NULL;

-- 5. Make requestId nullable so future non-request entities do not require a dummy WorkRequest
ALTER TABLE "ApprovalStep" ALTER COLUMN "requestId" DROP NOT NULL;

-- 6. Add new composite unique constraint on (entityType, entityId, stepOrder)
CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalStep_entityType_entityId_stepOrder_key" ON "ApprovalStep"("entityType", "entityId", "stepOrder");

-- 7. Add index on (entityType, entityId) for fast lookups
CREATE INDEX IF NOT EXISTS "ApprovalStep_entityType_entityId_idx" ON "ApprovalStep"("entityType", "entityId");

-- DOWN Migration (Reversible rollback commands):
-- DROP INDEX IF EXISTS "ApprovalStep_entityType_entityId_idx";
-- DROP INDEX IF EXISTS "ApprovalStep_entityType_entityId_stepOrder_key";
-- ALTER TABLE "ApprovalStep" ALTER COLUMN "requestId" SET NOT NULL;
-- ALTER TABLE "ApprovalStep" DROP COLUMN IF EXISTS "entityId";
-- ALTER TABLE "ApprovalStep" DROP COLUMN IF EXISTS "entityType";
