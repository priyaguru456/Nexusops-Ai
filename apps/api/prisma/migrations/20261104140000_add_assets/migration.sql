-- Migration: 20261104140000_add_assets
-- Description: Create AssetType and AssetStatus enums, Asset and AssetAssignment tables with reversible rollback

-- UP Migration:
DO $$ BEGIN
    CREATE TYPE "AssetType" AS ENUM ('LAPTOP', 'MONITOR', 'PHONE', 'LICENSE', 'ACCESSORY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'IN_REPAIR', 'RETIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Asset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "serialNumber" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "purchaseDate" TIMESTAMP(3),
    "warrantyExpiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssetAssignment" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "assignedById" TEXT NOT NULL,
    "requestId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAssignment_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on serialNumber
CREATE UNIQUE INDEX IF NOT EXISTS "Asset_serialNumber_key" ON "Asset"("serialNumber");

-- Performance Indexes on Asset
CREATE INDEX IF NOT EXISTS "Asset_status_idx" ON "Asset"("status");
CREATE INDEX IF NOT EXISTS "Asset_type_idx" ON "Asset"("type");
CREATE INDEX IF NOT EXISTS "Asset_createdAt_idx" ON "Asset"("createdAt");
CREATE INDEX IF NOT EXISTS "Asset_warrantyExpiresAt_idx" ON "Asset"("warrantyExpiresAt");

-- Performance Indexes on AssetAssignment
CREATE INDEX IF NOT EXISTS "AssetAssignment_assetId_idx" ON "AssetAssignment"("assetId");
CREATE INDEX IF NOT EXISTS "AssetAssignment_userId_idx" ON "AssetAssignment"("userId");
CREATE INDEX IF NOT EXISTS "AssetAssignment_requestId_idx" ON "AssetAssignment"("requestId");
CREATE INDEX IF NOT EXISTS "AssetAssignment_assignedById_idx" ON "AssetAssignment"("assignedById");
CREATE INDEX IF NOT EXISTS "AssetAssignment_returnedAt_idx" ON "AssetAssignment"("returnedAt");
CREATE INDEX IF NOT EXISTS "AssetAssignment_assignedAt_idx" ON "AssetAssignment"("assignedAt");

-- Foreign Keys
ALTER TABLE "AssetAssignment" DROP CONSTRAINT IF EXISTS "AssetAssignment_assetId_fkey";
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssetAssignment" DROP CONSTRAINT IF EXISTS "AssetAssignment_userId_fkey";
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssetAssignment" DROP CONSTRAINT IF EXISTS "AssetAssignment_assignedById_fkey";
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssetAssignment" DROP CONSTRAINT IF EXISTS "AssetAssignment_requestId_fkey";
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WorkRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DOWN Migration (Reversible rollback commands):
-- ALTER TABLE "AssetAssignment" DROP CONSTRAINT IF EXISTS "AssetAssignment_requestId_fkey";
-- ALTER TABLE "AssetAssignment" DROP CONSTRAINT IF EXISTS "AssetAssignment_assignedById_fkey";
-- ALTER TABLE "AssetAssignment" DROP CONSTRAINT IF EXISTS "AssetAssignment_userId_fkey";
-- ALTER TABLE "AssetAssignment" DROP CONSTRAINT IF EXISTS "AssetAssignment_assetId_fkey";
-- DROP TABLE IF EXISTS "AssetAssignment";
-- DROP TABLE IF EXISTS "Asset";
-- DROP TYPE IF EXISTS "AssetStatus";
-- DROP TYPE IF EXISTS "AssetType";
