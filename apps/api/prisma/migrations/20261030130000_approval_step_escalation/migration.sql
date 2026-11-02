-- Step 1: Add activatedAt and escalatedAt columns to ApprovalStep
ALTER TABLE "ApprovalStep" ADD COLUMN "activatedAt" TIMESTAMPTZ;
ALTER TABLE "ApprovalStep" ADD COLUMN "escalatedAt" TIMESTAMPTZ;

-- Step 2: Backfill existing active PENDING steps with their createdAt timestamp
UPDATE "ApprovalStep"
SET "activatedAt" = "createdAt"
WHERE "status" = 'PENDING'
  AND "activatedAt" IS NULL;

-- Step 3: Add composite index for efficient escalation queries
CREATE INDEX "ApprovalStep_status_activatedAt_escalatedAt_idx" 
ON "ApprovalStep"("status", "activatedAt", "escalatedAt");
