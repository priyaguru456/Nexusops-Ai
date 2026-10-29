import type { Role } from "./auth";

export interface CommentItem {
  id: string;
  entityType: string;
  entityId: string;
  body: string;
  createdAt: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
}
