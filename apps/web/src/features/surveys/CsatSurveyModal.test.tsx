import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CsatSurveyModal } from "./CsatSurveyModal";
import { surveysApi } from "./api";
import { ToastProvider } from "../../components/ui/toast";
import type { PendingCsatData } from "../../types/surveys";

vi.mock("./api", () => ({
  surveysApi: {
    getPendingCsat: vi.fn(),
    submitResponse: vi.fn(),
  },
}));

const mockPendingData: PendingCsatData = {
  survey: {
    id: "survey-1111-2222-3333-444444444444",
    title: "Request Fulfillment CSAT",
    isActive: true,
    targetRole: null,
    questions: [
      { id: "q1", question: "How satisfied are you?", type: "rating", required: true, min: 1, max: 5 },
      { id: "q2", question: "Comments", type: "text", required: false },
    ],
    createdAt: "2026-11-01T10:00:00Z",
    updatedAt: "2026-11-01T10:00:00Z",
  },
  request: {
    id: "req-9999-8888-7777-666666666666",
    title: "Dual 4K Monitors Setup",
    category: "IT",
    status: "COMPLETED",
    completedAt: "2026-11-05T08:00:00Z",
  },
};

describe("CsatSurveyModal Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  const renderWithToast = (ui: React.ReactElement) => {
    return render(<ToastProvider>{ui}</ToastProvider>);
  };

  it("renders non-blocking CSAT modal when user has a pending completed request", async () => {
    vi.mocked(surveysApi.getPendingCsat).mockResolvedValue({
      pending: true,
      data: mockPendingData,
    });

    renderWithToast(<CsatSurveyModal />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /how satisfied are you with this fulfillment\?/i })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Dual 4K Monitors Setup")).toBeInTheDocument();
    expect(screen.getByText("IT")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^skip$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit feedback/i })).toBeDisabled();
  });

  it("allows selecting star rating via clicks and submitting with optional comment", async () => {
    const user = userEvent.setup();
    vi.mocked(surveysApi.submitResponse).mockResolvedValue({ message: "Success" });

    renderWithToast(<CsatSurveyModal initialData={mockPendingData} />);

    expect(
      screen.getByRole("heading", { name: /how satisfied are you with this fulfillment\?/i })
    ).toBeInTheDocument();

    // Select 5 Stars
    const star5 = screen.getByRole("radio", { name: /rate 5 stars/i });
    await user.click(star5);

    expect(screen.getByText("Excellent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit feedback/i })).not.toBeDisabled();

    // Type optional comment
    const commentInput = screen.getByPlaceholderText(/tell us what went well/i);
    await user.type(commentInput, "Delivery was faster than expected! Thank you.");

    // Submit feedback
    const submitBtn = screen.getByRole("button", { name: /submit feedback/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(surveysApi.submitResponse).toHaveBeenCalledWith({
        surveyId: mockPendingData.survey.id,
        entityType: "REQUEST",
        entityId: mockPendingData.request.id,
        answers: {
          rating: 5,
          comment: "Delivery was faster than expected! Thank you.",
          skipped: false,
        },
      });
    });

    // Modal closes after submit
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /how satisfied are you with this fulfillment\?/i })
      ).not.toBeInTheDocument();
    });
  });

  it("supports keyboard navigation with numbers 1-5 and arrow keys", async () => {
    const user = userEvent.setup();

    renderWithToast(<CsatSurveyModal initialData={mockPendingData} />);

    const star1 = screen.getByRole("radio", { name: /rate 1 star/i });
    star1.focus();

    // Press key "4"
    await user.keyboard("4");
    expect(screen.getByText("Very Good")).toBeInTheDocument();

    // Press ArrowRight to increment to 5
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("Excellent")).toBeInTheDocument();

    // Press ArrowLeft twice to decrement to 3
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByText("Good")).toBeInTheDocument();
  });

  it("clicking Skip records skipped response and dismisses modal immediately", async () => {
    const user = userEvent.setup();
    vi.mocked(surveysApi.submitResponse).mockResolvedValue({ message: "Skipped" });

    renderWithToast(<CsatSurveyModal initialData={mockPendingData} />);

    const skipBtn = screen.getByRole("button", { name: /^skip$/i });
    await user.click(skipBtn);

    await waitFor(() => {
      expect(surveysApi.submitResponse).toHaveBeenCalledWith({
        surveyId: mockPendingData.survey.id,
        entityType: "REQUEST",
        entityId: mockPendingData.request.id,
        answers: {
          skipped: true,
          rating: null,
          comment: null,
        },
      });
    });

    // Modal closes
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /how satisfied are you with this fulfillment\?/i })
      ).not.toBeInTheDocument();
    });
  });

  it("does not render when there is no pending request", async () => {
    vi.mocked(surveysApi.getPendingCsat).mockResolvedValue({
      pending: false,
      data: null,
    });

    renderWithToast(<CsatSurveyModal />);

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /how satisfied are you with this fulfillment\?/i })
      ).not.toBeInTheDocument();
    });
  });
});
