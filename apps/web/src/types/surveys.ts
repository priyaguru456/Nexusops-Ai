import type { Role } from "./auth";

export interface SurveyQuestion {
  id: string;
  question: string;
  type: "rating" | "text";
  required?: boolean;
  min?: number;
  max?: number;
}

export interface Survey {
  id: string;
  title: string;
  isActive: boolean;
  targetRole: Role | null;
  questions: SurveyQuestion[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    responses: number;
  };
}

export interface SurveyResponseAnswers {
  rating?: number | null;
  comment?: string | null;
  skipped?: boolean;
  [key: string]: unknown;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  userId: string;
  entityType: string;
  entityId: string;
  answers: SurveyResponseAnswers;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email?: string;
    role: Role;
  };
  survey?: {
    id: string;
    title: string;
  };
}

export interface RatingDistributionItem {
  stars: number;
  count: number;
  percentage: number;
}

export interface WeeklyTrendItem {
  week: string;
  averageCsat: number;
  count: number;
}

export interface CategoryBreakdownItem {
  category: string;
  averageCsat: number;
  count: number;
}

export interface RecentCommentItem {
  id: string;
  rating: number | null;
  comment: string;
  userName: string;
  userRole: Role;
  requestTitle?: string;
  category?: string;
  createdAt: string;
}

export interface SurveyResults {
  averageCsat: number;
  responseCount: number;
  totalSubmissions: number;
  skipCount: number;
  ratingDistribution: RatingDistributionItem[];
  trendByWeek: WeeklyTrendItem[];
  breakdownByCategory: CategoryBreakdownItem[];
  recentComments: RecentCommentItem[];
}

export interface PendingCsatData {
  survey: Survey;
  request: {
    id: string;
    title: string;
    category: string;
    status: string;
    completedAt: string;
  };
}

export interface PendingCsatResponse {
  pending: boolean;
  data: PendingCsatData | null;
}
