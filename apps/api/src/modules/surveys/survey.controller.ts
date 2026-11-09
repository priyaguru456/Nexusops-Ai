import type { Request, Response, NextFunction } from "express";
import { surveyService } from "./survey.service";
import type { AuthenticatedUser } from "../../types/express";
import type {
  CreateSurveyInput,
  UpdateSurveyInput,
  SubmitSurveyResponseInput,
} from "./survey.schema";

export class SurveyController {
  async getPendingCsat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthenticatedUser;
      const pending = await surveyService.getPendingCsat(user);
      res.status(200).json({
        pending: Boolean(pending),
        data: pending,
      });
    } catch (err) {
      next(err);
    }
  }

  async submitResponse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthenticatedUser;
      const input = req.body as SubmitSurveyResponseInput;
      const response = await surveyService.submitResponse(user, input);
      res.status(201).json({
        message: input.answers?.skipped ? "Survey skipped" : "Feedback submitted successfully",
        response,
      });
    } catch (err) {
      next(err);
    }
  }

  async createSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthenticatedUser;
      const input = req.body as CreateSurveyInput;
      const survey = await surveyService.createSurvey(user, input);
      res.status(201).json({
        message: "Survey created successfully",
        survey,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthenticatedUser;
      const id = String(req.params.id);
      const input = req.body as UpdateSurveyInput;
      const survey = await surveyService.updateSurvey(user, id, input);
      res.status(200).json({
        message: "Survey updated successfully",
        survey,
      });
    } catch (err) {
      next(err);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthenticatedUser;
      const id = String(req.params.id);
      const survey = await surveyService.toggleActive(user, id);
      res.status(200).json({
        message: `Survey is now ${survey.isActive ? "active" : "inactive"}`,
        survey,
      });
    } catch (err) {
      next(err);
    }
  }

  async listSurveys(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveys = await surveyService.listSurveys();
      res.status(200).json({
        surveys,
      });
    } catch (err) {
      next(err);
    }
  }

  async getSurveyById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const survey = await surveyService.getSurveyById(id);
      res.status(200).json({
        survey,
      });
    } catch (err) {
      next(err);
    }
  }

  async getResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { surveyId, fromDate, toDate } = req.query as {
        surveyId?: string;
        fromDate?: string;
        toDate?: string;
      };
      const results = await surveyService.getResults(surveyId, fromDate, toDate);
      res.status(200).json({
        results,
      });
    } catch (err) {
      next(err);
    }
  }

  async listResponses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { surveyId, entityType, page = 1, limit = 20 } = req.query as unknown as {
        surveyId?: string;
        entityType?: string;
        page?: number;
        limit?: number;
      };

      const paged = await surveyService.listResponses({
        surveyId,
        entityType,
        page: Number(page),
        limit: Number(limit),
      });

      res.status(200).json(paged);
    } catch (err) {
      next(err);
    }
  }
}

export const surveyController = new SurveyController();
