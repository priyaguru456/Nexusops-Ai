import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SurveysAdminPage } from "./SurveysAdminPage";
import { surveysApi } from "./api";
import { ToastProvider } from "../../components/ui/toast";
import type { Survey, SurveyResults } from "../../types/surveys";

vi.mock("./api", () => ({
  surveysApi: {
    getSurveys: vi.fn(),
    getResults: vi.fn(),
    createSurvey: vi.fn(),
    updateSurvey: vi.fn(),
    toggleSurveyActive: vi.fn(),
  },
}));

const mockSurveys: Survey[] = [
  {
    id: "survey-1",
    title: "Request Fulfillment CSAT",
    isActive: true,
    targetRole: null,
    questions: [
      { id: "q1", question: "Rating", type: "rating", required: true, min: 1, max: 5 },
      { id: "q2", question: "Comments", type: "text", required: false },
    ],
    createdAt: "2026-11-01T10:00:00Z",
    updatedAt: "2026-11-01T10:00:00Z",
    _count: { responses: 42 },
  },
  {
    id: "survey-2",
    title: "Manager Approval Feedback",
    isActive: false,
    targetRole: "MANAGER",
    questions: [
      { id: "q1", question: "Ease of approval", type: "rating", required: true, min: 1, max: 5 },
    ],
    createdAt: "2026-11-02T10:00:00Z",
    updatedAt: "2026-11-02T10:00:00Z",
    _count: { responses: 5 },
  },
];

const mockResults: SurveyResults = {
  averageCsat: 4.6,
  responseCount: 25,
  totalSubmissions: 30,
  skipCount: 5,
  ratingDistribution: [
    { stars: 5, count: 18, percentage: 72 },
    { stars: 4, count: 5, percentage: 20 },
    { stars: 3, count: 2, percentage: 8 },
    { stars: 2, count: 0, percentage: 0 },
    { stars: 1, count: 0, percentage: 0 },
  ],
  trendByWeek: [
    { week: "2026-W43", averageCsat: 4.5, count: 10 },
    { week: "2026-W44", averageCsat: 4.7, count: 15 },
  ],
  breakdownByCategory: [
    { category: "IT", averageCsat: 4.8, count: 15 },
    { category: "HR", averageCsat: 4.3, count: 10 },
  ],
  recentComments: [
    {
      id: "c1",
      rating: 5,
      comment: "Very prompt delivery of software licenses.",
      userName: "Priya Sharma",
      userRole: "EMPLOYEE",
      requestTitle: "IntelliJ License Request",
      category: "IT",
      createdAt: "2026-11-04T12:00:00Z",
    },
    {
      id: "c2",
      rating: 4,
      comment: "Good communication from the facilities team.",
      userName: "Rahul Verma",
      userRole: "EMPLOYEE",
      requestTitle: "Ergonomic Chair",
      category: "FACILITIES",
      createdAt: "2026-11-03T09:30:00Z",
    },
  ],
};

describe("SurveysAdminPage Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPage = () => {
    return render(
      <ToastProvider>
        <SurveysAdminPage />
      </ToastProvider>
    );
  };

  it("renders page header, average CSAT score, response counts, and satisfaction rate", async () => {
    vi.mocked(surveysApi.getSurveys).mockResolvedValue(mockSurveys);
    vi.mocked(surveysApi.getResults).mockResolvedValue(mockResults);

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /satisfaction surveys & csat/i })
      ).toBeInTheDocument();
    });

    // Check KPI Cards
    expect(screen.getByText("4.6")).toBeInTheDocument(); // Average CSAT
    expect(screen.getByText("25")).toBeInTheDocument(); // Total responses
    expect(screen.getByText("92%")).toBeInTheDocument(); // 18 + 5 = 23 / 25 = 92%
    expect(screen.getByText(/excellent quality/i)).toBeInTheDocument();
  });

  it("renders Rating Distribution (1 to 5 stars) and Category Breakdown", async () => {
    vi.mocked(surveysApi.getSurveys).mockResolvedValue(mockSurveys);
    vi.mocked(surveysApi.getResults).mockResolvedValue(mockResults);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/rating distribution \(1 to 5 stars\)/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/fulfillment csat by category/i)).toBeInTheDocument();
    expect(screen.getAllByText("IT")[0]).toBeInTheDocument();
    expect(screen.getAllByText("HR")[0]).toBeInTheDocument();
  });

  it("renders Recent Comments feed with ratings and details", async () => {
    vi.mocked(surveysApi.getSurveys).mockResolvedValue(mockSurveys);
    vi.mocked(surveysApi.getResults).mockResolvedValue(mockResults);

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/very prompt delivery of software licenses\./i)
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/good communication from the facilities team\./i)
    ).toBeInTheDocument();
  });

  it("switches to Survey Forms tab and displays list of configured surveys", async () => {
    const user = userEvent.setup();
    vi.mocked(surveysApi.getSurveys).mockResolvedValue(mockSurveys);
    vi.mocked(surveysApi.getResults).mockResolvedValue(mockResults);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /survey forms/i })).toBeInTheDocument();
    });

    const formsTab = screen.getByRole("button", { name: /survey forms/i });
    await user.click(formsTab);

    expect(screen.getByText("Request Fulfillment CSAT")).toBeInTheDocument();
    expect(screen.getByText("Manager Approval Feedback")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("opens create survey modal when clicking Create Survey", async () => {
    const user = userEvent.setup();
    vi.mocked(surveysApi.getSurveys).mockResolvedValue(mockSurveys);
    vi.mocked(surveysApi.getResults).mockResolvedValue(mockResults);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create survey/i })).toBeInTheDocument();
    });

    const createBtn = screen.getByRole("button", { name: /create survey/i });
    await user.click(createBtn);

    expect(
      screen.getByRole("heading", { name: /create new satisfaction survey/i })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. request fulfillment csat/i)).toBeInTheDocument();
  });
});
