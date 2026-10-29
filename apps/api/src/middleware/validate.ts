import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";

export interface RequestValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export const validate = (schemas: RequestValidationSchemas) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        const parsed = await schemas.query.parseAsync(req.query);
        const queryObj = req.query as Record<string, unknown>;
        Object.keys(queryObj).forEach((k) => delete queryObj[k]);
        Object.assign(queryObj, parsed);
      }
      if (schemas.params) {
        const parsed = await schemas.params.parseAsync(req.params);
        Object.assign(req.params, parsed);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
