import { z } from "zod";

export const notificationIdParamSchema = z.object({
  id: z.string().uuid("Invalid notification ID format"),
});

export const getNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20).optional(),
  unreadOnly: z
    .preprocess((val) => {
      if (typeof val === "string") {
        if (val === "true") return true;
        if (val === "false") return false;
      }
      return val;
    }, z.boolean().optional()),
});
