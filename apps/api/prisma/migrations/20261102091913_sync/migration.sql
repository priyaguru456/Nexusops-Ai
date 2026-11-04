-- DropIndex
DROP INDEX "DocumentChunk_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "ApprovalStep" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "activatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "escalatedAt" SET DATA TYPE TIMESTAMP(3);
