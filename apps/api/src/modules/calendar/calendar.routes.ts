import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { calendarController } from "./calendar.controller";
import { getCalendarEventsQuerySchema } from "./calendar.schema";

export const calendarRouter = Router();

calendarRouter.use(authenticate);

calendarRouter.get(
  "/events",
  validate({ query: getCalendarEventsQuerySchema }),
  (req, res, next) => calendarController.getEvents(req, res, next)
);
