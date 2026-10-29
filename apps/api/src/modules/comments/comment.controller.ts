import type { Request, Response, NextFunction } from "express";
import { commentService } from "./comment.service";
import { AppError } from "../../lib/errors";
import type { GetCommentsQuery } from "./comment.schema";

export class CommentController {
  async createComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const comment = await commentService.createComment(req.user, req.body);
      res.status(201).json({ comment });
    } catch (error) {
      next(error);
    }
  }

  async getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const query = req.query as unknown as GetCommentsQuery;
      const comments = await commentService.getCommentsByEntity(
        req.user,
        query.entityType,
        query.entityId
      );
      res.status(200).json({ comments });
    } catch (error) {
      next(error);
    }
  }
}

export const commentController = new CommentController();
