import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { surveyController } from "./survey.controller";
import {
  createSurveySchema,
  updateSurveySchema,
  submitSurveyResponseSchema,
  surveyIdParamSchema,
  surveyResultsQuerySchema,
  surveyResponsesQuerySchema,
} from "./survey.schema";

export const surveyRouter = Router();

/**
 * Public to authenticated users:
 * Check for pending completed request CSAT survey
 */
surveyRouter.get(
  "/pending-csat",
  authenticate,
  surveyController.getPendingCsat
);

/**
 * Public to authenticated users:
 * Submit survey response or skip for their completed request
 */
surveyRouter.post(
  "/responses",
  authenticate,
  validate({ body: submitSurveyResponseSchema }),
  surveyController.submitResponse
);

/**
 * Admin Only Routes
 */

// Aggregate Results View (CSAT Average, distribution, trend, category, recent comments)
surveyRouter.get(
  "/results",
  authenticate,
  authorize(Role.ADMIN),
  validate({ query: surveyResultsQuerySchema }),
  surveyController.getResults
);

// List raw responses (Admin only)
surveyRouter.get(
  "/responses",
  authenticate,
  authorize(Role.ADMIN),
  validate({ query: surveyResponsesQuerySchema }),
  surveyController.listResponses
);

// List surveys
surveyRouter.get(
  "/",
  authenticate,
  authorize(Role.ADMIN),
  surveyController.listSurveys
);

// Create survey
surveyRouter.post(
  "/",
  authenticate,
  authorize(Role.ADMIN),
  validate({ body: createSurveySchema }),
  surveyController.createSurvey
);

// Get survey by id
surveyRouter.get(
  "/:id",
  authenticate,
  authorize(Role.ADMIN),
  validate({ params: surveyIdParamSchema }),
  surveyController.getSurveyById
);

// Update survey
surveyRouter.put(
  "/:id",
  authenticate,
  authorize(Role.ADMIN),
  validate({ params: surveyIdParamSchema, body: updateSurveySchema }),
  surveyController.updateSurvey
);

// Toggle survey active
surveyRouter.patch(
  "/:id/toggle-active",
  authenticate,
  authorize(Role.ADMIN),
  validate({ params: surveyIdParamSchema }),
  surveyController.toggleActive
);
