import type { Request, Response, NextFunction } from "express";
import { searchService } from "./search.service";
import { AppError } from "../../lib/errors";

export class SearchController {
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const q = typeof req.query.q === "string" ? req.query.q : "";
      const results = await searchService.search(req.user, q);

      res.status(200).json({
        status: "success",
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const searchController = new SearchController();
