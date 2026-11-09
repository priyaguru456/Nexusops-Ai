import React, { useState, useEffect, useCallback } from "react";
import {
  Star,
  Plus,
  Edit2,
  Power,
  BarChart2,
  TrendingUp,
  MessageSquare,
  ClipboardList,
  Filter,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Trash2,
} from "lucide-react";
import { surveysApi } from "./api";
import { formatKolkataDateTime } from "../../lib/date";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Dialog } from "../../components/ui/Dialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import { CategoryBadge } from "../../components/ui/CategoryBadge";
import type {
  Survey,
  SurveyResults,
  SurveyQuestion,
} from "../../types/surveys";
import type { Role } from "../../types/auth";
import type { RequestCategory } from "../../types/requests";

export const SurveysAdminPage: React.FC = () => {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();

  // Tab state: "results" or "surveys"
  const [activeTab, setActiveTab] = useState<"results" | "surveys">("results");

  // Data states
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("ALL");
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Survey Create / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalTargetRole, setModalTargetRole] = useState<Role | "">("");
  const [modalIsActive, setModalIsActive] = useState(true);
  const [modalQuestions, setModalQuestions] = useState<SurveyQuestion[]>([
    {
      id: "csat_rating",
      question: "How satisfied are you with this fulfillment?",
      type: "rating",
      required: true,
      min: 1,
      max: 5,
    },
    {
      id: "csat_comment",
      question: "Any comments or suggestions?",
      type: "text",
      required: false,
    },
  ]);
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  // Fetch surveys list
  const loadSurveys = useCallback(async () => {
    try {
      const data = await surveysApi.getSurveys();
      setSurveys(data);
    } catch (err: any) {
      console.error("Failed to load surveys:", err);
    }
  }, []);

  // Fetch results
  const loadResults = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = selectedSurveyId !== "ALL" ? { surveyId: selectedSurveyId } : undefined;
      const data = await surveysApi.getResults(params);
      setResults(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load survey analytics.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedSurveyId]);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  useEffect(() => {
    if (activeTab === "results") {
      loadResults();
    } else {
      setIsLoading(false);
    }
  }, [activeTab, loadResults]);

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingSurvey(null);
    setModalTitle("");
    setModalTargetRole("");
    setModalIsActive(true);
    setModalQuestions([
      {
        id: "csat_rating",
        question: "How satisfied are you with this fulfillment?",
        type: "rating",
        required: true,
        min: 1,
        max: 5,
      },
      {
        id: "csat_comment",
        question: "Any comments or suggestions?",
        type: "text",
        required: false,
      },
    ]);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (survey: Survey) => {
    setEditingSurvey(survey);
    setModalTitle(survey.title);
    setModalTargetRole(survey.targetRole || "");
    setModalIsActive(survey.isActive);
    setModalQuestions(survey.questions || []);
    setIsModalOpen(true);
  };

  // Toggle Survey Active Status
  const handleToggleActive = async (survey: Survey) => {
    try {
      const updated = await surveysApi.toggleSurveyActive(survey.id);
      toastSuccess(`Survey is now ${updated.isActive ? "Active" : "Inactive"}.`, "Survey Updated");
      loadSurveys();
    } catch {
      toastError("Failed to update survey active state.", "Update Failed");
    }
  };

  // Save Modal
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) {
      toastError("Survey title is required.", "Validation Error");
      return;
    }

    if (modalQuestions.length === 0) {
      toastError("At least one question is required.", "Validation Error");
      return;
    }

    setIsSubmittingModal(true);
    try {
      const payload = {
        title: modalTitle.trim(),
        targetRole: modalTargetRole ? (modalTargetRole as Role) : null,
        isActive: modalIsActive,
        questions: modalQuestions,
      };

      if (editingSurvey) {
        await surveysApi.updateSurvey(editingSurvey.id, payload);
        toastSuccess("Survey configuration updated successfully.", "Survey Saved");
      } else {
        await surveysApi.createSurvey(payload);
        toastSuccess("New survey has been created.", "Survey Created");
      }

      setIsModalOpen(false);
      loadSurveys();
    } catch (err: any) {
      toastError(err?.response?.data?.message || "Failed to save survey.", "Save Failed");
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Helper question management
  const handleAddQuestion = (type: "rating" | "text") => {
    const newId = `q_${Date.now()}`;
    const newQuestion: SurveyQuestion = {
      id: newId,
      question: type === "rating" ? "How would you rate this service?" : "Your feedback",
      type,
      required: type === "rating",
      ...(type === "rating" ? { min: 1, max: 5 } : {}),
    };
    setModalQuestions([...modalQuestions, newQuestion]);
  };

  const handleUpdateQuestion = (index: number, updates: Partial<SurveyQuestion>) => {
    setModalQuestions((prev) =>
      prev.map((q, idx) => (idx === index ? { ...q, ...updates } : q))
    );
  };

  const handleDeleteQuestion = (index: number) => {
    if (modalQuestions.length <= 1) {
      toastWarning("A survey must contain at least one question.", "Notice");
      return;
    }
    setModalQuestions((prev) => prev.filter((_, idx) => idx !== index));
  };

  // High satisfaction percentage (ratings 4 or 5)
  const calculateSatisfactionRate = () => {
    if (!results || results.responseCount === 0) return 0;
    const happyCount = results.ratingDistribution
      .filter((d) => d.stars >= 4)
      .reduce((sum, d) => sum + d.count, 0);
    return Math.round((happyCount / results.responseCount) * 1000) / 10;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
              Satisfaction Surveys & CSAT
            </h1>
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
              Admin Only
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time Customer Satisfaction (CSAT) analytics, rating distributions, fulfillment trends, and survey management.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleOpenCreateModal} className="gap-2 shadow-xs">
            <Plus className="w-4 h-4" />
            Create Survey
          </Button>
        </div>
      </div>

      {/* Tabs and Survey Scope Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center p-1 bg-muted rounded-lg w-fit border border-border">
          <button
            type="button"
            onClick={() => setActiveTab("results")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "results"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            CSAT Analytics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("surveys")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "surveys"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Survey Forms ({surveys.length})
          </button>
        </div>

        {/* Survey Scope Dropdown (When on Results tab) */}
        {activeTab === "results" && (
          <div className="flex items-center gap-2.5">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <label htmlFor="survey-filter-select" className="text-sm font-medium text-muted-foreground">
              Filter by Survey:
            </label>
            <select
              id="survey-filter-select"
              value={selectedSurveyId}
              onChange={(e) => setSelectedSurveyId(e.target.value)}
              className="text-sm rounded-md border border-input bg-card px-3 py-1.5 shadow-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Surveys (Global CSAT)</option>
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} {s.isActive ? "(Active)" : "(Inactive)"}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: CSAT RESULTS & ANALYTICS */}
      {activeTab === "results" && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <LoadingSkeleton className="h-28 rounded-xl" />
                <LoadingSkeleton className="h-28 rounded-xl" />
                <LoadingSkeleton className="h-28 rounded-xl" />
                <LoadingSkeleton className="h-28 rounded-xl" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LoadingSkeleton className="h-80 rounded-xl" />
                <LoadingSkeleton className="h-80 rounded-xl" />
              </div>
            </div>
          ) : error ? (
            <div className="p-6 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold">Unable to load survey analytics</h3>
                <p className="text-sm mt-1">{error}</p>
                <Button variant="outline" size="sm" onClick={loadResults} className="mt-3">
                  Retry
                </Button>
              </div>
            </div>
          ) : !results || results.totalSubmissions === 0 ? (
            <EmptyState
              title="No Survey Responses Yet"
              description="When requesters submit fulfillment feedback on their completed requests, their satisfaction scores and comments will appear here."
            />
          ) : (
            <>
              {/* Metric KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Average CSAT */}
                <Card className="border-border/80 shadow-xs">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Average CSAT Score
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                        <Star className="w-4 h-4 fill-amber-500" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold tracking-tight text-foreground">
                        {results.averageCsat.toFixed(1)}
                      </span>
                      <span className="text-sm text-muted-foreground font-medium">/ 5.0</span>
                    </div>
                    <div className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {results.averageCsat >= 4 ? "Excellent Quality" : results.averageCsat >= 3 ? "Good Quality" : "Needs Attention"}
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Total Responses */}
                <Card className="border-border/80 shadow-xs">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Total Responses
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold tracking-tight text-foreground">
                        {results.responseCount}
                      </span>
                      <span className="text-xs text-muted-foreground">rated</span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Out of {results.totalSubmissions} prompt opportunities ({results.skipCount} skipped)
                    </div>
                  </CardContent>
                </Card>

                {/* 3. Satisfaction Rate */}
                <Card className="border-border/80 shadow-xs">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Satisfaction Rate
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold tracking-tight text-foreground">
                        {calculateSatisfactionRate()}%
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Rated 4 or 5 stars out of all ratings
                    </div>
                  </CardContent>
                </Card>

                {/* 4. Active Forms */}
                <Card className="border-border/80 shadow-xs">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Survey Forms
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                        <ClipboardList className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold tracking-tight text-foreground">
                        {surveys.filter((s) => s.isActive).length}
                      </span>
                      <span className="text-xs text-muted-foreground">active ({surveys.length} total)</span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Targeted to fulfillments
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main Analysis Section: Rating Distribution & Breakdown by Category */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Rating Distribution */}
                <Card className="border-border shadow-xs">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-amber-500" />
                      Rating Distribution (1 to 5 Stars)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3.5">
                    {results.ratingDistribution.map((item) => (
                      <div key={item.stars} className="flex items-center gap-3">
                        <div className="w-16 flex items-center gap-1 text-sm font-medium text-foreground">
                          <span>{item.stars}</span>
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        </div>
                        <div className="flex-1 h-3.5 rounded-full bg-muted overflow-hidden relative">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              item.stars >= 4
                                ? "bg-amber-400"
                                : item.stars === 3
                                ? "bg-amber-300"
                                : "bg-destructive/80"
                            }`}
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                        <div className="w-20 text-right text-xs text-muted-foreground font-medium">
                          {item.count} ({item.percentage}%)
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* CSAT by Request Category */}
                <Card className="border-border shadow-xs">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                      Fulfillment CSAT by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {results.breakdownByCategory.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        No category data available yet.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {results.breakdownByCategory.map((cat) => (
                          <div key={cat.category} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60">
                            <div className="flex items-center gap-2.5">
                              <CategoryBadge category={cat.category as RequestCategory} />
                              <span className="text-xs text-muted-foreground">
                                {cat.count} {cat.count === 1 ? "response" : "responses"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                              {cat.averageCsat.toFixed(1)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Weekly Trend Section */}
              <Card className="border-border shadow-xs">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Weekly CSAT Satisfaction Trend
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {results.trendByWeek.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No weekly trend points yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                          <tr>
                            <th className="px-4 py-2.5 font-medium">Calendar Week</th>
                            <th className="px-4 py-2.5 font-medium">Response Volume</th>
                            <th className="px-4 py-2.5 font-medium">Average CSAT</th>
                            <th className="px-4 py-2.5 font-medium">Rating Visual</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {results.trendByWeek.map((wk) => (
                            <tr key={wk.week} className="hover:bg-muted/30">
                              <td className="px-4 py-3 font-medium text-foreground">{wk.week}</td>
                              <td className="px-4 py-3 text-muted-foreground">{wk.count} ratings</td>
                              <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-1.5">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                {wk.averageCsat.toFixed(2)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="w-36 h-2.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-amber-400 rounded-full"
                                    style={{ width: `${(wk.averageCsat / 5) * 100}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Comments Feed */}
              <Card className="border-border shadow-xs">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-500" />
                    Recent Feedback & Comments ({results.recentComments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {results.recentComments.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No written feedback comments submitted yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {results.recentComments.map((c) => (
                        <div
                          key={c.id}
                          className="p-4 rounded-xl border border-border/80 bg-card hover:bg-muted/20 transition-colors space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3.5 h-3.5 ${
                                    (c.rating || 0) > i
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-muted-foreground/30"
                                  }`}
                                />
                              ))}
                              <span className="text-xs font-semibold text-foreground ml-1">
                                {c.rating}/5
                              </span>
                            </div>

                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatKolkataDateTime(c.createdAt)}
                            </span>
                          </div>

                          <p className="text-sm text-foreground italic bg-muted/30 p-2.5 rounded-md border border-border/50">
                            &ldquo;{c.comment}&rdquo;
                          </p>

                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                            <div className="truncate font-medium text-foreground">
                              {c.requestTitle ? `Req: ${c.requestTitle}` : "Completed Request"}
                            </div>
                            {c.category && (
                              <CategoryBadge category={c.category as RequestCategory} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* TAB 2: SURVEY FORMS MANAGEMENT */}
      {activeTab === "surveys" && (
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Active & Configured Surveys</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Surveys configured to prompt requesters upon fulfillment.
              </p>
            </div>
            <Button size="sm" onClick={handleOpenCreateModal} className="gap-1.5">
              <Plus className="w-4 h-4" />
              New Survey
            </Button>
          </CardHeader>

          <CardContent className="pt-0 p-0">
            {surveys.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No Surveys Configured"
                  description="Create a survey form to begin capturing fulfillment ratings from employees."
                >
                  <Button onClick={handleOpenCreateModal} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Create Default CSAT
                  </Button>
                </EmptyState>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-5 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Target Role</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Questions</th>
                      <th className="px-4 py-3 font-medium">Created Date</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {surveys.map((survey) => (
                      <tr key={survey.id} className="hover:bg-muted/30">
                        <td className="px-5 py-4 font-semibold text-foreground">
                          {survey.title}
                        </td>
                        <td className="px-4 py-4">
                          {survey.targetRole ? (
                            <Badge variant="outline">{survey.targetRole}</Badge>
                          ) : (
                            <Badge variant="secondary">All Roles</Badge>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {survey.isActive ? (
                            <Badge variant="default" className="bg-emerald-600 text-white hover:bg-emerald-700">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Inactive
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {survey.questions?.length || 0} questions
                        </td>
                        <td className="px-4 py-4 text-muted-foreground text-xs">
                          {formatKolkataDateTime(survey.createdAt)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleActive(survey)}
                              className="h-8 gap-1.5"
                              title={survey.isActive ? "Deactivate Survey" : "Activate Survey"}
                            >
                              <Power className={`w-3.5 h-3.5 ${survey.isActive ? "text-emerald-500" : "text-muted-foreground"}`} />
                              {survey.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditModal(survey)}
                              className="h-8 gap-1.5"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Survey Modal Dialog */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSurvey ? "Edit Survey Form" : "Create New Satisfaction Survey"}
        description="Configure satisfaction questions asked to requesters upon fulfillment."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveModal} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Survey Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={modalTitle}
              onChange={(e) => setModalTitle(e.target.value)}
              placeholder="e.g. Request Fulfillment CSAT"
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Target Role
              </label>
              <select
                value={modalTargetRole}
                onChange={(e) => setModalTargetRole(e.target.value as Role | "")}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Roles (General)</option>
                <option value="EMPLOYEE">Employees Only</option>
                <option value="MANAGER">Managers Only</option>
                <option value="ADMIN">Admins Only</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Survey State
              </label>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="modal-is-active"
                  checked={modalIsActive}
                  onChange={(e) => setModalIsActive(e.target.checked)}
                  className="rounded border-input w-4 h-4 text-primary focus:ring-primary"
                />
                <label htmlFor="modal-is-active" className="text-sm font-medium text-foreground cursor-pointer">
                  Activate survey immediately
                </label>
              </div>
            </div>
          </div>

          {/* Questions Builder */}
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Survey Questions ({modalQuestions.length})
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddQuestion("rating")}
                  className="h-7 text-xs gap-1"
                >
                  <Star className="w-3 h-3 text-amber-500" />
                  + Rating (1-5)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddQuestion("text")}
                  className="h-7 text-xs gap-1"
                >
                  <MessageSquare className="w-3 h-3 text-blue-500" />
                  + Text
                </Button>
              </div>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {modalQuestions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  className="p-3 rounded-lg border border-border bg-muted/40 space-y-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      Question #{idx + 1} ({q.type.toUpperCase()})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(idx)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                      title="Remove question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={q.question}
                    onChange={(e) => handleUpdateQuestion(idx, { question: e.target.value })}
                    className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter question prompt..."
                    required
                  />

                  <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.required || false}
                        onChange={(e) => handleUpdateQuestion(idx, { required: e.target.checked })}
                        className="rounded border-input text-primary focus:ring-primary"
                      />
                      Mandatory question
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmittingModal}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmittingModal}>
              {isSubmittingModal ? "Saving..." : editingSurvey ? "Update Survey" : "Create Survey"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
