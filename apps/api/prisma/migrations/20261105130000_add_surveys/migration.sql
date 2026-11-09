-- Migration: 20261105130000_add_surveys
-- Description: Adds Survey and SurveyResponse models for internal satisfaction surveys (CSAT).
-- Safety: Reversible migration. Always take a full database backup prior to running migrations in production.

-- UP Migration:

-- 1. Create Survey Table
CREATE TABLE IF NOT EXISTS "Survey" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetRole" "Role",
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- 2. Create SurveyResponse Table
CREATE TABLE IF NOT EXISTS "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'REQUEST',
    "entityId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- 3. Create Indexes & Unique Constraints
CREATE INDEX IF NOT EXISTS "Survey_isActive_idx" ON "Survey"("isActive");
CREATE INDEX IF NOT EXISTS "Survey_targetRole_idx" ON "Survey"("targetRole");
CREATE INDEX IF NOT EXISTS "Survey_createdAt_idx" ON "Survey"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "SurveyResponse_userId_entityType_entityId_key" ON "SurveyResponse"("userId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "SurveyResponse_surveyId_idx" ON "SurveyResponse"("surveyId");
CREATE INDEX IF NOT EXISTS "SurveyResponse_userId_idx" ON "SurveyResponse"("userId");
CREATE INDEX IF NOT EXISTS "SurveyResponse_entityType_entityId_idx" ON "SurveyResponse"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "SurveyResponse_createdAt_idx" ON "SurveyResponse"("createdAt");

-- 4. Add Foreign Keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SurveyResponse_surveyId_fkey'
  ) THEN
    ALTER TABLE "SurveyResponse"
    ADD CONSTRAINT "SurveyResponse_surveyId_fkey"
    FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SurveyResponse_userId_fkey'
  ) THEN
    ALTER TABLE "SurveyResponse"
    ADD CONSTRAINT "SurveyResponse_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

/*
-- DOWN Migration (Reversible rollback commands):
-- ALTER TABLE "SurveyResponse" DROP CONSTRAINT IF EXISTS "SurveyResponse_userId_fkey";
-- ALTER TABLE "SurveyResponse" DROP CONSTRAINT IF EXISTS "SurveyResponse_surveyId_fkey";
-- DROP TABLE IF EXISTS "SurveyResponse";
-- DROP TABLE IF EXISTS "Survey";
*/
