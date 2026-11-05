-- Migration: 20261104160000_add_policy_compliance
-- Description: Add isPolicy, isMandatory, targetDepartmentId to Document and create Acknowledgement table with reversible rollback

-- UP Migration:
DO $$ BEGIN
    CREATE TYPE "PolicyCategory" AS ENUM ('HR', 'SECURITY', 'TRAVEL', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add policy fields to Document table
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "isPolicy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "isMandatory" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "targetDepartmentId" TEXT;

-- Create Acknowledgement table
CREATE TABLE IF NOT EXISTS "Acknowledgement" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Acknowledgement_pkey" PRIMARY KEY ("id")
);

-- Unique pair: one acknowledgement per user per document per version
CREATE UNIQUE INDEX IF NOT EXISTS "Acknowledgement_documentId_userId_version_key" ON "Acknowledgement"("documentId", "userId", "version");

-- Performance Indexes
CREATE INDEX IF NOT EXISTS "Document_isPolicy_idx" ON "Document"("isPolicy");
CREATE INDEX IF NOT EXISTS "Document_targetDepartmentId_idx" ON "Document"("targetDepartmentId");
CREATE INDEX IF NOT EXISTS "Acknowledgement_documentId_idx" ON "Acknowledgement"("documentId");
CREATE INDEX IF NOT EXISTS "Acknowledgement_userId_idx" ON "Acknowledgement"("userId");
CREATE INDEX IF NOT EXISTS "Acknowledgement_documentId_version_idx" ON "Acknowledgement"("documentId", "version");

-- Foreign Keys
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_targetDepartmentId_fkey";
ALTER TABLE "Document" ADD CONSTRAINT "Document_targetDepartmentId_fkey" FOREIGN KEY ("targetDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Acknowledgement" DROP CONSTRAINT IF EXISTS "Acknowledgement_documentId_fkey";
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Acknowledgement" DROP CONSTRAINT IF EXISTS "Acknowledgement_userId_fkey";
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DOWN Migration (Reversible rollback commands):
-- ALTER TABLE "Acknowledgement" DROP CONSTRAINT IF EXISTS "Acknowledgement_userId_fkey";
-- ALTER TABLE "Acknowledgement" DROP CONSTRAINT IF EXISTS "Acknowledgement_documentId_fkey";
-- ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_targetDepartmentId_fkey";
-- DROP INDEX IF EXISTS "Acknowledgement_documentId_version_idx";
-- DROP INDEX IF EXISTS "Acknowledgement_userId_idx";
-- DROP INDEX IF EXISTS "Acknowledgement_documentId_idx";
-- DROP INDEX IF EXISTS "Document_targetDepartmentId_idx";
-- DROP INDEX IF EXISTS "Document_isPolicy_idx";
-- DROP TABLE IF EXISTS "Acknowledgement";
-- ALTER TABLE "Document" DROP COLUMN IF EXISTS "targetDepartmentId";
-- ALTER TABLE "Document" DROP COLUMN IF EXISTS "isMandatory";
-- ALTER TABLE "Document" DROP COLUMN IF EXISTS "isPolicy";
-- DROP TYPE IF EXISTS "PolicyCategory";
