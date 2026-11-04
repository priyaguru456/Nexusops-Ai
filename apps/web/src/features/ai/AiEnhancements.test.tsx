import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ChatInputArea } from "./ChatInputArea";
import { ChatMessageItem } from "./ChatMessageItem";
import { CitationModal } from "./CitationModal";
import type { DocumentItem } from "../../types/documents";
import type { ChatMessage, Citation } from "../../types/ai";

describe("AI Enhancements & Citations Unit Tests", () => {
  const mockReadyDocs: DocumentItem[] = [
    {
      id: "doc-1",
      title: "Employee Handbook",
      fileName: "handbook.pdf",
      filePath: "/uploads/handbook.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10240,
      category: "HR Policy",
      visibility: "ALL",
      status: "READY",
      errorMessage: null,
      version: 1,
      createdAt: "2026-11-01T10:00:00Z",
      departmentId: null,
      uploadedById: "admin-1",
    },
    {
      id: "doc-2",
      title: "Expense Reimbursement Guide",
      fileName: "expense.pdf",
      filePath: "/uploads/expense.pdf",
      mimeType: "application/pdf",
      sizeBytes: 20480,
      category: "Finance",
      visibility: "ALL",
      status: "READY",
      errorMessage: null,
      version: 1,
      createdAt: "2026-11-01T11:00:00Z",
      departmentId: null,
      uploadedById: "admin-1",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ChatInputArea - Starter Chips from Real Data", () => {
    it("renders starter chips from real ready documents (max 4) above the input", () => {
      const onSelectPrompt = vi.fn();

      render(
        <MemoryRouter>
          <ChatInputArea
            input=""
            setInput={vi.fn()}
            onSend={vi.fn()}
            onStop={vi.fn()}
            isStreaming={false}
            starterDocs={mockReadyDocs}
            isLoadingDocs={false}
            onSelectPrompt={onSelectPrompt}
          />
        </MemoryRouter>
      );

      // Verify the starter chip for Employee Handbook is visible
      expect(screen.getByText(/HR Policy: Employee Handbook/i)).toBeInTheDocument();
      expect(screen.getByText(/Finance: Expense Reimbursement Guide/i)).toBeInTheDocument();
    });

    it("clicking a starter chip sends that prompt", async () => {
      const user = userEvent.setup();
      const onSelectPrompt = vi.fn();

      render(
        <MemoryRouter>
          <ChatInputArea
            input=""
            setInput={vi.fn()}
            onSend={vi.fn()}
            onStop={vi.fn()}
            isStreaming={false}
            starterDocs={mockReadyDocs}
            isLoadingDocs={false}
            onSelectPrompt={onSelectPrompt}
          />
        </MemoryRouter>
      );

      const chip = screen.getByRole("button", { name: /Ask about Employee Handbook/i });
      await user.click(chip);

      expect(onSelectPrompt).toHaveBeenCalledWith("What does Employee Handbook cover?");
    });

    it("shows a hint to upload a document when no documents are ready", () => {
      render(
        <MemoryRouter>
          <ChatInputArea
            input=""
            setInput={vi.fn()}
            onSend={vi.fn()}
            onStop={vi.fn()}
            isStreaming={false}
            starterDocs={[]}
            isLoadingDocs={false}
            onSelectPrompt={vi.fn()}
          />
        </MemoryRouter>
      );

      expect(screen.getByText(/No documents are ready yet/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Upload a document to chat/i })).toHaveAttribute(
        "href",
        "/documents"
      );
    });
  });

  describe("ChatMessageItem - Copy and Regenerate Buttons", () => {
    const mockAssistantMessage: ChatMessage = {
      id: "msg-asst-1",
      role: "assistant",
      content: "This is a verified AI response from the company handbook.",
      createdAt: "2026-11-03T10:00:00Z",
      citations: [
        {
          documentId: "doc-1",
          documentTitle: "Employee Handbook",
          pageNumber: 3,
          snippet: "Employees may work remotely up to 2 days per week with manager approval.",
        },
      ],
    };

    it("renders Copy and Regenerate buttons on every AI answer", () => {
      render(
        <ChatMessageItem
          message={mockAssistantMessage}
          isStreamingActive={false}
          onRegenerate={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /Copy answer/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Regenerate answer/i })).toBeInTheDocument();
    });

    it("clicking Regenerate calls onRegenerate with the messageId", async () => {
      const user = userEvent.setup();
      const onRegenerate = vi.fn();

      render(
        <ChatMessageItem
          message={mockAssistantMessage}
          isStreamingActive={false}
          onRegenerate={onRegenerate}
        />
      );

      const regenBtn = screen.getByRole("button", { name: /Regenerate answer/i });
      await user.click(regenBtn);

      expect(onRegenerate).toHaveBeenCalledWith("msg-asst-1");
    });

    it("disables Regenerate button while streaming is active", () => {
      render(
        <ChatMessageItem
          message={mockAssistantMessage}
          isStreamingActive={true}
          onRegenerate={vi.fn()}
        />
      );

      const regenBtn = screen.getByRole("button", { name: /Regenerate answer/i });
      expect(regenBtn).toBeDisabled();
    });
  });

  describe("CitationModal - Modal with Cited Excerpt", () => {
    const mockCitation: Citation = {
      documentId: "doc-1",
      documentTitle: "Employee Handbook",
      pageNumber: 5,
      snippet: "Standard annual leave entitlement is 20 days per calendar year.",
    };

    it("renders modal with document title, page, and cited excerpt snippet", () => {
      render(
        <CitationModal
          isOpen={true}
          citation={mockCitation}
          allCitations={[mockCitation]}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Employee Handbook")).toBeInTheDocument();
      expect(screen.getByText("Page 5")).toBeInTheDocument();
      expect(
        screen.getByText(/Standard annual leave entitlement is 20 days per calendar year/i)
      ).toBeInTheDocument();
    });

    it("closes when the close button is clicked", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <CitationModal
          isOpen={true}
          citation={mockCitation}
          allCitations={[mockCitation]}
          onClose={onClose}
        />
      );

      const closeBtn = screen.getByRole("button", { name: /Close modal/i });
      await user.click(closeBtn);

      expect(onClose).toHaveBeenCalled();
    });

    it("closes when the Escape key is pressed", () => {
      const onClose = vi.fn();

      render(
        <CitationModal
          isOpen={true}
          citation={mockCitation}
          allCitations={[mockCitation]}
          onClose={onClose}
        />
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
