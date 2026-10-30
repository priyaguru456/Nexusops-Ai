import { RawPageText } from "./chunker";

/**
 * Normalizes text by removing non-printable control characters,
 * standardizing whitespace and line breaks.
 */
export function normalizeWhitespace(text: string): string {
  if (!text) return "";

  return text
    // Replace null bytes and non-printable control chars (preserve \n, \r, \t)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Normalize CRLF to LF
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Replace non-breaking spaces and Unicode spaces with standard space
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    // Collapse horizontal whitespace (multiple spaces/tabs)
    .replace(/[ \t]+/g, " ")
    // Trim each line
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    // Collapse 3 or more consecutive newlines into 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Common patterns for page footers / headers like "Page 1 of 10", "- 1 -", "Page 2"
 */
const PAGE_NUMBER_REGEX = /^(?:page\s+\d+(\s+of\s+\d+)?|-?\s*\d+\s*-?|\d+\s*\/\s*\d+)$/i;

/**
 * Cleans an array of extracted pages by stripping repeated headers/footers
 * and standardizing whitespace.
 */
export function cleanPages(pages: RawPageText[]): RawPageText[] {
  if (!pages || pages.length === 0) return [];

  // Step 1: Normalize whitespace for all pages
  const normalizedPages = pages.map((page) => ({
    pageNumber: page.pageNumber,
    text: normalizeWhitespace(page.text),
  }));

  if (normalizedPages.length <= 1) {
    return normalizedPages.filter((p) => p.text.length > 0);
  }

  // Step 2: Detect repeated headers (first line) and footers (last line) across pages
  const headerCounts = new Map<string, number>();
  const footerCounts = new Map<string, number>();

  for (const page of normalizedPages) {
    const lines = page.text.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length > 0) {
      const firstLine = lines[0].toLowerCase();
      headerCounts.set(firstLine, (headerCounts.get(firstLine) || 0) + 1);

      const lastLine = lines[lines.length - 1].toLowerCase();
      footerCounts.set(lastLine, (footerCounts.get(lastLine) || 0) + 1);
    }
  }

  const threshold = Math.max(2, Math.floor(normalizedPages.length * 0.4));

  const repeatedHeaders = new Set<string>();
  headerCounts.forEach((count, line) => {
    if (count >= threshold && line.length > 3) {
      repeatedHeaders.add(line);
    }
  });

  const repeatedFooters = new Set<string>();
  footerCounts.forEach((count, line) => {
    if (count >= threshold && line.length > 3) {
      repeatedFooters.add(line);
    }
  });

  // Step 3: Strip repeated headers, footers, and standalone page numbers from each page
  return normalizedPages
    .map((page) => {
      let lines = page.text.split("\n");

      // Check first line
      if (lines.length > 0) {
        const first = lines[0].trim();
        if (repeatedHeaders.has(first.toLowerCase()) || PAGE_NUMBER_REGEX.test(first)) {
          lines = lines.slice(1);
        }
      }

      // Check last line
      if (lines.length > 0) {
        const last = lines[lines.length - 1].trim();
        if (repeatedFooters.has(last.toLowerCase()) || PAGE_NUMBER_REGEX.test(last)) {
          lines = lines.slice(0, lines.length - 1);
        }
      }

      return {
        pageNumber: page.pageNumber,
        text: lines.join("\n").trim(),
      };
    })
    .filter((page) => page.text.length > 0);
}
