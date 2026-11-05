import type { Request, Response, NextFunction } from "express";
import { approvalFlowService } from "./approval-flow.service";
import { AppError } from "../../lib/errors";

export class ApprovalFlowController {
  async listFlows(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const flows = await approvalFlowService.getFlows(req.query as any);
      res.status(200).json({ flows });
    } catch (error) {
      next(error);
    }
  }

  async getFlowById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const flow = await approvalFlowService.getFlowById(id);
      res.status(200).json({ flow });
    } catch (error) {
      next(error);
    }
  }

  async createFlow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const flow = await approvalFlowService.createFlow(req.body, req.user);
      res.status(201).json({ flow });
    } catch (error) {
      next(error);
    }
  }

  async updateFlow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const flow = await approvalFlowService.updateFlow(id, req.body, req.user);
      res.status(200).json({ flow });
    } catch (error) {
      next(error);
    }
  }

  async deleteFlow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await approvalFlowService.deleteFlow(id, req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const approvalFlowController = new ApprovalFlowController();
