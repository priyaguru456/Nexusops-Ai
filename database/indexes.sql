-- NexusOps AI - Performance, Search & Vector Indexes

-- 1. Full-text search index on DocumentChunk content
CREATE INDEX IF NOT EXISTS "DocumentChunk_content_fts_idx" ON "DocumentChunk"
USING GIN (to_tsvector('english', content));

-- 2. HNSW vector index on DocumentChunk embedding for fast cosine similarity search
CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_hnsw_idx" ON "DocumentChunk"
USING hnsw (embedding vector_cosine_ops);

