import { api } from "../../api/client";
import type { CommentItem } from "../../types/comments";

export async function fetchComments(entityType: string, entityId: string): Promise<CommentItem[]> {
  const res = await api.get<{ comments: CommentItem[] }>("/comments", {
    params: { entityType, entityId },
  });
  return res.data.comments;
}

export async function createComment(data: {
  entityType: string;
  entityId: string;
  body: string;
}): Promise<CommentItem> {
  const res = await api.post<{ comment: CommentItem }>("/comments", data);
  return res.data.comment;
}
