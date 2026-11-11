import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorizeExact } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { organizationController } from "./organization.controller";
import {
  createOrganizationSchema,
  getOrganizationsQuerySchema,
  organizationIdParamSchema,
  updateOrganizationSchema,
} from "./organization.schema";

const router = Router();

router.use(authenticate, authorizeExact(Role.SUPER_ADMIN));

router.get(
  "/",
  validate({ query: getOrganizationsQuerySchema }),
  (req, res, next) => organizationController.list(req, res, next)
);

router.get(
  "/:id",
  validate({ params: organizationIdParamSchema }),
  (req, res, next) => organizationController.getById(req, res, next)
);

router.post(
  "/",
  validate({ body: createOrganizationSchema }),
  (req, res, next) => organizationController.create(req, res, next)
);

router.patch(
  "/:id",
  validate({ params: organizationIdParamSchema, body: updateOrganizationSchema }),
  (req, res, next) => organizationController.update(req, res, next)
);

export const organizationRouter = router;
