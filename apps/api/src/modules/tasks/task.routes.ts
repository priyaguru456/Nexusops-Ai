import { Router } from "express";
import { Role } from "@prisma/client";
import { taskController } from "./task.controller";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  taskIdParamSchema,
  createTaskSchema,
  updateTaskSchema,
  assignTaskSchema,
  getTasksQuerySchema,
} from "./task.schema";

export const taskRouter = Router();

taskRouter.use(authenticate);

taskRouter.get(
  "/",
  validate({ query: getTasksQuerySchema }),
  (req, res, next) => taskController.getTasks(req, res, next)
);

taskRouter.get(
  "/:id",
  validate({ params: taskIdParamSchema }),
  (req, res, next) => taskController.getTaskById(req, res, next)
);

taskRouter.post(
  "/",
  validate({ body: createTaskSchema }),
  (req, res, next) => taskController.createTask(req, res, next)
);

taskRouter.patch(
  "/:id",
  validate({ params: taskIdParamSchema, body: updateTaskSchema }),
  (req, res, next) => taskController.updateTask(req, res, next)
);

taskRouter.patch(
  "/:id/assign",
  authorize(Role.MANAGER, Role.ADMIN),
  validate({ params: taskIdParamSchema, body: assignTaskSchema }),
  (req, res, next) => taskController.assignTask(req, res, next)
);
