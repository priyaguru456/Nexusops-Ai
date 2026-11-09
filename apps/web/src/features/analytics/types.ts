export interface DateRange {
  from: string;
  to: string;
}

export interface OverviewTotals {
  totalRequests: number;
  open: number;
  approved: number;
  rejected: number;
  completed: number;
  draft: number;
  cancelled: number;
}

export interface OverviewPerformance {
  avgApprovalTimeHours: number | null;
  avgCompletionTimeHours: number | null;
}

export interface OverviewTasks {
  total: number;
  todo: number;
  inProgress: number;
  blocked: number;
  done: number;
  overdue: number;
}

export interface CategoryStat {
  category: string;
  count: number;
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface AISummary {
  totalQuestions: number;
  notFoundRatePercent: number | null;
  avgLatencyMs: number | null;
  positiveFeedbackCount: number;
  negativeFeedbackCount: number;
  estimatedCostUsd: number;
}

export interface AnalyticsOverviewData {
  dateRange: DateRange;
  totals: OverviewTotals;
  performance: OverviewPerformance;
  tasks: OverviewTasks;
  requestsByCategory: CategoryStat[];
  requestsOverTime: TimeSeriesPoint[];
  aiSummary: AISummary | null;
}

export interface TopApprover {
  approverId: string;
  approverName: string;
  role: string;
  decidedStepsCount: number;
  avgDecisionHours: number | null;
}

export interface BottleneckStep {
  stepOrder: number;
  approverRole: string;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  avgHoursToDecide: number | null;
}

export interface RequestsAnalyticsData {
  requestsOverTime: TimeSeriesPoint[];
  byCategory: CategoryStat[];
  byPriority: Array<{ priority: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  topApprovers: TopApprover[];
  bottleneckSteps: BottleneckStep[];
}

export interface AssigneeTaskStat {
  assigneeId: string;
  assigneeName: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
}

export interface OverdueTaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string;
  assigneeName: string;
}

export interface TasksAnalyticsData {
  byStatus: Array<{ status: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  byAssignee: AssigneeTaskStat[];
  overdueTasksCount: number;
  overdueTasks: OverdueTaskItem[];
}

export interface MostUsedDocument {
  documentId: string;
  title: string;
  citationCount: number;
}

export interface AIUsageMetrics {
  totalQuestions: number;
  totalAnswers: number;
  notFoundCount: number;
  notFoundRatePercent: number;
  avgLatencyMs: number | null;
  feedback: {
    positive: number;
    negative: number;
    total: number;
    satisfactionRatePercent: number | null;
  };
  tokens: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    inputPricePerMTok: number;
    outputPricePerMTok: number;
  };
}

export interface AIUsageAnalyticsData {
  questionsPerDay: TimeSeriesPoint[];
  metrics: AIUsageMetrics;
  mostUsedDocuments: MostUsedDocument[];
}

export interface DigestScheduleData {
  id: string;
  recipients: string[];
  frequency: "WEEKLY";
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  hour: number;      // 0 - 23
  timezone: string;
  isActive: boolean;
  lastRunAt: string | null;
  createdBy: string;
  creator?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DigestDeliveryData {
  id: string;
  scheduleId: string | null;
  sentAt: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  error: string | null;
  recipientCount: number;
  createdAt: string;
}

export interface DigestDeliveriesResponse {
  deliveries: DigestDeliveryData[];
  total: number;
  page: number;
  totalPages: number;
}

export interface SaveDigestSchedulePayload {
  recipients: string[];
  dayOfWeek: number;
  hour: number;
  timezone?: string;
  isActive?: boolean;
}
