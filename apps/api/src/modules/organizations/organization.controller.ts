import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/errors";
import { organizationService } from "./organization.service";
import type {
  CreateOrganizationInput,
  GetOrganizationsQuery,
  UpdateOrganizationInput,
} from "./organization.schema";

export class OrganizationController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await organizationService.list(
        req.query as unknown as GetOrganizationsQuery
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const organization = await organizationService.getById(id);
      res.status(200).json({ organization });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const result = await organizationService.create(
        req.body as CreateOrganizationInput,
        req.user
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const organization = await organizationService.update(
        id,
        req.body as UpdateOrganizationInput,
        req.user
      );
      res.status(200).json({ organization });
    } catch (error) {
      next(error);
    }
  }
}

export const organizationController = new OrganizationController();
