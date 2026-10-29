-- NexusOps AI - Full PostgreSQL Schema
-- Generated from Prisma migrations

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Enums
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'MANAGER', 'ADMIN');
CREATE TYPE "RequestCategory" AS ENUM ('IT', 'HR', 'FINANCE', 'FACILITIES', 'OTHER');
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE');
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');
CREATE TYPE "DocVisibility" AS ENUM ('ALL', 'DEPARTMENT', 'MANAGERS', 'ADMIN_ONLY');
CREATE TYPE "DocStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'FAILED');
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- Tables

-- Department
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "departmentId" TEXT,
    "managerId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- RefreshToken
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- WorkRequest
CREATE TABLE "WorkRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "RequestCategory" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(12,2),
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requesterId" TEXT NOT NULL,

    CONSTRAINT "WorkRequest_pkey" PRIMARY KEY ("id")
);

-- RequestAttachment
CREATE TABLE "RequestAttachment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestAttachment_pkey" PRIMARY KEY ("id")
);

-- Task
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requestId" TEXT,
    "assigneeId" TEXT,
    "assignedById" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- Comment
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- ApprovalFlow
CREATE TABLE "ApprovalFlow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "RequestCategory" NOT NULL,
    "minAmount" DECIMAL(12,2),

    CONSTRAINT "ApprovalFlow_pkey" PRIMARY KEY ("id")
);

-- ApprovalFlowStep
CREATE TABLE "ApprovalFlowStep" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverRole" "Role" NOT NULL,

    CONSTRAINT "ApprovalFlowStep_pkey" PRIMARY KEY ("id")
);

-- ApprovalStep
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverRole" "Role" NOT NULL,
    "approverId" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- Document
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "category" TEXT,
    "visibility" "DocVisibility" NOT NULL DEFAULT 'ALL',
    "status" "DocStatus" NOT NULL DEFAULT 'UPLOADED',
    "errorMessage" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departmentId" TEXT,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- DocumentChunk
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "pageNumber" INTEGER,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- ChatSession
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- ChatMessage
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "tokensUsed" INTEGER,
    "latencyMs" INTEGER,
    "feedback" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- Notification
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Unique Constraints and Indexes
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX "WorkRequest_status_idx" ON "WorkRequest"("status");
CREATE INDEX "WorkRequest_requesterId_idx" ON "WorkRequest"("requesterId");
CREATE INDEX "WorkRequest_createdAt_idx" ON "WorkRequest"("createdAt");
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX "Task_createdAt_idx" ON "Task"("createdAt");
CREATE INDEX "Comment_entityType_entityId_idx" ON "Comment"("entityType", "entityId");
CREATE INDEX "Comment_createdAt_idx" ON "Comment"("createdAt");
CREATE UNIQUE INDEX "ApprovalFlowStep_flowId_stepOrder_key" ON "ApprovalFlowStep"("flowId", "stepOrder");
CREATE INDEX "ApprovalStep_status_idx" ON "ApprovalStep"("status");
CREATE INDEX "ApprovalStep_approverId_idx" ON "ApprovalStep"("approverId");
CREATE INDEX "ApprovalStep_createdAt_idx" ON "ApprovalStep"("createdAt");
CREATE UNIQUE INDEX "ApprovalStep_requestId_stepOrder_key" ON "ApprovalStep"("requestId", "stepOrder");
CREATE INDEX "Document_status_idx" ON "Document"("status");
CREATE INDEX "Document_uploadedById_idx" ON "Document"("uploadedById");
CREATE INDEX "Document_createdAt_idx" ON "Document"("createdAt");
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");
CREATE INDEX "DocumentChunk_createdAt_idx" ON "DocumentChunk"("createdAt");
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- Foreign Keys
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RequestAttachment" ADD CONSTRAINT "RequestAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WorkRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WorkRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalFlowStep" ADD CONSTRAINT "ApprovalFlowStep_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "ApprovalFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WorkRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
