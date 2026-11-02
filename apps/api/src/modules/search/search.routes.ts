import { Router } from "express";
import { searchController } from "./search.controller";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { searchQuerySchema } from "./search.schema";

export const searchRouter = Router();

searchRouter.get(
  "/",
  authenticate,
  validate({ query: searchQuerySchema }),
  (req, res, next) => searchController.search(req, res, next)
);
