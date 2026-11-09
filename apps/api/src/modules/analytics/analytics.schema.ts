import { z } from "zod";

/**
 * Validates and normalizes date range query parameters.
 * - Defaults to the last 30 days if not provided
 * - Requires from <= to
 * - Caps maximum range span at 366 days
 * - Treats 'to' as inclusive end of day (23:59:59.999 UTC)
 * - Treats 'from' as start of day (00:00:00.000 UTC)
 */
export const dateRangeQuerySchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.from && isNaN(Date.parse(data.from))) return false;
      if (data.to && isNaN(Date.parse(data.to))) return false;
      return true;
    },
    { message: "Invalid date format. Expected ISO-8601 or YYYY-MM-DD" }
  )
  .transform((data) => {
    const now = new Date();

    // Default 'to' is current date UTC end of day
    let toDate: Date;
    if (data.to) {
      const parsedTo = new Date(data.to);
      // If only date string provided (e.g. YYYY-MM-DD), set to end of day in UTC
      if (data.to.length <= 10) {
        toDate = new Date(
          Date.UTC(
            parsedTo.getUTCFullYear(),
            parsedTo.getUTCMonth(),
            parsedTo.getUTCDate(),
            23,
            59,
            59,
            999
          )
        );
      } else {
        toDate = parsedTo;
      }
    } else {
      toDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          23,
          59,
          59,
          999
        )
      );
    }

    // Default 'from' is 30 days before 'to' at start of day in UTC
    let fromDate: Date;
    if (data.from) {
      const parsedFrom = new Date(data.from);
      if (data.from.length <= 10) {
        fromDate = new Date(
          Date.UTC(
            parsedFrom.getUTCFullYear(),
            parsedFrom.getUTCMonth(),
            parsedFrom.getUTCDate(),
            0,
            0,
            0,
            0
          )
        );
      } else {
        fromDate = parsedFrom;
      }
    } else {
      fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      fromDate = new Date(
        Date.UTC(
          fromDate.getUTCFullYear(),
          fromDate.getUTCMonth(),
          fromDate.getUTCDate(),
          0,
          0,
          0,
          0
        )
      );
    }

    return { fromDate, toDate, fromRaw: data.from, toRaw: data.to };
  })
  .refine((data) => data.fromDate <= data.toDate, {
    message: "'from' date must be less than or equal to 'to' date",
  })
  .refine(
    (data) => {
      const diffMs = data.toDate.getTime() - data.fromDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays <= 366;
    },
    { message: "Date range cannot exceed 366 days" }
  );

export type DateRangeParsed = z.infer<typeof dateRangeQuerySchema>;

export const exportQuerySchema = dateRangeQuerySchema.and(
  z.object({
    type: z.enum(["requests", "tasks", "approvals", "ai-usage"], {
      message: "Export type must be 'requests', 'tasks', 'approvals', or 'ai-usage'",
    }),
  })
);

export type ExportQueryParsed = z.infer<typeof exportQuerySchema>;

export const saveDigestScheduleSchema = z.object({
  recipients: z
    .array(z.string().email("Invalid email address format").toLowerCase().trim())
    .min(1, "At least one recipient email address is required"),
  dayOfWeek: z
    .number()
    .int()
    .min(0, "dayOfWeek must be between 0 (Sunday) and 6 (Saturday)")
    .max(6, "dayOfWeek must be between 0 (Sunday) and 6 (Saturday)"),
  hour: z
    .number()
    .int()
    .min(0, "hour must be between 0 and 23")
    .max(23, "hour must be between 0 and 23"),
  timezone: z.string().default("Asia/Kolkata"),
  isActive: z.boolean().default(true),
});

export type SaveDigestScheduleInput = z.infer<typeof saveDigestScheduleSchema>;

export const sendTestDigestSchema = z.object({
  recipients: z
    .array(z.string().email("Invalid email address format").toLowerCase().trim())
    .min(1, "At least one recipient email address is required")
    .optional(),
  timezone: z.string().optional(),
});

export type SendTestDigestInput = z.infer<typeof sendTestDigestSchema>;

export const digestDeliveriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type DigestDeliveriesQueryParsed = z.infer<typeof digestDeliveriesQuerySchema>;
