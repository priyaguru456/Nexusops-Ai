-- Migration: 20261105130000_add_analytics_digest_schedule
-- Description: Adds DigestSchedule and DigestDelivery models for scheduled analytics email digests.
-- Safety: Reversible migration. Always take a full database backup prior to running migrations in production.

-- UP Migration:

-- 1. Create Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DigestFrequency') THEN
    CREATE TYPE "DigestFrequency" AS ENUM ('WEEKLY');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DigestDeliveryStatus') THEN
    CREATE TYPE "DigestDeliveryStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');
  END IF;
END $$;

-- 2. Create DigestSchedule Table
CREATE TABLE IF NOT EXISTS "DigestSchedule" (
    "id" TEXT NOT NULL,
    "recipients" TEXT[] NOT NULL,
    "frequency" "DigestFrequency" NOT NULL DEFAULT 'WEEKLY',
    "dayOfWeek" INTEGER NOT NULL,
    "hour" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigestSchedule_pkey" PRIMARY KEY ("id")
);

-- 3. Create DigestDelivery Table
CREATE TABLE IF NOT EXISTS "DigestDelivery" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DigestDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigestDelivery_pkey" PRIMARY KEY ("id")
);

-- 4. Foreign Key Constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DigestSchedule_createdBy_fkey') THEN
    ALTER TABLE "DigestSchedule" ADD CONSTRAINT "DigestSchedule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DigestDelivery_scheduleId_fkey') THEN
    ALTER TABLE "DigestDelivery" ADD CONSTRAINT "DigestDelivery_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "DigestSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS "DigestSchedule_isActive_idx" ON "DigestSchedule"("isActive");
CREATE INDEX IF NOT EXISTS "DigestSchedule_createdBy_idx" ON "DigestSchedule"("createdBy");

CREATE INDEX IF NOT EXISTS "DigestDelivery_scheduleId_idx" ON "DigestDelivery"("scheduleId");
CREATE INDEX IF NOT EXISTS "DigestDelivery_status_idx" ON "DigestDelivery"("status");
CREATE INDEX IF NOT EXISTS "DigestDelivery_sentAt_idx" ON "DigestDelivery"("sentAt");

-- DOWN Migration (Reference for rollback):
-- DROP TABLE IF EXISTS "DigestDelivery";
-- DROP TABLE IF EXISTS "DigestSchedule";
-- DROP TYPE IF EXISTS "DigestDeliveryStatus";
-- DROP TYPE IF EXISTS "DigestFrequency";
