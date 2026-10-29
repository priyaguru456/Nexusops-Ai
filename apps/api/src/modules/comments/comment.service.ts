import { commentRepository, type CreateCommentData } from "./comment.repository";
import { requestService } from "../requests/request.service";
import { taskService } from "../tasks/task.service";
import { auditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../../types/express";

export class CommentService {
  /**
   * Asserts the user has visibility permissions on the target entity.
   */
  private async assertCanAccessEntity(
    entityType: string,
    entityId: string,
    user: AuthenticatedUser
  ): Promise<void> {
    if (entityType === "request") {
      await requestService.getRequestById(entityId, user);
    } else if (entityType === "task") {
      await taskService.getTaskById(entityId, user);
    }
  }

  async createComment(
    user: AuthenticatedUser,
    data: Omit<CreateCommentData, "userId">
  ) {
    await this.assertCanAccessEntity(data.entityType, data.entityId, user);

    const comment = await commentRepository.create({
      ...data,
      userId: user.id,
    });

    await auditService.log({
      actorId: user.id,
      action: "COMMENT_CREATED",
      entityType: "Comment",
      entityId: comment.id,
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
    return commentRepository.findByEntity(entityType, entityId);
  }
}

export const commentService = new CommentService();
