import { describe, it, expect } from "vitest";
import { chunkDocument, estimateTokenCount, RawPageText } from "../src/lib/chunker";
import { cleanPages, normalizeWhitespace } from "../src/lib/textCleaner";

describe("Document Chunker & Text Cleaning Unit Tests", () => {
  describe("estimateTokenCount()", () => {
    it("returns 0 for empty or whitespace-only strings", () => {
      expect(estimateTokenCount("")).toBe(0);
      expect(estimateTokenCount("   \n\t  ")).toBe(0);
    });

    it("estimates reasonable token count for sentences", () => {
      const text = "The quick brown fox jumps over the lazy dog.";
      const count = estimateTokenCount(text);
      expect(count).toBeGreaterThan(5);
      expect(count).toBeLessThan(20);
    });
  });

  describe("chunkDocument() pure function", () => {
    const documentId = "doc-uuid-1234-5678";

    it("returns an empty array when pages array is empty or content is blank", () => {
      expect(chunkDocument(documentId, [])).toEqual([]);
      expect(chunkDocument(documentId, [{ pageNumber: 1, text: "   " }])).toEqual([]);
    });

    it("preserves documentId and pageNumber for single-page input below target tokens", () => {
      const pages: RawPageText[] = [
        {
          pageNumber: 1,
          text: "This is a single short document. It fits entirely within one chunk.",
        },
      ];

      const chunks = chunkDocument(documentId, pages, { targetTokens: 800 });

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        documentId,
        chunkIndex: 0,
        pageNumber: 1,
      });
      expect(chunks[0].content).toContain("This is a single short document");
      expect(chunks[0].tokenCount).toBeGreaterThan(0);
      expect(chunks[0].tokenCount).toBeLessThanOrEqual(800);
    });

    it("preserves distinct real page numbers across multiple PDF pages", () => {
      const pages: RawPageText[] = [
        { pageNumber: 1, text: "Content on page one of the quarterly financial statement." },
        { pageNumber: 2, text: "Content on page two containing balance sheet figures." },
        { pageNumber: 3, text: "Content on page three outlining executive compensation." },
      ];

      const chunks = chunkDocument(documentId, pages, { targetTokens: 800 });

      expect(chunks).toHaveLength(3);
      expect(chunks[0].pageNumber).toBe(1);
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[0].content).toContain("page one");

      expect(chunks[1].pageNumber).toBe(2);
      expect(chunks[1].chunkIndex).toBe(1);
      expect(chunks[1].content).toContain("page two");

      expect(chunks[2].pageNumber).toBe(3);
      expect(chunks[2].chunkIndex).toBe(2);
      expect(chunks[2].content).toContain("page three");
    });

    it("splits long pages into chunks respecting target sizes (~800 tokens) with ~12% overlap", () => {
      // Generate a long text page with ~1500 tokens (approx 1200 words)
      const paragraph =
        "The operations architecture defines high availability, fault tolerance, and secure data routing across multiple clusters. " +
        "Telemetry pipelines ingest system metrics every five seconds to verify service health and workload distribution. ";
      const longText = Array(30).fill(paragraph).join("\n\n");

      const pages: RawPageText[] = [{ pageNumber: 1, text: longText }];

      // Target ~800 tokens, ~12% overlap (~96 tokens)
      const targetTokens = 800;
      const overlapTokens = 96;

      const chunks = chunkDocument(documentId, pages, { targetTokens, overlapTokens });

      expect(chunks.length).toBeGreaterThan(1);

      // Verify all chunks preserve documentId, sequential chunkIndex, and pageNumber 1
      chunks.forEach((chunk, idx) => {
        expect(chunk.documentId).toBe(documentId);
        expect(chunk.chunkIndex).toBe(idx);
        expect(chunk.pageNumber).toBe(1);
        expect(chunk.tokenCount).toBeGreaterThan(0);
      });

      // Verify overlap between chunk 0 and chunk 1:
      // The end of chunk 0 should overlap with words in chunk 1
      const wordsChunk0 = chunks[0].content.split(/\s+/);
      const tailWords0 = wordsChunk0.slice(-10).join(" ");
      expect(chunks[1].content).toContain(tailWords0);
    });

    it("maintains consistent pageNumber=1 for unpaginated formats (DOCX/TXT/MD)", () => {
      const pages: RawPageText[] = [
        {
          pageNumber: 1,
          text: "Document extracted from markdown or docx where pageNumber is consistently 1.",
        },
      ];

      const chunks = chunkDocument(documentId, pages);
      expect(chunks[0].pageNumber).toBe(1);
      expect(chunks[0].documentId).toBe(documentId);
    });

    it("handles multi-page documents where one page is long and another is short", () => {
      const sentence = "Distributed database systems handle consensus through Paxos or Raft protocols. ";
      const longPage1 = Array(40).fill(sentence).join("\n\n");
      const shortPage2 = "Summary of replication states and failover test results.";

      const pages: RawPageText[] = [
        { pageNumber: 1, text: longPage1 },
        { pageNumber: 2, text: shortPage2 },
      ];

      const chunks = chunkDocument(documentId, pages, { targetTokens: 500, overlapTokens: 60 });

      // Page 1 should generate multiple chunks, Page 2 should generate 1 chunk
      const page1Chunks = chunks.filter((c) => c.pageNumber === 1);
      const page2Chunks = chunks.filter((c) => c.pageNumber === 2);

      expect(page1Chunks.length).toBeGreaterThan(1);
      expect(page2Chunks.length).toBe(1);
      expect(page2Chunks[0].content).toContain("Summary of replication states");

      // Verify chunkIndex increments monotonically across pages
      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].chunkIndex).toBe(i);
      }
    });
  });

  describe("cleanPages() and normalizeWhitespace()", () => {
    it("cleans excessive whitespace and control characters", () => {
      const dirty = "Hello \x00\x08 World!\t  How are   you?\r\n\r\n\r\nFine, thanks.\n\n\n\nDone.";
      const cleaned = normalizeWhitespace(dirty);
      expect(cleaned).not.toContain("\x00");
      expect(cleaned).not.toContain("\r");
      expect(cleaned).not.toContain("\n\n\n");
      expect(cleaned).toContain("Hello World! How are you?");
      expect(cleaned).toContain("Fine, thanks.\n\nDone.");
    });

    it("detects and strips repeated headers and footers across pages", () => {
      const pages: RawPageText[] = [
        {
          pageNumber: 1,
          text: "ACME Corp Confidential Report\n\nIntroduction to project roadmap.\n\nPage 1 of 3",
        },
        {
          pageNumber: 2,
          text: "ACME Corp Confidential Report\n\nTechnical specifications and milestones.\n\nPage 2 of 3",
        },
        {
          pageNumber: 3,
          text: "ACME Corp Confidential Report\n\nConclusion and sign-off.\n\nPage 3 of 3",
        },
      ];

      const cleaned = cleanPages(pages);

      expect(cleaned).toHaveLength(3);
      // Repeated header "ACME Corp Confidential Report" should be stripped
      expect(cleaned[0].text).not.toContain("ACME Corp Confidential Report");
      expect(cleaned[1].text).not.toContain("ACME Corp Confidential Report");
      expect(cleaned[2].text).not.toContain("ACME Corp Confidential Report");

      // Page numbers footers should be stripped
      expect(cleaned[0].text).not.toContain("Page 1 of 3");
      expect(cleaned[1].text).not.toContain("Page 2 of 3");
      expect(cleaned[2].text).not.toContain("Page 3 of 3");

      // Actual page contents must remain intact
      expect(cleaned[0].text).toContain("Introduction to project roadmap.");
      expect(cleaned[1].text).toContain("Technical specifications and milestones.");
      expect(cleaned[2].text).toContain("Conclusion and sign-off.");
    });
  });
});
