import type { Request, Response, NextFunction } from "express";
import { policyService } from "./policy.service";
import { AppError } from "../../lib/errors";
import { ListPoliciesQuery, ComplianceSummaryQuery } from "./policy.schema";

export const policyController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      if (!req.file) throw AppError.badRequest("Policy document file is required");

      const policy = await policyService.create(req.file, req.body, req.user);
      res.status(201).json({
        status: "success",
        policy,
      });
    } catch (error) {
      next(error);
    }
  },

  async uploadNewVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      if (!req.file) throw AppError.badRequest("New policy document file is required");

      const policyId = req.params.id as string;
      const policy = await policyService.uploadNewVersion(policyId, req.file, req.body, req.user);
      res.status(200).json({
        status: "success",
        message: `Policy updated to version ${policy.version}. Old chunks removed and re-embedding initiated.`,
        policy,
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const query = req.query as unknown as ListPoliciesQuery;
      const result = await policyService.list(query, req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = req.params.id as string;
      const policy = await policyService.getById(id, req.user);
      res.status(200).json({ policy });
    } catch (error) {
      next(error);
    }
  },

  async getMyStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const status = await policyService.getMyStatus(req.user);
      res.status(200).json(status);
    } catch (error) {
      next(error);
    }
  },

  async acknowledge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = req.params.id as string;
      const version = req.body.version !== undefined ? Number(req.body.version) : undefined;
      const result = await policyService.acknowledge(id, req.user, version);
      res.status(result.alreadyAcknowledged ? 200 : 201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getComplianceSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const query = req.query as unknown as ComplianceSummaryQuery;
      const result = await policyService.getComplianceSummary(query, req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async exportComplianceCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const query = req.query as unknown as ComplianceSummaryQuery;
      const { csv, fileName } = await policyService.exportComplianceCsv(query, req.user);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  },
};
