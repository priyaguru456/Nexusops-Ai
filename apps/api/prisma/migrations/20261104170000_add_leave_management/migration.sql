-- Migration: 20261104170000_add_leave_management
-- Description: Adds LeaveBalance, LeaveRequest, and Holiday models with enums LeaveType and LeaveStatus.
-- Safety: Reversible migration. Always take a full database backup prior to running migrations in production.

-- UP Migration:

-- 1. Create Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeaveType') THEN
    CREATE TYPE "LeaveType" AS ENUM ('CASUAL', 'SICK', 'ANNUAL', 'UNPAID');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeaveStatus') THEN
    CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
  END IF;
END $$;

-- 2. Create LeaveBalance Table
CREATE TABLE IF NOT EXISTS "LeaveBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "casualDays" INTEGER NOT NULL DEFAULT 12,
    "sickDays" INTEGER NOT NULL DEFAULT 12,
    "annualDays" INTEGER NOT NULL DEFAULT 15,
    "usedCasual" INTEGER NOT NULL DEFAULT 0,
    "usedSick" INTEGER NOT NULL DEFAULT 0,
    "usedAnnual" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- 3. Create LeaveRequest Table
CREATE TABLE IF NOT EXISTS "LeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "daysCount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- 4. Create Holiday Table
CREATE TABLE IF NOT EXISTS "Holiday" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- 5. Create Indexes & Unique Constraints
CREATE UNIQUE INDEX IF NOT EXISTS "LeaveBalance_userId_year_key" ON "LeaveBalance"("userId", "year");
CREATE INDEX IF NOT EXISTS "LeaveBalance_userId_idx" ON "LeaveBalance"("userId");
CREATE INDEX IF NOT EXISTS "LeaveBalance_year_idx" ON "LeaveBalance"("year");

CREATE INDEX IF NOT EXISTS "LeaveRequest_userId_idx" ON "LeaveRequest"("userId");
CREATE INDEX IF NOT EXISTS "LeaveRequest_status_idx" ON "LeaveRequest"("status");
CREATE INDEX IF NOT EXISTS "LeaveRequest_startDate_endDate_idx" ON "LeaveRequest"("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "LeaveRequest_createdAt_idx" ON "LeaveRequest"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Holiday_date_key" ON "Holiday"("date");
CREATE INDEX IF NOT EXISTS "Holiday_date_idx" ON "Holiday"("date");

-- 6. Add Foreign Keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeaveBalance_userId_fkey'
  ) THEN
    ALTER TABLE "LeaveBalance"
    ADD CONSTRAINT "LeaveBalance_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeaveRequest_userId_fkey'
  ) THEN
    ALTER TABLE "LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeaveRequest_approverId_fkey'
  ) THEN
    ALTER TABLE "LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_approverId_fkey"
    FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

/*
-- DOWN Migration (Reversible rollback commands):
-- ALTER TABLE "LeaveRequest" DROP CONSTRAINT IF EXISTS "LeaveRequest_approverId_fkey";
-- ALTER TABLE "LeaveRequest" DROP CONSTRAINT IF EXISTS "LeaveRequest_userId_fkey";
-- ALTER TABLE "LeaveBalance" DROP CONSTRAINT IF EXISTS "LeaveBalance_userId_fkey";
-- DROP TABLE IF EXISTS "Holiday";
-- DROP TABLE IF EXISTS "LeaveRequest";
-- DROP TABLE IF EXISTS "LeaveBalance";
-- DROP TYPE IF EXISTS "LeaveStatus";
-- DROP TYPE IF EXISTS "LeaveType";
*/
