import { z } from "zod";

export const getCalendarEventsQuerySchema = z
  .object({
    start: z.string().min(1, "Start date is required"),
    end: z.string().min(1, "End date is required"),
    types: z.string().optional(), // Comma-separated: "tasks,requests,leaves,holidays"
  })
  .refine(
    (data) => {
      const s = new Date(data.start).getTime();
      const e = new Date(data.end).getTime();
      return !isNaN(s) && !isNaN(e) && s <= e;
    },
    {
      message: "Start date must be a valid date and must not be after end date",
      path: ["start"],
    }
  );

export type GetCalendarEventsQuery = z.infer<typeof getCalendarEventsQuerySchema>;

export interface CalendarEventDTO {
  id: string;
  rawId: string;
  title: string;
  type: "TASK" | "REQUEST" | "LEAVE" | "HOLIDAY";
  start: string; // ISO string
  end: string;   // ISO string
  allDay: boolean;
  colorKey: "tasks" | "requests" | "leaves" | "holidays";
  details: {
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
  };
}
