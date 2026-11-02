-- AlterTable: WorkRequest add submittedAt and completedAt
ALTER TABLE "WorkRequest" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "WorkRequest" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- AlterTable: Task add completedAt
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- AlterTable: ChatMessage add notFound, inputTokens, outputTokens
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "notFound" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "inputTokens" INTEGER;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "outputTokens" INTEGER;

-- CreateIndex: Performance and composite query indexes
CREATE INDEX IF NOT EXISTS "WorkRequest_status_createdAt_idx" ON "WorkRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkRequest_requesterId_createdAt_idx" ON "WorkRequest"("requesterId", "createdAt");
CREATE INDEX IF NOT EXISTS "ApprovalStep_approverId_status_decidedAt_idx" ON "ApprovalStep"("approverId", "status", "decidedAt");
CREATE INDEX IF NOT EXISTS "Task_status_dueDate_idx" ON "Task"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");
CREATE INDEX IF NOT EXISTS "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_notFound_idx" ON "ChatMessage"("notFound");

-- Backfill WorkRequest.submittedAt from AuditLog
UPDATE "WorkRequest" wr
SET "submittedAt" = al."createdAt"
FROM "AuditLog" al
WHERE al."entityType" = 'WorkRequest'
  AND al."entityId" = wr.id
  AND al.action = 'REQUEST_SUBMITTED'
  AND wr."submittedAt" IS NULL;

-- Fallback WorkRequest.submittedAt from earliest ApprovalStep
UPDATE "WorkRequest" wr
SET "submittedAt" = sub.earliest_step
FROM (
  SELECT "requestId", MIN("createdAt") AS earliest_step
  FROM "ApprovalStep"
  GROUP BY "requestId"
) sub
WHERE sub."requestId" = wr.id
  AND wr."submittedAt" IS NULL;

-- Fallback WorkRequest.submittedAt for submitted/approved/completed requests without log
UPDATE "WorkRequest"
SET "submittedAt" = "createdAt"
WHERE "status" NOT IN ('DRAFT') AND "submittedAt" IS NULL;

-- Backfill WorkRequest.completedAt from AuditLog
UPDATE "WorkRequest" wr
SET "completedAt" = al."createdAt"
FROM "AuditLog" al
WHERE al."entityType" = 'WorkRequest'
  AND al."entityId" = wr.id
  AND al.action = 'REQUEST_STATUS_UPDATED'
  AND al.metadata->>'newStatus' = 'COMPLETED'
  AND wr."completedAt" IS NULL;

-- Fallback WorkRequest.completedAt for COMPLETED requests
UPDATE "WorkRequest"
SET "completedAt" = "updatedAt"
WHERE "status" = 'COMPLETED' AND "completedAt" IS NULL;

-- Backfill Task.completedAt from AuditLog
UPDATE "Task" t
SET "completedAt" = al."createdAt"
FROM "AuditLog" al
WHERE al."entityType" = 'Task'
  AND al."entityId" = t.id
  AND al.action = 'TASK_STATUS_UPDATED'
  AND al.metadata->>'newStatus' = 'DONE'
  AND t."completedAt" IS NULL;

-- Fallback Task.completedAt for DONE tasks
UPDATE "Task"
SET "completedAt" = "updatedAt"
WHERE "status" = 'DONE' AND "completedAt" IS NULL;

-- Backfill ChatMessage.notFound flag
UPDATE "ChatMessage"
SET "notFound" = true
WHERE "content" = 'I couldn''t find this in the company documents.'
  AND "notFound" = false;
