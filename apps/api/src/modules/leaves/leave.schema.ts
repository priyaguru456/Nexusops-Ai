import { z } from "zod";
import { LeaveType, LeaveStatus } from "@prisma/client";

export const applyLeaveSchema = z
  .object({
    type: z.nativeEnum(LeaveType, {
      message: "Leave type must be CASUAL, SICK, ANNUAL, or UNPAID",
    }),
    startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    reason: z
      .string()
      .trim()
      .min(3, "Reason must be at least 3 characters")
      .max(500, "Reason must not exceed 500 characters"),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate).getTime();
      const end = new Date(data.endDate).getTime();
      return !isNaN(start) && !isNaN(end) && start <= end;
    },
    {
      message: "Start date must not be after end date",
      path: ["startDate"],
    }
  );

export const cancelLeaveSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const leaveIdParamSchema = z.object({
  id: z.string().trim().min(1, "Leave ID is required"),
});

export const listLeavesQuerySchema = z.object({
  userId: z.string().trim().optional(),
  status: z.nativeEnum(LeaveStatus).optional(),
  type: z.nativeEnum(LeaveType).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const leaveBalanceQuerySchema = z.object({
  userId: z.string().trim().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const addHolidaySchema = z.object({
  name: z.string().trim().min(2, "Holiday name must be at least 2 characters").max(100),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
});

export const holidayIdParamSchema = z.object({
  id: z.string().trim().min(1, "Holiday ID is required"),
});

export const updateHolidaySchema = z
  .object({
    name: z.string().trim().min(2, "Holiday name must be at least 2 characters").max(100).optional(),
    date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.date !== undefined,
    {
      message: "At least one field (name or date) must be provided for update",
    }
  );

export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>;
export type CancelLeaveInput = z.infer<typeof cancelLeaveSchema>;
export type ListLeavesQuery = z.infer<typeof listLeavesQuerySchema>;
export type LeaveBalanceQuery = z.infer<typeof leaveBalanceQuerySchema>;
export type AddHolidayInput = z.infer<typeof addHolidaySchema>;
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;
