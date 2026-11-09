import { z } from "zod";
import { Role } from "@prisma/client";

export const surveyQuestionSchema = z.object({
  id: z.string().min(1, "Question ID is required"),
  question: z.string().min(1, "Question text is required").max(500),
  type: z.enum(["rating", "text"]),
  required: z.boolean().default(false),
  min: z.number().int().min(1).max(5).default(1).optional(),
  max: z.number().int().min(1).max(5).default(5).optional(),
});

export const createSurveySchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  isActive: z.boolean().default(true).optional(),
  targetRole: z.nativeEnum(Role).nullable().optional(),
  questions: z.array(surveyQuestionSchema).min(1, "At least one question is required"),
});

export const updateSurveySchema = z.object({
  title: z.string().min(3).max(200).optional(),
  isActive: z.boolean().optional(),
  targetRole: z.nativeEnum(Role).nullable().optional(),
  questions: z.array(surveyQuestionSchema).min(1).optional(),
});

export const submitSurveyResponseSchema = z.object({
  surveyId: z.string().uuid("Invalid survey ID"),
  entityType: z.string().default("REQUEST"),
  entityId: z.string().min(1, "Entity ID is required"),
  answers: z.object({
    rating: z.number().int().min(1).max(5).nullable().optional(),
    comment: z.string().max(2000).nullable().optional(),
    skipped: z.boolean().optional(),
  }).passthrough(),
});

export const surveyIdParamSchema = z.object({
  id: z.string().uuid("Invalid survey ID format"),
});

export const surveyResultsQuerySchema = z.object({
  surveyId: z.string().uuid().optional(),
  fromDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  toDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

export const surveyResponsesQuerySchema = z.object({
  surveyId: z.string().uuid().optional(),
  entityType: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

export type SurveyQuestion = z.infer<typeof surveyQuestionSchema>;
export type CreateSurveyInput = z.infer<typeof createSurveySchema>;
export type UpdateSurveyInput = z.infer<typeof updateSurveySchema>;
export type SubmitSurveyResponseInput = z.infer<typeof submitSurveyResponseSchema>;
