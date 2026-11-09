export type CalendarEventType = "TASK" | "REQUEST" | "LEAVE" | "HOLIDAY";

export type CalendarEventColorKey = "tasks" | "requests" | "leaves" | "holidays";

export interface CalendarEventDetails {
  status?: string;
  priority?: string;
  category?: string;
  assigneeName?: string | null;
  assigneeId?: string | null;
  requesterName?: string | null;
  requesterId?: string | null;
  userName?: string | null;
  userId?: string | null;
  leaveType?: string | null;
  daysCount?: number | null;
  reason?: string | null;
  amount?: number | null;
  link: string;
  departmentName?: string | null;
}

export interface CalendarEvent {
  id: string;
  rawId: string;
  title: string;
  type: CalendarEventType;
  start: string; // ISO string
  end: string;   // ISO string
  allDay: boolean;
  colorKey: CalendarEventColorKey;
  details: CalendarEventDetails;
}

export type CalendarViewMode = "month" | "week" | "day";

export interface CalendarToggles {
  tasks: boolean;
  requests: boolean;
  leaves: boolean;
  holidays: boolean;
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
  range: {
    start: string;
    end: string;
  };
}
