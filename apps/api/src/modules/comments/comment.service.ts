import { commentRepository, type CreateCommentData } from "./comment.repository";
import { requestService } from "../requests/request.service";
import { taskService } from "../tasks/task.service";
import { auditService } from "../audit/audit.service";
import { resolveTenantId, tenantWhere } from "../../lib/tenant";
import type { AuthenticatedUser } from "../../types/express";

export class CommentService {
  /**
   * Asserts the user has visibility permissions on the target entity and returns its organizationId.
   */
  private async assertCanAccessEntity(
    entityType: string,
    entityId: string,
    user: AuthenticatedUser
  ): Promise<string> {
    if (entityType === "request") {
      const req = await requestService.getRequestById(entityId, user);
      return (req as { organizationId?: string }).organizationId ?? resolveTenantId(user);
    } else if (entityType === "task") {
      const task = await taskService.getTaskById(entityId, user);
      return (task as { organizationId?: string }).organizationId ?? resolveTenantId(user);
    }
    return resolveTenantId(user);
  }

  async createComment(
    user: AuthenticatedUser,
    data: Omit<CreateCommentData, "userId" | "organizationId">
  ) {
    const organizationId = await this.assertCanAccessEntity(
      data.entityType,
      data.entityId,
      user
    );

    const comment = await commentRepository.create({
      ...data,
      userId: user.id,
      organizationId,
    });

    await auditService.log({
      actorId: user.id,
      organizationId,
      action: "COMMENT_CREATED",
      entityType: "Comment",
      entityId: comment.id,
      summary: `Added comment on ${data.entityType} #${data.entityId.slice(0, 8)}`,
      metadata: {
        targetEntityType: data.entityType,
        targetEntityId: data.entityId,
      },
    });

    return comment;
  }

  async getCommentsByEntity(
    user: AuthenticatedUser,
    entityType: string,
    entityId: string
  ) {
    await this.assertCanAccessEntity(entityType, entityId, user);
    return commentRepository.findByEntity(
      entityType,
      entityId,
      tenantWhere(user).organizationId
    );
  }
}

export const commentService = new CommentService();
