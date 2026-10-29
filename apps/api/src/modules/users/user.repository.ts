import { prisma } from "../../lib/prisma";
import { Role, Prisma } from "@prisma/client";

export const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  departmentId: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
  department: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  departmentId?: string | null;
  role?: Role;
}

export interface FindUsersFilter {
  skip?: number;
  take?: number;
  role?: Role;
  isActive?: boolean;
  search?: string;
}

export class UserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
  }

  async findByIdWithPassword(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        department: true,
      },
    });
  }

  async createUser(data: CreateUserData) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        departmentId: data.departmentId ?? null,
        role: data.role ?? Role.EMPLOYEE,
        isActive: true,
      },
      select: safeUserSelect,
    });
  }

  async findAll(filter: FindUsersFilter = {}) {
    const where: Prisma.UserWhereInput = {};

    if (filter.role) {
      where.role = filter.role;
    }

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: "insensitive" } },
        { email: { contains: filter.search, mode: "insensitive" } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: "desc" },
        select: safeUserSelect,
      }),
    ]);

    return { total, users };
  }

  async updateRole(id: string, role: Role) {
    return prisma.user.update({
      where: { id },
      data: { role },
      select: safeUserSelect,
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    return prisma.user.update({
      where: { id },
      data: { isActive },
      select: safeUserSelect,
    });
  }
}

export const userRepository = new UserRepository();
