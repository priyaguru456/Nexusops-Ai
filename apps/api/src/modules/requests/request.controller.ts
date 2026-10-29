import type { Request, Response, NextFunction } from "express";
import { requestService } from "./request.service";
import { AppError } from "../../lib/errors";
import type { GetRequestsQuery } from "./request.schema";

export class RequestController {
  async createRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();

      const files = req.files as Express.Multer.File[] | undefined;
      const initialAttachments = files?.map((f) => ({
        fileName: f.originalname,
        filePath: f.filename,
      }));

      const created = await requestService.createRequest(req.user, {
        ...req.body,
        attachments: initialAttachments,
      });

      res.status(201).json({ request: created });
    } catch (error) {
      next(error);
    }
  }

  async getRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const query = req.query as unknown as GetRequestsQuery;
      const result = await requestService.getRequests(req.user, {
        status: query.status,
        priority: query.priority,
        category: query.category,
        startDate: query.startDate,
        endDate: query.endDate,
        search: query.search,
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getRequestById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const request = await requestService.getRequestById(id, req.user);
      res.status(200).json({ request });
    } catch (error) {
      next(error);
    }
  }

  async updateRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await requestService.updateRequest(id, req.user, req.body);
      res.status(200).json({ request: updated });
    } catch (error) {
      next(error);
    }
  }

  async submitRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const submitted = await requestService.submitRequest(id, req.user);
      res.status(200).json({ request: submitted });
    } catch (error) {
      next(error);
    }
  }

  async cancelRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const cancelled = await requestService.cancelRequest(id, req.user);
      res.status(200).json({ request: cancelled });
    } catch (error) {
      next(error);
    }
  }

  async transitionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await requestService.transitionStatus(
        id,
        req.body.status,
        req.user,
        req.body.comment
      );
      res.status(200).json({ request: updated });
    } catch (error) {
      next(error);
    }
  }

  async uploadAttachments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const file = req.file;
      if (!file) {
        throw AppError.badRequest("No file uploaded");
      }
      const attachment = await requestService.addAttachment(id, req.user, file);
      res.status(201).json({ attachment });
    } catch (error) {
      next(error);
    }
  }

  async getActivityHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const history = await requestService.getActivityHistory(id, req.user);
      res.status(200).json({ history });
    } catch (error) {
      next(error);
    }
  }
}

export const requestController = new RequestController();
