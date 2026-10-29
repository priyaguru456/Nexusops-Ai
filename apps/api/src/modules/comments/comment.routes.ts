import { Router } from "express";
import { commentController } from "./comment.controller";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  createCommentSchema,
  getCommentsQuerySchema,
} from "./comment.schema";

export const commentRouter = Router();

commentRouter.use(authenticate);

commentRouter.post(
  "/",
  validate({ body: createCommentSchema }),
  (req, res, next) => commentController.createComment(req, res, next)
);

commentRouter.get(
  "/",
  validate({ query: getCommentsQuerySchema }),
  (req, res, next) => commentController.getComments(req, res, next)
);
