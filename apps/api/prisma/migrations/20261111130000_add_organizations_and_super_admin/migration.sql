-- AlterEnum: Add SUPER_ADMIN to Role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- CreateTable: Organization
CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX IF NOT EXISTS "Organization_isActive_idx" ON "Organization"("isActive");
CREATE INDEX IF NOT EXISTS "Organization_createdAt_idx" ON "Organization"("createdAt");

-- Seed deterministic Default Organization for existing single-tenant records
INSERT INTO "Organization" ("id", "name", "slug", "isActive", "createdAt", "updatedAt")
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'NexusOps Default',
    'default',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

-- Drop old global unique constraints that become tenant-scoped
DROP INDEX IF EXISTS "Department_name_key";
DROP INDEX IF EXISTS "Asset_serialNumber_key";
DROP INDEX IF EXISTS "Holiday_date_key";
DROP INDEX IF EXISTS "ExpenseClaim_paymentReference_key";

-- Step 1: Add nullable organizationId columns
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "WorkRequest" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "ApprovalFlow" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "ApprovalStep" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "ChatSession" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "LeaveBalance" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Holiday" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "ExpenseClaim" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "DigestSchedule" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Step 2: Backfill existing rows with the Default Organization
UPDATE "Department" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "User" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL AND "role" <> 'SUPER_ADMIN';
UPDATE "WorkRequest" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Task" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Comment" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ApprovalFlow" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ApprovalStep" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Document" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "DocumentChunk" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ChatSession" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Notification" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AuditLog" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Announcement" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Asset" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "LeaveBalance" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "LeaveRequest" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Holiday" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ExpenseClaim" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "DigestSchedule" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Survey" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;

-- Step 3: Enforce NOT NULL on tenant-bound tables
ALTER TABLE "Department" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "WorkRequest" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Comment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ApprovalFlow" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ApprovalStep" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Document" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "DocumentChunk" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ChatSession" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Notification" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Announcement" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Asset" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeaveBalance" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeaveRequest" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Holiday" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ExpenseClaim" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "DigestSchedule" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Survey" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "Department_organizationId_idx" ON "Department"("organizationId");
CREATE INDEX IF NOT EXISTS "User_organizationId_idx" ON "User"("organizationId");
CREATE INDEX IF NOT EXISTS "WorkRequest_organizationId_idx" ON "WorkRequest"("organizationId");
CREATE INDEX IF NOT EXISTS "Task_organizationId_idx" ON "Task"("organizationId");
CREATE INDEX IF NOT EXISTS "Comment_organizationId_idx" ON "Comment"("organizationId");
CREATE INDEX IF NOT EXISTS "ApprovalFlow_organizationId_idx" ON "ApprovalFlow"("organizationId");
CREATE INDEX IF NOT EXISTS "ApprovalStep_organizationId_idx" ON "ApprovalStep"("organizationId");
CREATE INDEX IF NOT EXISTS "Document_organizationId_idx" ON "Document"("organizationId");
CREATE INDEX IF NOT EXISTS "DocumentChunk_organizationId_idx" ON "DocumentChunk"("organizationId");
CREATE INDEX IF NOT EXISTS "ChatSession_organizationId_idx" ON "ChatSession"("organizationId");
CREATE INDEX IF NOT EXISTS "Notification_organizationId_idx" ON "Notification"("organizationId");
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");
CREATE INDEX IF NOT EXISTS "Announcement_organizationId_idx" ON "Announcement"("organizationId");
CREATE INDEX IF NOT EXISTS "Asset_organizationId_idx" ON "Asset"("organizationId");
CREATE INDEX IF NOT EXISTS "LeaveBalance_organizationId_idx" ON "LeaveBalance"("organizationId");
CREATE INDEX IF NOT EXISTS "LeaveRequest_organizationId_idx" ON "LeaveRequest"("organizationId");
CREATE INDEX IF NOT EXISTS "Holiday_organizationId_idx" ON "Holiday"("organizationId");
CREATE INDEX IF NOT EXISTS "ExpenseClaim_organizationId_idx" ON "ExpenseClaim"("organizationId");
CREATE INDEX IF NOT EXISTS "DigestSchedule_organizationId_idx" ON "DigestSchedule"("organizationId");
CREATE INDEX IF NOT EXISTS "Survey_organizationId_idx" ON "Survey"("organizationId");

-- Create tenant-scoped composite unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Department_organizationId_name_key" ON "Department"("organizationId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "Asset_organizationId_serialNumber_key" ON "Asset"("organizationId", "serialNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Holiday_organizationId_date_key" ON "Holiday"("organizationId", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseClaim_organizationId_paymentReference_key" ON "ExpenseClaim"("organizationId", "paymentReference");

-- AddForeignKeys
ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalFlow" ADD CONSTRAINT "ApprovalFlow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigestSchedule" ADD CONSTRAINT "DigestSchedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
