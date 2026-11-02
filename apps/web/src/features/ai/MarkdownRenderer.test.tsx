import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MarkdownRenderer } from "./MarkdownRenderer";
import type { Citation } from "../../types/ai";

describe("React Testing Library: MarkdownRenderer & CitationChip Security", () => {
  const dummyCitations: Citation[] = [
    {
      documentId: "doc-101",
      documentTitle: "Leave Policy 2026",
      pageNumber: 2,
      snippet: "Employees receive 25 days of paid annual leave.",
    },
  ];

  it("correctly transforms [1] citation markers into interactive CitationChips", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    const markdownText = "According to our company guidelines [1], vacation accrues monthly.";

    render(
      <MarkdownRenderer
        content={markdownText}
        citations={dummyCitations}
        onSelectCitation={handleSelect}
      />
    );

    // Verify citation chip is rendered with [1] and document name
    expect(screen.getByText("[1]")).toBeInTheDocument();
    expect(screen.getByText("Leave Policy 2026")).toBeInTheDocument();
    expect(screen.getByText("p.2")).toBeInTheDocument();

    // Clicking the chip should call onSelectCitation callback
    const chipButton = screen.getByRole("button", { name: /Leave Policy 2026/i });
    await user.click(chipButton);

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith(dummyCitations[0], 0);
  });

  it("XSS Prevention: does NOT render raw <script> tags into the DOM", () => {
    const maliciousModelOutput =
      'NexusOps provides comprehensive security: <script>window.__xss_executed = true;</script>';

    const { container } = render(
      <MarkdownRenderer content={maliciousModelOutput} citations={[]} />
    );

    // Assert that no <script> element was inserted into the document
    const scriptElement = container.querySelector("script");
    expect(scriptElement).toBeNull();

    // Verify window property was never set
    expect((window as any).__xss_executed).toBeUndefined();
  });

  it("XSS Prevention: does NOT execute or render onerror image payloads in the model output", () => {
    const maliciousImageOutput =
      'Here is your answer: <img src="invalid-url.jpg" onerror="window.__img_xss = true;" />';

    const { container } = render(
      <MarkdownRenderer content={maliciousImageOutput} citations={[]} />
    );

    // ReactMarkdown without rehype-raw safely strips/escapes raw HTML tags
    const imgWithOnError = container.querySelector("img[onerror]");
    expect(imgWithOnError).toBeNull();
    expect((window as any).__img_xss).toBeUndefined();
  });

  it("preserves standard markdown formatting (lists, bold, code blocks)", () => {
    const markdown =
      "### Instructions\n\n" +
      "- **Step 1**: Run migrations\n" +
      "- **Step 2**: Start server\n\n" +
      "`npm run test`";

    render(<MarkdownRenderer content={markdown} citations={[]} />);

    expect(screen.getByText("Instructions")).toBeInTheDocument();
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("npm run test")).toBeInTheDocument();
  });
});
