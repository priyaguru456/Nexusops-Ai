import { env } from "../config/env";
import { logger } from "./logger";

/**
 * Single constant defining the vector embedding dimension across the platform.
 * Must match database column vector(1536).
 */
export const EMBEDDING_DIMENSION = 1536;

export interface EmbeddingResult {
  embeddings: number[][];
  tokensUsed: number;
}

export interface EmbeddingsProvider {
  readonly dimension: number;
  readonly modelName: string;
  embedQuery(text: string): Promise<number[]>;
  embedBatch(texts: string[], batchSize?: number): Promise<EmbeddingResult>;
}

export class OpenAIEmbeddingsProvider implements EmbeddingsProvider {
  public readonly dimension = EMBEDDING_DIMENSION;
  public readonly modelName: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(options?: { apiKey?: string; modelName?: string; baseUrl?: string }) {
    this.apiKey = options?.apiKey || env.OPENAI_API_KEY || env.EMBEDDING_API_KEY || "";
    this.modelName = options?.modelName || env.EMBEDDING_MODEL || "text-embedding-3-small";
    this.baseUrl = options?.baseUrl || "https://api.openai.com/v1";
  }

  private async callOpenAIWithRetry(
    input: string[],
    maxRetries = 3
  ): Promise<{ data: Array<{ embedding: number[]; index: number }>; usage?: { total_tokens: number } }> {
    if (!this.apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not configured in environment. Please set OPENAI_API_KEY in .env."
      );
    }

    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            input,
            model: this.modelName,
            dimensions: this.dimension,
          }),
        });

        if (response.status === 429) {
          // Rate limit encountered
          attempt++;
          const retryAfterHeader = response.headers.get("retry-after");
          const waitMs = retryAfterHeader
            ? parseInt(retryAfterHeader, 10) * 1000
            : Math.min(1000 * Math.pow(2, attempt), 8000);

          logger.warn(
            { attempt, maxRetries, waitMs },
            "OpenAI embeddings rate limit (429) reached, backing off"
          );

          if (attempt >= maxRetries) {
            throw new Error(`OpenAI rate limit exceeded after ${maxRetries} attempts`);
          }

          await new Promise((res) => setTimeout(res, waitMs));
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `OpenAI embedding API failed with status ${response.status}: ${errorBody}`
          );
        }

        const json = await response.json();
        return json;
      } catch (err: any) {
        if (err.message?.includes("rate limit") && attempt < maxRetries) {
          attempt++;
          const waitMs = Math.min(1000 * Math.pow(2, attempt), 8000);
          await new Promise((res) => setTimeout(res, waitMs));
          continue;
        }
        throw err;
      }
    }

    throw new Error(`OpenAI embeddings request failed after ${maxRetries} retries`);
  }

  public async embedQuery(text: string): Promise<number[]> {
    const trimmed = text.trim();
    if (!trimmed) {
      return new Array(this.dimension).fill(0);
    }

    const res = await this.callOpenAIWithRetry([trimmed]);
    if (!res.data || res.data.length === 0) {
      throw new Error("No embedding returned from OpenAI");
    }

    const vector = res.data[0].embedding;
    if (vector.length !== this.dimension) {
      throw new Error(
        `OpenAI returned embedding of dimension ${vector.length}, expected ${this.dimension}`
      );
    }

    return vector;
  }

  public async embedBatch(
    texts: string[],
    batchSize = 64
  ): Promise<EmbeddingResult> {
    if (!texts || texts.length === 0) {
      return { embeddings: [], tokensUsed: 0 };
    }

    const allEmbeddings: number[][] = [];
    let totalTokens = 0;

    // Process in sub-batches of about 64 chunks
    for (let i = 0; i < texts.length; i += batchSize) {
      const slice = texts.slice(i, i + batchSize).map((t) => t.trim() || " ");
      const res = await this.callOpenAIWithRetry(slice);

      // Order embeddings by index returned
      const sortedBatch = res.data
        .sort((a, b) => a.index - b.index)
        .map((item) => {
          if (item.embedding.length !== this.dimension) {
            throw new Error(
              `Embedding returned dimension ${item.embedding.length}, expected ${this.dimension}`
            );
          }
          return item.embedding;
        });

      allEmbeddings.push(...sortedBatch);
      totalTokens += res.usage?.total_tokens ?? 0;
    }

    return {
      embeddings: allEmbeddings,
      tokensUsed: totalTokens,
    };
  }
}

/**
 * Mock embeddings provider for automated tests and offline environments.
 * Generates deterministic fake vectors matching EMBEDDING_DIMENSION.
 */
export class MockEmbeddingsProvider implements EmbeddingsProvider {
  public readonly dimension = EMBEDDING_DIMENSION;
  public readonly modelName = "mock-embedding";
  public lastQuery?: string;

  public async embedQuery(text: string): Promise<number[]> {
    this.lastQuery = text;
    return this.generateDeterministicVector(text);
  }

  public async embedBatch(texts: string[], _batchSize?: number): Promise<EmbeddingResult> {
    const embeddings = texts.map((t) => this.generateDeterministicVector(t));
    return {
      embeddings,
      tokensUsed: texts.length * 50,
    };
  }

  public generateDeterministicVector(seedText: string): number[] {
    const vector = new Array(this.dimension).fill(0);
    let hash = 0;
    for (let i = 0; i < seedText.length; i++) {
      hash = (hash << 5) - hash + seedText.charCodeAt(i);
      hash |= 0;
    }

    for (let i = 0; i < this.dimension; i++) {
      // Deterministic float in range [-1, 1]
      const val = Math.sin((hash + i) * 0.1);
      vector[i] = parseFloat(val.toFixed(6));
    }

    // Normalize vector to unit length for cosine distance
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return norm === 0 ? vector : vector.map((v) => parseFloat((v / norm).toFixed(6)));
  }
}

/**
 * Converts a number[] vector into a PostgreSQL pgvector string format: '[0.1,0.2,...]'
 */
export function formatVectorForPg(vector: number[]): string {
  if (vector.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Vector dimension mismatch: expected ${EMBEDDING_DIMENSION}, got ${vector.length}`
    );
  }
  return `[${vector.join(",")}]`;
}

let activeEmbeddingsProvider: EmbeddingsProvider = new OpenAIEmbeddingsProvider();

export function getEmbeddingsProvider(): EmbeddingsProvider {
  return activeEmbeddingsProvider;
}

export function setEmbeddingsProvider(provider: EmbeddingsProvider): void {
  activeEmbeddingsProvider = provider;
}
