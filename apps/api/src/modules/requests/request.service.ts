import { Role, RequestStatus, Prisma } from "@prisma/client";
import { requestRepository, type CreateRequestData, type UpdateRequestData, type RequestQueryFilters } from "./request.repository";
import { canTransitionRequest } from "./request.state-machine";
import { auditService } from "../audit/audit.service";
import { AppError } from "../../lib/errors";
import type { AuthenticatedUser } from "../../types/express";

export class RequestService {
  /**
   * Builds the visibility query based on RBAC rules:
   * - Employees see only their own requests
   * - Managers see own requests + all requests from users in their department
   * - Admins see all requests
   */
  private buildVisibilityFilter(user: AuthenticatedUser): Prisma.WorkRequestWhereInput {
    if (user.role === Role.ADMIN) {
      return {};
    }

    if (user.role === Role.MANAGER) {
      if (user.departmentId) {
        return {
          OR: [
            { requesterId: user.id },
            { requester: { departmentId: user.departmentId } },
          ],
        };
      }
      return { requesterId: user.id };
    }

    // Role.EMPLOYEE
    return { requesterId: user.id };
  }

  /**
   * Verifies if a user has permission to read a specific request.
   */
  private assertCanViewRequest(
    request: { requesterId: string; requester: { departmentId: string | null } },
    user: AuthenticatedUser
  ): void {
    if (user.role === Role.ADMIN) return;

    if (user.role === Role.MANAGER) {
      const isOwn = request.requesterId === user.id;
      const isSameDept = Boolean(
        user.departmentId && request.requester.departmentId === user.departmentId
      );
      if (isOwn || isSameDept) return;
    }

    if (user.role === Role.EMPLOYEE && request.requesterId === user.id) {
      return;
    }

    throw AppError.forbidden("You do not have permission to view this request");
  }

  async createRequest(
    user: AuthenticatedUser,
    data: Omit<CreateRequestData, "requesterId">
  ) {
    const created = await requestRepository.create({
      ...data,
      requesterId: user.id,
    });

    await auditService.log({
      actorId: user.id,
      action: "REQUEST_CREATED",
      entityType: "WorkRequest",
      entityId: created.id,
      metadata: {
        title: created.title,
        category: created.category,
        priority: created.priority,
        status: created.status,
      },
    });

    return created;
  }

  async getRequests(user: AuthenticatedUser, filters: RequestQueryFilters) {
    const visibilityWhere = this.buildVisibilityFilter(user);
    return requestRepository.findAll(filters, visibilityWhere);
  }

  async getRequestById(id: string, user: AuthenticatedUser) {
    const request = await requestRepository.findById(id);
    if (!request) {
      throw AppError.notFound("Request not found");
    }

    this.assertCanViewRequest(request, user);
    return request;
  }

  /**
   * PATCH endpoint rule: only while Draft, only by requester
   */
  async updateRequest(
    id: string,
    user: AuthenticatedUser,
    data: UpdateRequestData
  ) {
    const request = await requestRepository.findById(id);
    if (!request) {
      throw AppError.notFound("Request not found");
    }

    if (request.requesterId !== user.id) {
      throw AppError.forbidden("Only the requester can modify this request");
    }

    if (request.status !== RequestStatus.DRAFT) {
      throw AppError.conflict(
        `Requests can only be edited while in DRAFT status. Current status is ${request.status}`
      );
    }

    const updated = await requestRepository.update(id, data);

    await auditService.log({
      actorId: user.id,
      action: "REQUEST_UPDATED",
      entityType: "WorkRequest",
      entityId: id,
      metadata: {
        updatedFields: Object.keys(data),
      },
    });

    return updated;
  }

