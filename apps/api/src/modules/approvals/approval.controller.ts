import type { Request, Response, NextFunction } from "express";
import { approvalService } from "./approval.service";
import { AppError } from "../../lib/errors";

export class ApprovalController {
  async getPendingApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const steps = await approvalService.getPendingApprovals(req.user);
      res.status(200).json({ steps });
    } catch (error) {
      next(error);
    }
  }

  async approveStep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const stepId = Array.isArray(req.params.stepId) ? req.params.stepId[0] : req.params.stepId;
      const result = await approvalService.approveStep(stepId, req.user, req.body.comment);
      res.status(200).json({ step: result });
    } catch (error) {
      next(error);
    }
  }

  async rejectStep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const stepId = Array.isArray(req.params.stepId) ? req.params.stepId[0] : req.params.stepId;
      const result = await approvalService.rejectStep(stepId, req.user, req.body.comment);
      res.status(200).json({ step: result });
    } catch (error) {
      next(error);
    }
  }

  async reassignStep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const stepId = Array.isArray(req.params.stepId) ? req.params.stepId[0] : req.params.stepId;
      const result = await approvalService.reassignStep(stepId, req.user, req.body.approverId);
      res.status(200).json({ step: result });
    } catch (error) {
      next(error);
    }
  }
}

export const approvalController = new ApprovalController();
