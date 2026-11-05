import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/errors";
import { assetService } from "./asset.service";
import type { GetAssetsQueryInput } from "./asset.schema";

export class AssetController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const query = req.query as unknown as GetAssetsQueryInput;
      const result = await assetService.list(req.user, query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getMyAssets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const assets = await assetService.getMyAssets(req.user);
      res.status(200).json({ data: assets });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const item = await assetService.getById(id, req.user);
      res.status(200).json(item);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const created = await assetService.create(req.user, req.body);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await assetService.update(id, req.user, req.body);
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }

  async assign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await assetService.assign(id, req.user, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async returnAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await assetService.returnAsset(id, req.user, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async retire(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await assetService.retire(id, req.user, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const assetController = new AssetController();
