-- Migration: 20261105120000_add_expense_management
-- Description: Adds ExpenseClaim and ExpenseItem models with enums ExpenseStatus and ExpenseCategory.
-- Safety: Reversible migration. Always take a full database backup prior to running migrations in production.

-- UP Migration:

-- 1. Create Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseStatus') THEN
    CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseCategory') THEN
    CREATE TYPE "ExpenseCategory" AS ENUM ('TRAVEL', 'MEALS', 'SOFTWARE', 'OFFICE', 'OTHER');
  END IF;
END $$;

-- 2. Create ExpenseClaim Table
CREATE TABLE IF NOT EXISTS "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "employeeId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- 3. Create ExpenseItem Table
CREATE TABLE IF NOT EXISTS "ExpenseItem" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "receiptUrl" TEXT,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseItem_pkey" PRIMARY KEY ("id")
);

-- 4. Foreign Key Constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseClaim_employeeId_fkey') THEN
    ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseItem_claimId_fkey') THEN
    ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ExpenseClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseClaim_paymentReference_key" ON "ExpenseClaim"("paymentReference");
CREATE INDEX IF NOT EXISTS "ExpenseClaim_employeeId_idx" ON "ExpenseClaim"("employeeId");
CREATE INDEX IF NOT EXISTS "ExpenseClaim_status_idx" ON "ExpenseClaim"("status");
CREATE INDEX IF NOT EXISTS "ExpenseClaim_createdAt_idx" ON "ExpenseClaim"("createdAt");
CREATE INDEX IF NOT EXISTS "ExpenseClaim_paymentReference_idx" ON "ExpenseClaim"("paymentReference");

CREATE INDEX IF NOT EXISTS "ExpenseItem_claimId_idx" ON "ExpenseItem"("claimId");
CREATE INDEX IF NOT EXISTS "ExpenseItem_category_idx" ON "ExpenseItem"("category");
CREATE INDEX IF NOT EXISTS "ExpenseItem_date_idx" ON "ExpenseItem"("date");

-- DOWN Migration (Reference for rollback):
-- DROP TABLE IF EXISTS "ExpenseItem";
-- DROP TABLE IF EXISTS "ExpenseClaim";
-- DROP TYPE IF EXISTS "ExpenseCategory";
-- DROP TYPE IF EXISTS "ExpenseStatus";
