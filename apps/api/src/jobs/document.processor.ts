import { Prisma, DocStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { storageService } from "../lib/storage";
import { extractDocumentText } from "../lib/extractor";
import { cleanPages } from "../lib/textCleaner";
import { chunkDocument } from "../lib/chunker";
import { getEmbeddingsProvider, formatVectorForPg } from "../lib/embeddings";
import { logger } from "../lib/logger";

export async function processDocument(documentId: string): Promise<void> {
  logger.info({ documentId }, "Starting document ingestion pipeline");

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!doc) {
    throw new Error(`Document record not found for ID ${documentId}`);
  }

  // 1. Transition status to PROCESSING
  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: DocStatus.PROCESSING,
      errorMessage: null,
    },
  });

  // 2. Read file from storage abstraction
  const fileBuffer = await storageService.read(doc.filePath);

  // 3. Extract text per page
  const rawPages = await extractDocumentText(fileBuffer, doc.mimeType, doc.fileName);

  if (rawPages.length === 0) {
    throw new Error("No readable text could be extracted from the document.");
  }

  // 4. Clean text (remove repeated headers/footers, normalize whitespace)
  const cleanedPages = cleanPages(rawPages);

  if (cleanedPages.length === 0) {
    throw new Error("Document content is empty after cleaning.");
  }

  // 5. Chunk text (~800 tokens, ~12% overlap, preserving page numbers & continuous chunk index)
  const chunks = chunkDocument(doc.id, cleanedPages, {
    targetTokens: 800,
    overlapTokens: 96,
  });

  // 6. Delete existing chunks first to prevent duplicates (supports idempotent retries)
  await prisma.documentChunk.deleteMany({
    where: { documentId: doc.id },
  });

  // 7. Save initial chunks in database
  if (chunks.length > 0) {
    await prisma.documentChunk.createMany({
      data: chunks.map((chunk) => ({
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
      })),
    });
  }

  // 8. Generate and store vector embeddings via raw SQL (pgvector) in batches of ~64
  const createdChunks = await prisma.documentChunk.findMany({
    where: { documentId: doc.id },
    orderBy: { chunkIndex: "asc" },
    select: { id: true, content: true },
  });

  if (createdChunks.length > 0) {
    logger.info(
      { documentId: doc.id, chunkCount: createdChunks.length },
      "Generating vector embeddings for chunks in batches of 64"
    );

    const provider = getEmbeddingsProvider();
    const texts = createdChunks.map((c) => c.content);
    const { embeddings, tokensUsed } = await provider.embedBatch(texts, 64);

    if (embeddings.length !== createdChunks.length) {
      throw new Error(
        `Embedding count mismatch: expected ${createdChunks.length}, got ${embeddings.length}`
      );
    }

    // Store each vector in "DocumentChunk"."embedding" via pgvector raw SQL
    for (let i = 0; i < createdChunks.length; i++) {
      const chunkId = createdChunks[i].id;
      const vectorStr = formatVectorForPg(embeddings[i]);

      await prisma.$executeRaw(
        Prisma.sql`UPDATE "DocumentChunk" SET "embedding" = ${vectorStr}::vector WHERE "id" = ${chunkId}`
      );
    }

    logger.info(
      { documentId: doc.id, totalEmbedded: createdChunks.length, tokensUsed },
      "Vector embeddings generated and stored successfully"
    );

    // Verify all chunks have been embedded (no missing vectors)
    const missingCountRows: Array<{ count: bigint | number }> = await prisma.$queryRaw(
      Prisma.sql`SELECT COUNT(*) as count FROM "DocumentChunk" WHERE "documentId" = ${doc.id} AND "embedding" IS NULL`
    );
    const missingCount = Number(missingCountRows[0]?.count ?? 0);
    if (missingCount > 0) {
      throw new Error(
        `Embedding incomplete: ${missingCount} chunks are missing vector embeddings`
      );
    }
  }

  // 9. Mark document as READY only after all chunks are embedded
  await prisma.document.update({
    where: { id: doc.id },
    data: {
      status: DocStatus.READY,
      errorMessage: null,
    },
  });

  logger.info(
    { documentId: doc.id, chunkCount: chunks.length, pagesCount: cleanedPages.length },
    "Document ingestion and embedding completed successfully"
  );
}
