import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { getEmbeddingsProvider, formatVectorForPg } from "../../lib/embeddings";
import { AuthenticatedUser } from "../../types/express";
import { logger } from "../../lib/logger";

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  pageNumber: number | null;
  content: string;
  tokenCount: number | null;
  similarityScore: number; // 1 - cosine distance
  cosineDistance?: number;
  textRank?: number;
  fusedScore?: number;
}

export interface RetrievalOptions {
  topK?: number;
  hybrid?: boolean;
}

/**
 * Builds the parameterized SQL WHERE fragment that strictly enforces document RBAC and visibility rules.
 *
 * Rules:
 * - Only documents with status 'READY' are eligible.
 * - ADMIN: Access to all READY documents.
 * - MANAGER: Access to ALL, MANAGERS, documents from their own department, and documents they uploaded.
 * - EMPLOYEE: Access to ALL, documents from their own department, and documents they uploaded.
 * - ADMIN_ONLY documents are strictly restricted to ADMIN (or uploader).
 */
export function buildPermissionFilterSql(user: {
  id: string;
  role: Role;
  departmentId: string | null;
}): Prisma.Sql {
  if (user.role === Role.ADMIN) {
    return Prisma.sql`TRUE`;
  }

  if (user.role === Role.MANAGER) {
    if (user.departmentId) {
      return Prisma.sql`(
        d."visibility"::text = 'ALL'
        OR d."visibility"::text = 'MANAGERS'
        OR (d."visibility"::text = 'DEPARTMENT' AND d."departmentId" = ${user.departmentId})
        OR d."uploadedById" = ${user.id}
      )`;
    } else {
      return Prisma.sql`(
        d."visibility"::text = 'ALL'
        OR d."visibility"::text = 'MANAGERS'
        OR d."uploadedById" = ${user.id}
      )`;
    }
  }

  // Role.EMPLOYEE
  if (user.departmentId) {
    return Prisma.sql`(
      d."visibility"::text = 'ALL'
      OR (d."visibility"::text = 'DEPARTMENT' AND d."departmentId" = ${user.departmentId})
      OR d."uploadedById" = ${user.id}
    )`;
  } else {
    return Prisma.sql`(
      d."visibility"::text = 'ALL'
      OR d."uploadedById" = ${user.id}
    )`;
  }
}

/**
 * Reciprocal Rank Fusion (RRF) algorithm to combine rank positions from vector and full-text searches.
 * Standard k parameter = 60.
 */
export function reciprocalRankFusion(
  vectorResults: RetrievedChunk[],
  textResults: RetrievedChunk[],
  k = 60,
  topK = 8
): RetrievedChunk[] {
  const chunkMap = new Map<
    string,
    {
      chunk: RetrievedChunk;
      fusedScore: number;
      vectorRank?: number;
      textRank?: number;
    }
  >();

  // Add vector search ranks
  vectorResults.forEach((chunk, index) => {
    const rank = index + 1;
    const rrfScore = 1 / (k + rank);

    chunkMap.set(chunk.id, {
      chunk: { ...chunk },
      fusedScore: rrfScore,
      vectorRank: rank,
    });
  });

  // Add full-text search ranks
  textResults.forEach((chunk, index) => {
    const rank = index + 1;
    const rrfScore = 1 / (k + rank);

    const existing = chunkMap.get(chunk.id);
    if (existing) {
      existing.fusedScore += rrfScore;
      existing.textRank = rank;
      // If text query provided higher textRank, keep it
      if (chunk.textRank !== undefined) {
        existing.chunk.textRank = chunk.textRank;
      }
    } else {
      chunkMap.set(chunk.id, {
        chunk: { ...chunk, similarityScore: 0 },
        fusedScore: rrfScore,
        textRank: rank,
      });
    }
  });

  // Sort by fused score descending
  const sorted = Array.from(chunkMap.values()).sort(
    (a, b) => b.fusedScore - a.fusedScore
  );

  return sorted.slice(0, topK).map((entry) => ({
    ...entry.chunk,
    fusedScore: parseFloat(entry.fusedScore.toFixed(6)),
  }));
}

