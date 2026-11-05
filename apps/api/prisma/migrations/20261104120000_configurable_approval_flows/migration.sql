-- Migration: 20261104120000_configurable_approval_flows
-- Description: Adds configurable approval workflows: optional maxAmount, isActive, flowId tracking, specific approver support.
-- Safety: Reversible migration. Always take a full database backup prior to running migrations in production.

-- 1. Alter ApprovalFlow to add maxAmount, isActive, and timestamps
ALTER TABLE "ApprovalFlow" ADD COLUMN IF NOT EXISTS "maxAmount" DECIMAL(12,2);
ALTER TABLE "ApprovalFlow" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ApprovalFlow" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ApprovalFlow" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2. Alter ApprovalFlowStep to allow nullable approverRole, add approverId and timestamps
ALTER TABLE "ApprovalFlowStep" ALTER COLUMN "approverRole" DROP NOT NULL;
ALTER TABLE "ApprovalFlowStep" ADD COLUMN IF NOT EXISTS "approverId" TEXT;
ALTER TABLE "ApprovalFlowStep" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ApprovalFlowStep" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add foreign key constraint for approverId in ApprovalFlowStep
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApprovalFlowStep_approverId_fkey'
  ) THEN
    ALTER TABLE "ApprovalFlowStep"
    ADD CONSTRAINT "ApprovalFlowStep_approverId_fkey"
    FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Alter WorkRequest to add flowId tracking and constraint
ALTER TABLE "WorkRequest" ADD COLUMN IF NOT EXISTS "flowId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkRequest_flowId_fkey'
  ) THEN
    ALTER TABLE "WorkRequest"
    ADD CONSTRAINT "WorkRequest_flowId_fkey"
    FOREIGN KEY ("flowId") REFERENCES "ApprovalFlow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS "ApprovalFlow_category_isActive_idx" ON "ApprovalFlow"("category", "isActive");
CREATE INDEX IF NOT EXISTS "ApprovalFlow_createdAt_idx" ON "ApprovalFlow"("createdAt");
CREATE INDEX IF NOT EXISTS "ApprovalFlowStep_approverId_idx" ON "ApprovalFlowStep"("approverId");
CREATE INDEX IF NOT EXISTS "ApprovalFlowStep_flowId_idx" ON "ApprovalFlowStep"("flowId");
CREATE INDEX IF NOT EXISTS "WorkRequest_flowId_idx" ON "WorkRequest"("flowId");

/*
-- REVERSIBLE ROLLBACK INSTRUCTIONS:
-- In case of rollback, execute the following SQL:
ALTER TABLE "WorkRequest" DROP CONSTRAINT IF EXISTS "WorkRequest_flowId_fkey";
DROP INDEX IF EXISTS "WorkRequest_flowId_idx";
ALTER TABLE "WorkRequest" DROP COLUMN IF EXISTS "flowId";

ALTER TABLE "ApprovalFlowStep" DROP CONSTRAINT IF EXISTS "ApprovalFlowStep_approverId_fkey";
DROP INDEX IF EXISTS "ApprovalFlowStep_approverId_idx";
DROP INDEX IF EXISTS "ApprovalFlowStep_flowId_idx";
ALTER TABLE "ApprovalFlowStep" DROP COLUMN IF EXISTS "updatedAt";
ALTER TABLE "ApprovalFlowStep" DROP COLUMN IF EXISTS "createdAt";
ALTER TABLE "ApprovalFlowStep" DROP COLUMN IF EXISTS "approverId";
ALTER TABLE "ApprovalFlowStep" ALTER COLUMN "approverRole" SET NOT NULL;

DROP INDEX IF EXISTS "ApprovalFlow_createdAt_idx";
DROP INDEX IF EXISTS "ApprovalFlow_category_isActive_idx";
ALTER TABLE "ApprovalFlow" DROP COLUMN IF EXISTS "updatedAt";
ALTER TABLE "ApprovalFlow" DROP COLUMN IF EXISTS "createdAt";
ALTER TABLE "ApprovalFlow" DROP COLUMN IF EXISTS "isActive";
ALTER TABLE "ApprovalFlow" DROP COLUMN IF EXISTS "maxAmount";
*/
