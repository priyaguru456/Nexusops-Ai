/**
 * Document Chunker Module
 *
 * Provides a pure function for chunking extracted document text into semantic windows
 * with configurable token targets and overlap percentages.
 *
 * Pagination Choice Documentation:
 * - PDF documents provide native page structures; each page's text is extracted with its real page number (1, 2, ...).
 * - DOCX, TXT, and MD formats do not possess inherent page demarcations.
 *   For these formats, pageNumber is consistently set to 1 to represent the single primary document scope.
 */

export interface RawPageText {
  /** 1-based page number (PDF real page; 1 consistently for DOCX/TXT/MD) */
  pageNumber: number;
  text: string;
}

export interface ChunkOptions {
  /** Target token size per chunk (~800 tokens by default) */
  targetTokens?: number;
  /** Overlap token size (~12% of targetTokens = ~96 tokens by default) */
  overlapTokens?: number;
}

export interface DocumentChunkResult {
  documentId: string;
  chunkIndex: number;
  pageNumber: number;
  content: string;
  tokenCount: number;
}

/**
 * Pure function: Heuristic token count estimator (~1.3 tokens per word or ~4 chars per token).
 */
export function estimateTokenCount(text: string): number {
  if (!text || !text.trim()) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  // Blend word count with character length for accurate token representation
  const wordTokens = Math.round(words.length * 1.3);
  const charTokens = Math.round(text.length / 4);
  return Math.max(1, Math.round((wordTokens + charTokens) / 2));
}

/**
 * Splits text into units (paragraphs and sentences) while preserving natural delimiters.
 */
function splitIntoUnits(text: string): string[] {
  // First split by paragraph breaks
  const paragraphs = text.split(/\n\n+/);
  const units: string[] = [];

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    // Split sentences within paragraph using punctuation lookbehinds
    const sentences = trimmedPara
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const sentence of sentences) {
      // If a single sentence is excessively long (> 120 words), split by words
      const words = sentence.split(/\s+/).filter(Boolean);
      if (words.length > 120) {
        for (let i = 0; i < words.length; i += 80) {
          units.push(words.slice(i, i + 80).join(" "));
        }
      } else {
        units.push(sentence);
      }
    }
  }

  return units;
}

/**
 * Pure function: Chunks an array of page texts for a given document.
 *
 * @param documentId Document identifier
 * @param pages Array of extracted pages with page numbers and text
 * @param options Target token size (~800) and overlap size (~12%)
 * @returns Array of DocumentChunkResult with continuous chunkIndex
 */
export function chunkDocument(
  documentId: string,
  pages: RawPageText[],
  options?: ChunkOptions
): DocumentChunkResult[] {
  const targetTokens = options?.targetTokens ?? 800;
  const overlapTokens = options?.overlapTokens ?? Math.round(targetTokens * 0.12); // ~96 tokens (12%)

  const chunks: DocumentChunkResult[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const pageText = (page.text || "").trim();
    if (!pageText) continue;

    const pageTotalTokens = estimateTokenCount(pageText);

    // If the entire page fits within the target token window, emit as a single chunk
    if (pageTotalTokens <= targetTokens) {
      chunks.push({
        documentId,
        chunkIndex: chunkIndex++,
        pageNumber: page.pageNumber,
        content: pageText,
        tokenCount: pageTotalTokens,
      });
      continue;
    }

    // Otherwise, split the page content into units and slide with overlap
    const units = splitIntoUnits(pageText);
    if (units.length === 0) continue;

    let unitIndex = 0;

    while (unitIndex < units.length) {
      const currentUnits: string[] = [];
      let currentTokens = 0;
      let nextStartIndex = unitIndex + 1;
      let foundOverlapIndex = -1;

      for (let i = unitIndex; i < units.length; i++) {
        const unit = units[i];
        const unitTokens = estimateTokenCount(unit);

        if (currentTokens + unitTokens > targetTokens && currentUnits.length > 0) {
          // Chunk is full
          break;
        }

        currentUnits.push(unit);
        currentTokens += unitTokens;
        nextStartIndex = i + 1;
      }

      const chunkContent = currentUnits.join(" ").trim();
      const finalTokenCount = estimateTokenCount(chunkContent);

      chunks.push({
        documentId,
        chunkIndex: chunkIndex++,
        pageNumber: page.pageNumber,
        content: chunkContent,
        tokenCount: finalTokenCount,
      });

      // Calculate overlap starting index for next chunk
      // Count backwards from nextStartIndex until overlapTokens are gathered
      let overlapAccumulator = 0;
      for (let j = nextStartIndex - 1; j > unitIndex; j--) {
        overlapAccumulator += estimateTokenCount(units[j]);
        if (overlapAccumulator >= overlapTokens) {
          foundOverlapIndex = j;
          break;
        }
      }

      if (foundOverlapIndex !== -1 && foundOverlapIndex < nextStartIndex) {
        unitIndex = foundOverlapIndex;
      } else {
        unitIndex = nextStartIndex;
      }
    }
  }

  return chunks;
}
