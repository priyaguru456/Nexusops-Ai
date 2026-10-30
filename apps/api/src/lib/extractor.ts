import path from "path";
// Import directly from lib to avoid pdf-parse v1 index.js test-file read crash
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";
import { RawPageText } from "./chunker";
import { logger } from "./logger";

/**
 * Extracts text from a PDF buffer with real page numbers preserved.
 * Uses a custom pagerender hook to collect one text block per PDF page.
 */
export async function extractPdf(buffer: Buffer): Promise<RawPageText[]> {
  const pages: RawPageText[] = [];

  const customPagerender = async (pageData: any): Promise<string> => {
    try {
      const textContent = await pageData.getTextContent();
      let lastY: number | undefined;
      let pageText = "";

      for (const item of textContent.items) {
        if (lastY === item.transform[5] || lastY === undefined) {
          pageText += item.str;
        } else {
          pageText += "\n" + item.str;
        }
        lastY = item.transform[5];
      }

      const pageNumber =
        typeof pageData.pageIndex === "number"
          ? pageData.pageIndex + 1
          : pages.length + 1;

      pages.push({ pageNumber, text: pageText });
      return pageText;
    } catch (err) {
      logger.warn({ err }, "Error in customPagerender for PDF page");
      return "";
    }
  };

  try {
    await pdfParse(buffer, { pagerender: customPagerender });
  } catch (err) {
    logger.error({ err }, "Failed to extract PDF text with customPagerender");
    // Fallback if custom pagerender fails
    if (pages.length === 0) {
      const fallback = await pdfParse(buffer);
      if (fallback.text) {
        pages.push({ pageNumber: 1, text: fallback.text });
      }
    }
  }

  // Ensure pages are sorted by pageNumber
  return pages.sort((a, b) => a.pageNumber - b.pageNumber);
}

/**
 * Extracts raw text from DOCX files.
 *
 * Choice documentation:
 * DOCX documents do not contain explicit page boundary metadata.
 * Consistent with project guidelines, pageNumber is assigned as 1 for the document.
 */
export async function extractDocx(buffer: Buffer): Promise<RawPageText[]> {
  const result = await mammoth.extractRawText({ buffer });
  return [
    {
      pageNumber: 1,
      text: result.value || "",
    },
  ];
}

/**
 * Extracts text from plain text and Markdown files.
 *
 * Choice documentation:
 * TXT and Markdown files lack pagination.
 * Consistent with project guidelines, pageNumber is assigned as 1.
 */
export async function extractPlainText(buffer: Buffer): Promise<RawPageText[]> {
  return [
    {
      pageNumber: 1,
      text: buffer.toString("utf-8"),
    },
  ];
}

/**
 * Universal text extraction dispatcher based on file extension and MIME type.
 */
export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<RawPageText[]> {
  const ext = path.extname(filename).toLowerCase();

  if (ext === ".pdf" || mimeType === "application/pdf") {
    return extractPdf(buffer);
  }

  if (
    ext === ".docx" ||
    ext === ".doc" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    return extractDocx(buffer);
  }

  if (
    ext === ".txt" ||
    ext === ".md" ||
    mimeType.startsWith("text/") ||
    mimeType === "application/octet-stream"
  ) {
    return extractPlainText(buffer);
  }

  throw new Error(`Unsupported document format: ${ext} (${mimeType})`);
}
