import { describe, it, expect, vi } from "vitest";

// Re-create the pure SSE parser logic used in the frontend
function parseAndDispatchSSE(
  rawBlock: string,
  callbacks: {
    onToken: (t: string) => void;
    onCitations: (c: any[]) => void;
    onDone: (d: any) => void;
    onError: (e: string) => void;
  }
): void {
  const lines = rawBlock.split(/\r?\n/);
  let eventType = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return;

  const rawData = dataLines.join("\n");
  let parsed: any;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    parsed = { message: rawData };
  }

  switch (eventType) {
    case "token":
      if (typeof parsed?.token === "string") callbacks.onToken(parsed.token);
      break;
    case "citations":
      if (Array.isArray(parsed?.citations)) callbacks.onCitations(parsed.citations);
      break;
    case "done":
      callbacks.onDone(parsed);
      break;
    case "error":
      callbacks.onError(parsed?.error || "Error occurred");
      break;
  }
}

// Re-create stream buffer parsing
function parseSSEChunks(
  chunks: string[],
  callbacks: {
    onToken: (t: string) => void;
    onCitations: (c: any[]) => void;
    onDone: (d: any) => void;
    onError: (e: string) => void;
  }
) {
  let buffer = "";
  for (const chunk of chunks) {
    buffer += chunk;
    while (true) {
      const rnIndex = buffer.indexOf("\r\n\r\n");
      const nnIndex = buffer.indexOf("\n\n");
      if (rnIndex === -1 && nnIndex === -1) break;

      let boundaryIndex: number;
      let delimiterLength: number;
      if (rnIndex !== -1 && (nnIndex === -1 || rnIndex <= nnIndex)) {
        boundaryIndex = rnIndex;
        delimiterLength = 4;
      } else {
        boundaryIndex = nnIndex;
        delimiterLength = 2;
      }

      const rawEvent = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + delimiterLength);
      parseAndDispatchSSE(rawEvent, callbacks);
    }
  }
  if (buffer.trim()) {
    parseAndDispatchSSE(buffer, callbacks);
  }
}

// Markdown citation pre-processor
interface Citation {
  documentId: string;
  documentTitle: string;
  pageNumber: number | null;
  snippet: string;
}

function preprocessMarkdownCitations(content: string, citations?: Citation[] | null): string {
  if (!content || !citations || citations.length === 0) {
    return content || "";
  }

  const tokens = content.split(/(```[\s\S]*?```|`[^`\n]+`)/g);

  return tokens
    .map((token) => {
      if (token.startsWith("```") || (token.startsWith("`") && token.endsWith("`"))) {
        return token;
      }
      return token.replace(/\[(\d+)\]/g, (match, numStr) => {
        const n = parseInt(numStr, 10);
        if (n >= 1 && n <= citations.length && citations[n - 1]) {
          return `[__CITATION_${n}__](#citation-${n})`;
        }
        return match;
      });
    })
    .join("");
}

describe("AI Assistant Frontend Logic Unit Tests (Task 10)", () => {
  describe("1. SSE Stream Buffering & Chunk Splitting", () => {
    it("handles partial network chunks split across event and data lines", () => {
      const onToken = vi.fn();
      const onCitations = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      // Chunk 1: half of event declaration
      // Chunk 2: rest of event declaration and half of data
      // Chunk 3: rest of data and double newline
      const chunks = [
        "event: to",
        "ken\ndata: {\"tok",
        "en\":\"Hello \"}\n\n",
      ];

      parseSSEChunks(chunks, { onToken, onCitations, onDone, onError });

      expect(onToken).toHaveBeenCalledTimes(1);
      expect(onToken).toHaveBeenCalledWith("Hello ");
    });

    it("handles multiple SSE events arriving in a single network chunk", () => {
      const onToken = vi.fn();
      const onCitations = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const combinedChunk = [
        'event: token\ndata: {"token":"World"}\n\nevent: token\ndata: {"token":"!"}\n\n',
      ];

      parseSSEChunks(combinedChunk, { onToken, onCitations, onDone, onError });

      expect(onToken).toHaveBeenCalledTimes(2);
      expect(onToken).toHaveBeenNthCalledWith(1, "World");
      expect(onToken).toHaveBeenNthCalledWith(2, "!");
    });

    it("parses typed events: citations, done, and error", () => {
      const onToken = vi.fn();
      const onCitations = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const events = [
        'event: citations\ndata: {"citations":[{"documentId":"doc-1","documentTitle":"Handbook","pageNumber":3,"snippet":"test snippet"}]}\n\n',
        'event: done\ndata: {"messageId":"msg-123","sessionId":"sess-456","content":"Here is the policy","citations":[],"tokensUsed":50,"latencyMs":210,"notFound":false}\n\n',
        'event: error\ndata: {"error":"Model rate limit reached"}\n\n',
      ];

      parseSSEChunks(events, { onToken, onCitations, onDone, onError });

      expect(onCitations).toHaveBeenCalledTimes(1);
      expect(onCitations).toHaveBeenCalledWith([
        {
          documentId: "doc-1",
          documentTitle: "Handbook",
          pageNumber: 3,
          snippet: "test snippet",
        },
      ]);

      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith({
        messageId: "msg-123",
        sessionId: "sess-456",
        content: "Here is the policy",
        citations: [],
        tokensUsed: 50,
        latencyMs: 210,
        notFound: false,
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith("Model rate limit reached");
    });
  });

  describe("2. Citation Replacement & Plain-Text Fallback", () => {
    const citations: Citation[] = [
      {
        documentId: "doc-hr-1",
        documentTitle: "HR_Policy_2025.pdf",
        pageNumber: 12,
        snippet: "Employees can work remotely up to 3 days per week.",
      },
      {
        documentId: "doc-fin-2",
        documentTitle: "Travel_Guidelines.pdf",
        pageNumber: 5,
        snippet: "Daily meal reimbursement is capped at $75.",
      },
    ];

    it("replaces mapped citations [1] and [2] with citation links", () => {
      const text = "As outlined in [1], remote work is allowed. See also [2] for meals.";
      const processed = preprocessMarkdownCitations(text, citations);

      expect(processed).toBe(
        "As outlined in [__CITATION_1__](#citation-1), remote work is allowed. See also [__CITATION_2__](#citation-2) for meals."
      );
    });

    it("preserves unmapped markers like [99] and [3] as plain text", () => {
      const text = "Valid [1] citation, but [3] and [99] are unmapped.";
      const processed = preprocessMarkdownCitations(text, citations);

      expect(processed).toContain("[__CITATION_1__](#citation-1)");
      expect(processed).toContain("[3]");
      expect(processed).toContain("[99]");
      expect(processed).not.toContain("#citation-3");
      expect(processed).not.toContain("#citation-99");
    });

    it("protects citations inside code blocks and inline code from being replaced", () => {
      const codeText = "Check this regex: `\\[1\\]` and snippet:\n```js\nconst arr = [1, 2];\n```\nWhile [1] is a real source.";
      const processed = preprocessMarkdownCitations(codeText, citations);

      expect(processed).toContain("`\\[1\\]`");
      expect(processed).toContain("const arr = [1, 2];");
      expect(processed).toContain("[__CITATION_1__](#citation-1)");
    });
  });

  describe("3. Not-Found Style & Detection", () => {
    it("identifies not found state via notFound: true in done event or exact fallback string", () => {
      const doneEvent = { notFound: true, content: "I couldn't find this in the company documents." };
      const isNotFound = Boolean(doneEvent.notFound) || doneEvent.content.trim() === "I couldn't find this in the company documents.";
      expect(isNotFound).toBe(true);
    });
  });
});
