import { Router } from "express";
import { directoryController } from "./directory.controller";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  getDirectoryQuerySchema,
  getOrgQuerySchema,
  managerIdParamSchema,
  userIdParamSchema,
} from "./directory.schema";

export const directoryRouter = Router();

// All directory endpoints require authentication (accessible to all logged-in roles: EMPLOYEE, MANAGER, ADMIN)
directoryRouter.use(authenticate);

// Directory list with debounced search, department filter, and pagination
directoryRouter.get(
  "/",
  validate({ query: getDirectoryQuerySchema }),
  (req, res, next) => directoryController.getDirectory(req, res, next)
);

// Department list with active member count for filter dropdowns
directoryRouter.get(
  "/departments",
  (req, res, next) => directoryController.getDepartments(req, res, next)
);

// Org view root nodes (department heads, executives, and individuals without a manager)
directoryRouter.get(
  "/org",
  validate({ query: getOrgQuerySchema }),
  (req, res, next) => directoryController.getOrgRoots(req, res, next)
);

// Lazy-load direct reports for an individual manager in the org tree
directoryRouter.get(
  "/reports/:managerId",
  validate({ params: managerIdParamSchema }),
  (req, res, next) => directoryController.getDirectReports(req, res, next)
);

// Team popover data for an individual person (manager, peers, and direct reports)
directoryRouter.get(
  "/team/:userId",
  validate({ params: userIdParamSchema }),
  (req, res, next) => directoryController.getUserTeam(req, res, next)
);
