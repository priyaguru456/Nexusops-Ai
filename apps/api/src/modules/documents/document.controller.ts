import type { Request, Response, NextFunction } from "express";
import { documentService } from "./document.service";
import { AppError } from "../../lib/errors";
import { GetDocumentsQuery } from "./document.schema";

export const documentController = {
  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      if (!req.file) throw AppError.badRequest("Document file is required");

      const doc = await documentService.upload(req.file, req.body, req.user);
      res.status(201).json({
        status: "success",
        document: doc,
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const query = req.query as unknown as GetDocumentsQuery;
      const result = await documentService.list(query, req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = req.params.id as string;
      const doc = await documentService.getById(id, req.user);
      res.status(200).json({ document: doc });
    } catch (error) {
      next(error);
    }
  },

  async getFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = req.params.id as string;
      const { stream, fileName, mimeType, sizeBytes } = await documentService.getFile(
        id,
        req.user
      );

      res.setHeader("Content-Type", mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(fileName)}"`
      );
      if (sizeBytes) {
        res.setHeader("Content-Length", sizeBytes);
      }

      stream.on("error", (err) => next(err));
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  },

  async reprocess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = req.params.id as string;
      const updated = await documentService.reprocess(id, req.user);
      res.status(200).json({
        status: "success",
        message: "Document ingestion reprocess scheduled",
        document: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = req.params.id as string;
      await documentService.delete(id, req.user);
      res.status(200).json({
        status: "success",
        message: "Document and all associated chunks deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
};