  async submitRequest(id: string, user: AuthenticatedUser) {
    const request = await requestRepository.findById(id);
    if (!request) {
      throw AppError.notFound("Request not found");
    }

    if (request.requesterId !== user.id && user.role !== Role.ADMIN) {
      throw AppError.forbidden("Only the requester can submit this request");
    }

    if (!canTransitionRequest(request.status, RequestStatus.SUBMITTED)) {
      throw AppError.conflict(
        `Cannot submit request from current status ${request.status}`
      );
    }

    const updated = await requestRepository.updateStatus(id, RequestStatus.SUBMITTED);

    await auditService.log({
      actorId: user.id,
      action: "REQUEST_SUBMITTED",
      entityType: "WorkRequest",
      entityId: id,
      metadata: {
        previousStatus: request.status,
        newStatus: RequestStatus.SUBMITTED,
      },
    });

    return updated;
  }

  async cancelRequest(id: string, user: AuthenticatedUser) {
    const request = await requestRepository.findById(id);
    if (!request) {
      throw AppError.notFound("Request not found");
    }

    // Requester, manager of department, or admin can cancel
    const isOwner = request.requesterId === user.id;
    const isManager =
      user.role === Role.MANAGER &&
      Boolean(user.departmentId && request.requester.departmentId === user.departmentId);
    const isAdmin = user.role === Role.ADMIN;

    if (!isOwner && !isManager && !isAdmin) {
      throw AppError.forbidden("You do not have permission to cancel this request");
    }

    if (!canTransitionRequest(request.status, RequestStatus.CANCELLED)) {
      throw AppError.conflict(
        `Cannot cancel request from current status ${request.status}`
      );
    }

    const updated = await requestRepository.updateStatus(id, RequestStatus.CANCELLED);

    await auditService.log({
      actorId: user.id,
      action: "REQUEST_CANCELLED",
      entityType: "WorkRequest",
      entityId: id,
      metadata: {
        previousStatus: request.status,
        newStatus: RequestStatus.CANCELLED,
      },
    });

    return updated;
  }

  async transitionStatus(
    id: string,
    targetStatus: RequestStatus,
    user: AuthenticatedUser,
    comment?: string
  ) {
    const request = await requestRepository.findById(id);
    if (!request) {
      throw AppError.notFound("Request not found");
    }

    // Role check for status transitions (e.g. approval, in review, progress, complete)
    if (user.role === Role.EMPLOYEE && targetStatus !== RequestStatus.CANCELLED) {
      throw AppError.forbidden("Employees cannot transition request lifecycle status");
    }

    if (!canTransitionRequest(request.status, targetStatus)) {
      throw AppError.conflict(
        `Illegal status transition from ${request.status} to ${targetStatus}`
      );
    }

    const updated = await requestRepository.updateStatus(id, targetStatus);

    await auditService.log({
      actorId: user.id,
      action: "REQUEST_STATUS_UPDATED",
      entityType: "WorkRequest",
      entityId: id,
      metadata: {
        previousStatus: request.status,
        newStatus: targetStatus,
        comment: comment ?? null,
      },
    });

    return updated;
  }

  async addAttachment(
    id: string,
    user: AuthenticatedUser,
    file: Express.Multer.File
  ) {
    const request = await requestRepository.findById(id);
    if (!request) {
      throw AppError.notFound("Request not found");
    }

    const isOwner = request.requesterId === user.id;
    const isAdmin = user.role === Role.ADMIN;
    if (!isOwner && !isAdmin) {
      throw AppError.forbidden("You do not have permission to attach files to this request");
    }

    const attachment = await requestRepository.addAttachment(id, {
      fileName: file.originalname,
      filePath: file.filename,
    });

    await auditService.log({
      actorId: user.id,
      action: "REQUEST_ATTACHMENT_ADDED",
      entityType: "WorkRequest",
      entityId: id,
      metadata: {
        attachmentId: attachment.id,
        fileName: file.originalname,
      },
    });

    return attachment;
  }

  async getActivityHistory(id: string, user: AuthenticatedUser) {
    const request = await requestRepository.findById(id);
    if (!request) {
      throw AppError.notFound("Request not found");
    }
    this.assertCanViewRequest(request, user);
    return requestRepository.getActivityHistory(id);
  }
}

export const requestService = new RequestService();
