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
