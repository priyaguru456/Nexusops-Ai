import { Prisma, DocStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getEmbeddingsProvider, formatVectorForPg } from "../src/lib/embeddings";
import { logger } from "../src/lib/logger";

async function main() {
  console.log("=== NexusOps AI: Re-embedding Ready Documents ===");

  const provider = getEmbeddingsProvider();
  console.log(`Using embeddings provider: ${provider.modelName} (${provider.dimension} dimensions)`);

  // Find all chunks belonging to READY documents
  const chunks = await prisma.documentChunk.findMany({
    where: {
      document: {
        status: DocStatus.READY,
      },
    },
    select: {
      id: true,
      documentId: true,
      chunkIndex: true,
      content: true,
      document: {
        select: {
          title: true,
        },
      },
    },
    orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }],
  });

  if (chunks.length === 0) {
    console.log("No chunks found in READY documents. Nothing to embed.");
    process.exit(0);
  }

  console.log(`Found ${chunks.length} chunks across READY documents to evaluate.`);

  const batchSize = 64;
  let totalTokens = 0;
  let processed = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1} / ${Math.ceil(chunks.length / batchSize)} (${batch.length} chunks)...`);

    const texts = batch.map((c) => c.content);
    const { embeddings, tokensUsed } = await provider.embedBatch(texts, batchSize);
    totalTokens += tokensUsed;

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      const vectorStr = formatVectorForPg(embeddings[j]);

      await prisma.$executeRaw(
        Prisma.sql`UPDATE "DocumentChunk" SET "embedding" = ${vectorStr}::vector WHERE "id" = ${chunk.id}`
      );
      processed++;
    }
  }

  console.log(`\n Successfully re-embedded ${processed} chunks! Total tokens used: ${totalTokens}`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Re-embedding script encountered an error:", err);
  process.exit(1);
});