export const retrievalService = {
  /**
   * Cosine-similarity vector search against pgvector.
   * Cosine distance in pgvector is (<=>). Cosine similarity = 1 - distance.
   */
  async searchVectors(
    questionVector: number[],
    user: { id: string; role: Role; departmentId: string | null },
    limit = 8
  ): Promise<RetrievedChunk[]> {
    try {
      const vectorStr = formatVectorForPg(questionVector);
      const permissionFilter = buildPermissionFilterSql(user);

      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          documentId: string;
          chunkIndex: number;
          pageNumber: number | null;
          content: string;
          tokenCount: number | null;
          documentTitle: string;
          similarityScore: number | string;
          cosineDistance: number | string;
        }>
      >(
        Prisma.sql`
          SELECT 
            c."id",
            c."documentId",
            c."chunkIndex",
            c."pageNumber",
            c."content",
            c."tokenCount",
            d."title" as "documentTitle",
            (1 - (c."embedding" <=> ${vectorStr}::vector)) as "similarityScore",
            (c."embedding" <=> ${vectorStr}::vector) as "cosineDistance"
          FROM "DocumentChunk" c
          JOIN "Document" d ON c."documentId" = d."id"
          WHERE d."status"::text = 'READY'
            AND c."embedding" IS NOT NULL
            AND ${permissionFilter}
          ORDER BY c."embedding" <=> ${vectorStr}::vector ASC
          LIMIT ${limit};
        `
      );

      return rows.map((row) => ({
        id: row.id,
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        chunkIndex: row.chunkIndex,
        pageNumber: row.pageNumber,
        content: row.content,
        tokenCount: row.tokenCount,
        similarityScore: parseFloat(Number(row.similarityScore).toFixed(4)),
        cosineDistance: parseFloat(Number(row.cosineDistance).toFixed(4)),
      }));
    } catch (err) {
      logger.warn(
        { err },
        "Vector search query failed or pgvector extension is unavailable, returning empty"
      );
      return [];
    }
  },

  /**
   * PostgreSQL Full-Text Search against the GIN index using websearch_to_tsquery.
   */
  async searchFullText(
    queryText: string,
    user: { id: string; role: Role; departmentId: string | null },
    limit = 8
  ): Promise<RetrievedChunk[]> {
    const trimmed = queryText.trim();
    if (!trimmed) return [];

    const permissionFilter = buildPermissionFilterSql(user);

    try {
      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          documentId: string;
          chunkIndex: number;
          pageNumber: number | null;
          content: string;
          tokenCount: number | null;
          documentTitle: string;
          textRank: number | string;
        }>
      >(
        Prisma.sql`
          SELECT 
            c."id",
            c."documentId",
            c."chunkIndex",
            c."pageNumber",
            c."content",
            c."tokenCount",
            d."title" as "documentTitle",
            ts_rank(to_tsvector('english', c."content"), websearch_to_tsquery('english', ${trimmed})) as "textRank"
          FROM "DocumentChunk" c
          JOIN "Document" d ON c."documentId" = d."id"
          WHERE d."status"::text = 'READY'
            AND to_tsvector('english', c."content") @@ websearch_to_tsquery('english', ${trimmed})
            AND ${permissionFilter}
          ORDER BY "textRank" DESC
          LIMIT ${limit};
        `
      );

      return rows.map((row) => ({
        id: row.id,
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        chunkIndex: row.chunkIndex,
        pageNumber: row.pageNumber,
        content: row.content,
        tokenCount: row.tokenCount,
        similarityScore: 0,
        textRank: parseFloat(Number(row.textRank).toFixed(4)),
      }));
    } catch (err) {
      logger.warn({ err, queryText }, "Full-text search query failed, returning empty");
      return [];
    }
  },

  /**
   * Hybrid retrieval combining vector search and full-text keyword search via Reciprocal Rank Fusion.
   */
  async retrieve(
    question: string,
    user: { id: string; role: Role; departmentId: string | null },
    options?: RetrievalOptions
  ): Promise<{
    results: RetrievedChunk[];
    vectorCount: number;
    textCount: number;
  }> {
    const topK = options?.topK ?? 8;
    const isHybrid = options?.hybrid ?? true;

    // 1. Embed question vector
    const provider = getEmbeddingsProvider();
    const questionVector = await provider.embedQuery(question);

    // 2. Vector search (fetch up to topK * 2 for fusion pool)
    const vectorCandidates = await this.searchVectors(
      questionVector,
      user,
      isHybrid ? topK * 2 : topK
    );

    if (!isHybrid) {
      return {
        results: vectorCandidates.slice(0, topK),
        vectorCount: vectorCandidates.length,
        textCount: 0,
      };
    }

    // 3. Full-Text search candidates
    const textCandidates = await this.searchFullText(question, user, topK * 2);

    // 4. Reciprocal Rank Fusion
    const fused = reciprocalRankFusion(vectorCandidates, textCandidates, 60, topK);

    return {
      results: fused,
      vectorCount: vectorCandidates.length,
      textCount: textCandidates.length,
    };
  },
};
