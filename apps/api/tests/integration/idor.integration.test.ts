import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { Role, RequestStatus, DocVisibility, TaskStatus, Priority } from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import {
  createUser,
  createDepartment,
  createRequest,
  createDocument,
} from "../helpers/factories";

describe("Integration: IDOR Protection across all :id routes (Real Test DB)", () => {
  let userA: { id: string; email: string; organizationId: string | null };
  let tokenA: string;

  let userB: { id: string; email: string; organizationId: string | null };
  let tokenB: string;

  let reqA: { id: string };
  let taskA: { id: string };
  let docA: { id: string };
  let sessionA: { id: string };
  let notifA: { id: string };

  beforeAll(async () => {
    // Two distinct departments to ensure clean isolation
    const deptA = await createDepartment("Dept A");
    const deptB = await createDepartment("Dept B");

    const a = await createUser({ role: Role.EMPLOYEE, departmentId: deptA.id });
    userA = a.user;
    tokenA = a.token;

    const b = await createUser({ role: Role.EMPLOYEE, departmentId: deptB.id });
    userB = b.user;
    tokenB = b.token;

    // User A's private resources
    reqA = await createRequest(userA, { status: RequestStatus.DRAFT, departmentId: deptA.id });

    taskA = await prisma.task.create({
      data: {
        organizationId: userA.organizationId!,
        title: "User A Confidential Task",
        status: TaskStatus.TODO,
        priority: Priority.HIGH,
        assignedById: userA.id,
        assigneeId: userA.id,
      },
    });

    docA = await createDocument(userA, {
      visibility: DocVisibility.DEPARTMENT,
      departmentId: deptA.id,
    });

    sessionA = await prisma.chatSession.create({
      data: {
        organizationId: userA.organizationId!,
        userId: userA.id,
        title: "User A Private Chat",
      },
    });

    notifA = await prisma.notification.create({
      data: {
        organizationId: userA.organizationId!,
        userId: userA.id,
        title: "User A Private Notification",
        message: "Secret update",
        type: "TASK_ASSIGNED",
      },
    });

    // Create a comment on Request A
    await prisma.comment.create({
      data: {
        organizationId: userA.organizationId!,
        entityType: "REQUEST",
        entityId: reqA.id,
        userId: userA.id,
        body: "User A private comment",
      },
    });
  });

  const idorTable = [
    {
      resource: "WorkRequest",
      action: "read (GET /api/requests/:id)",
      method: "get" as const,
      getPath: () => `/api/requests/${reqA.id}`,
    },
    {
      resource: "WorkRequest",
      action: "modify (PATCH /api/requests/:id)",
      method: "patch" as const,
      getPath: () => `/api/requests/${reqA.id}`,
      body: { title: "Malicious override" },
    },
    {
      resource: "Task",
      action: "read (GET /api/tasks/:id)",
      method: "get" as const,
      getPath: () => `/api/tasks/${taskA.id}`,
    },
    {
      resource: "Task",
      action: "modify (PATCH /api/tasks/:id)",
      method: "patch" as const,
      getPath: () => `/api/tasks/${taskA.id}`,
      body: { title: "Malicious task edit" },
    },
    {
      resource: "Document",
      action: "read metadata (GET /api/documents/:id)",
      method: "get" as const,
      getPath: () => `/api/documents/${docA.id}`,
    },
    {
      resource: "Document",
      action: "delete (DELETE /api/documents/:id)",
      method: "delete" as const,
      getPath: () => `/api/documents/${docA.id}`,
    },
    {
      resource: "ChatSession",
      action: "read session history (GET /api/ai/sessions/:id)",
      method: "get" as const,
      getPath: () => `/api/ai/sessions/${sessionA.id}`,
    },
    {
      resource: "ChatSession",
      action: "delete session (DELETE /api/ai/sessions/:id)",
      method: "delete" as const,
      getPath: () => `/api/ai/sessions/${sessionA.id}`,
    },
    {
      resource: "Notification",
      action: "mark as read (PATCH /api/notifications/:id/read)",
      method: "patch" as const,
      getPath: () => `/api/notifications/${notifA.id}/read`,
    },
    {
      resource: "Comments",
      action: "read comments on target entity (GET /api/comments)",
      method: "get" as const,
      getPath: () => `/api/comments?entityType=REQUEST&entityId=${reqA.id}`,
    },
    {
      resource: "Comments",
      action: "post comment on unauthorized entity (POST /api/comments)",
      method: "post" as const,
      getPath: () => `/api/comments`,
      getBody: () => ({
        entityType: "REQUEST",
        entityId: reqA.id,
        content: "Malicious comment",
      }),
    },
  ];

  it.each(idorTable)(
    "User B cannot $action on User A's $resource (blocks with 403 or 404)",
    async ({ method, getPath, body, getBody }) => {
      const path = getPath();
      const payload = getBody ? getBody() : body;

      let reqBuilder;
      if (method === "get") reqBuilder = request(app).get(path);
      else if (method === "patch") reqBuilder = request(app).patch(path).send(payload);
      else if (method === "post") reqBuilder = request(app).post(path).send(payload);
      else if (method === "delete") reqBuilder = request(app).delete(path);
      else throw new Error(`Unsupported method ${method}`);

      const res = await reqBuilder.set("Authorization", `Bearer ${tokenB}`);

      // IDOR rejection must be either 403 Forbidden or 404 Not Found (to prevent resource enumeration)
      expect([403, 404]).toContain(res.status);
    }
  );
});
