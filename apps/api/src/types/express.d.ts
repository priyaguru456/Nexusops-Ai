import { Role } from "@prisma/client";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  departmentId: string | null;
  managerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
