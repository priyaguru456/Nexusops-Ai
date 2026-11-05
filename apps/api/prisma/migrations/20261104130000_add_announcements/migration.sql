-- Migration: 20261104130000_add_announcements
-- Description: Create AnnouncementPriority enum, Announcement and AnnouncementRead tables with reversible rollback

-- UP Migration:
DO $$ BEGIN
    CREATE TYPE "AnnouncementPriority" AS ENUM ('NORMAL', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
    "targetDepartmentId" TEXT,
    "authorId" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AnnouncementRead" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- Unique pair: one read record per user per announcement
CREATE UNIQUE INDEX IF NOT EXISTS "AnnouncementRead_announcementId_userId_key" ON "AnnouncementRead"("announcementId", "userId");

-- Performance Indexes
CREATE INDEX IF NOT EXISTS "Announcement_isPinned_createdAt_idx" ON "Announcement"("isPinned", "createdAt");
CREATE INDEX IF NOT EXISTS "Announcement_targetDepartmentId_idx" ON "Announcement"("targetDepartmentId");
CREATE INDEX IF NOT EXISTS "Announcement_authorId_idx" ON "Announcement"("authorId");
CREATE INDEX IF NOT EXISTS "Announcement_priority_idx" ON "Announcement"("priority");
CREATE INDEX IF NOT EXISTS "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");
CREATE INDEX IF NOT EXISTS "AnnouncementRead_userId_idx" ON "AnnouncementRead"("userId");
CREATE INDEX IF NOT EXISTS "AnnouncementRead_announcementId_idx" ON "AnnouncementRead"("announcementId");

-- Foreign Keys
ALTER TABLE "Announcement" DROP CONSTRAINT IF EXISTS "Announcement_targetDepartmentId_fkey";
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_targetDepartmentId_fkey" FOREIGN KEY ("targetDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Announcement" DROP CONSTRAINT IF EXISTS "Announcement_authorId_fkey";
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AnnouncementRead" DROP CONSTRAINT IF EXISTS "AnnouncementRead_announcementId_fkey";
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnnouncementRead" DROP CONSTRAINT IF EXISTS "AnnouncementRead_userId_fkey";
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DOWN Migration (Reversible rollback commands):
-- ALTER TABLE "AnnouncementRead" DROP CONSTRAINT IF EXISTS "AnnouncementRead_userId_fkey";
-- ALTER TABLE "AnnouncementRead" DROP CONSTRAINT IF EXISTS "AnnouncementRead_announcementId_fkey";
-- ALTER TABLE "Announcement" DROP CONSTRAINT IF EXISTS "Announcement_authorId_fkey";
-- ALTER TABLE "Announcement" DROP CONSTRAINT IF EXISTS "Announcement_targetDepartmentId_fkey";
-- DROP TABLE IF EXISTS "AnnouncementRead";
-- DROP TABLE IF EXISTS "Announcement";
-- DROP TYPE IF EXISTS "AnnouncementPriority";
