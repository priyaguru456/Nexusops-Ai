-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Convert DocumentChunk embedding column to vector(1536)
ALTER TABLE "DocumentChunk" 
  ALTER COLUMN "embedding" TYPE vector(1536) 
  USING CASE 
    WHEN "embedding" IS NULL THEN NULL 
    ELSE "embedding"::text::vector 
  END;

-- Step 3: Create HNSW index on DocumentChunk embedding for cosine distance
CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_hnsw_idx" 
  ON "DocumentChunk" 
  USING hnsw (embedding vector_cosine_ops);

-- Step 4: Ensure GIN full-text index on DocumentChunk content
CREATE INDEX IF NOT EXISTS "DocumentChunk_content_fts_idx" 
  ON "DocumentChunk" 
  USING GIN (to_tsvector('english', content));

-- Step 5: Add missing columns and indexes to ApprovalStep
ALTER TABLE "ApprovalStep" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ApprovalStep" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Step 6: Add performance and status/assignee/created_at indexes
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");

CREATE INDEX IF NOT EXISTS "Task_createdAt_idx" ON "Task"("createdAt");

CREATE INDEX IF NOT EXISTS "Comment_createdAt_idx" ON "Comment"("createdAt");

CREATE INDEX IF NOT EXISTS "ApprovalStep_approverId_idx" ON "ApprovalStep"("approverId");
CREATE INDEX IF NOT EXISTS "ApprovalStep_createdAt_idx" ON "ApprovalStep"("createdAt");

CREATE INDEX IF NOT EXISTS "Document_uploadedById_idx" ON "Document"("uploadedById");
CREATE INDEX IF NOT EXISTS "Document_createdAt_idx" ON "Document"("createdAt");

CREATE INDEX IF NOT EXISTS "DocumentChunk_createdAt_idx" ON "DocumentChunk"("createdAt");

CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");
