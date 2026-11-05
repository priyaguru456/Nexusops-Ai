import { prisma } from "../../lib/prisma";
import { Role, Prisma } from "@prisma/client";

export const safeDirectorySelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  departmentId: true,
  managerId: true,
  createdAt: true,
  department: {
    select: {
      id: true,
      name: true,
    },
  },
  manager: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  _count: {
    select: {
      reports: true,
    },
  },
} as const;

export interface DirectoryFilter {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  role?: Role;
}

export interface DirectoryUserDTO {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  departmentId: string | null;
  department: {
    id: string;
    name: string;
  } | null;
  managerId: string | null;
  manager: {
    id: string;
    name: string;
    email: string;
    role: Role;
  } | null;
  directReportsCount: number;
  createdAt: Date;
}

export class DirectoryRepository {
  async findDirectoryUsers(filter: DirectoryFilter = {}): Promise<{
    users: DirectoryUserDTO[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const where: Prisma.UserWhereInput = {
      isActive: true,
    };

    if (filter.departmentId) {
      where.departmentId = filter.departmentId;
    }

    if (filter.role) {
      where.role = filter.role;
    }

    if (filter.search) {
      const s = filter.search.trim();
      const orConditions: Prisma.UserWhereInput[] = [
        { name: { contains: s, mode: "insensitive" } },
        { email: { contains: s, mode: "insensitive" } },
        { department: { name: { contains: s, mode: "insensitive" } } },
      ];

      const upper = s.toUpperCase();
      if (upper === "ADMIN" || upper === "MANAGER" || upper === "EMPLOYEE") {
        orConditions.push({ role: upper as Role });
      }

      where.OR = orConditions;
    }

    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 12));
    const skip = (page - 1) * limit;

    const [total, rawUsers] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: safeDirectorySelect,
      }),
    ]);

    const users: DirectoryUserDTO[] = rawUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      departmentId: u.departmentId,
      department: u.department,
      managerId: u.managerId,
      manager: u.manager,
      directReportsCount: u._count?.reports ?? 0,
      createdAt: u.createdAt,
    }));

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findDepartments(): Promise<Array<{ id: string; name: string; userCount: number }>> {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            users: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    return departments.map((d) => ({
      id: d.id,
      name: d.name,
      userCount: d._count?.users ?? 0,
    }));
  }

  async findOrgRoots(departmentId?: string): Promise<DirectoryUserDTO[]> {
    const where: Prisma.UserWhereInput = {
      isActive: true,
    };

    if (departmentId) {
      where.departmentId = departmentId;
      // If scoped to a department, roots are users with no manager OR manager in another department
      where.OR = [
        { managerId: null },
        { manager: { departmentId: { not: departmentId } } },
      ];
    } else {
      // Global roots: individuals with no manager (Department heads, executives, or standalone members)
      where.managerId = null;
    }

    const rawRoots = await prisma.user.findMany({
      where,
      orderBy: [{ role: "desc" }, { name: "asc" }],
      select: safeDirectorySelect,
    });

    return rawRoots.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      departmentId: u.departmentId,
      department: u.department,
      managerId: u.managerId,
      manager: u.manager,
      directReportsCount: u._count?.reports ?? 0,
      createdAt: u.createdAt,
    }));
  }

  async findDirectReports(managerId: string): Promise<DirectoryUserDTO[]> {
    const rawReports = await prisma.user.findMany({
      where: {
        managerId,
        isActive: true,
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: safeDirectorySelect,
    });

    return rawReports.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      departmentId: u.departmentId,
      department: u.department,
      managerId: u.managerId,
      manager: u.manager,
      directReportsCount: u._count?.reports ?? 0,
      createdAt: u.createdAt,
    }));
  }

  async findUserTeam(userId: string): Promise<{
    user: DirectoryUserDTO;
    manager: DirectoryUserDTO | null;
    peers: DirectoryUserDTO[];
    directReports: DirectoryUserDTO[];
  } | null> {
    const rawUser = await prisma.user.findUnique({
      where: { id: userId },
      select: safeDirectorySelect,
    });

    if (!rawUser) {
      return null;
    }

    const user: DirectoryUserDTO = {
      id: rawUser.id,
      name: rawUser.name,
      email: rawUser.email,
      role: rawUser.role,
      isActive: rawUser.isActive,
      departmentId: rawUser.departmentId,
      department: rawUser.department,
      managerId: rawUser.managerId,
      manager: rawUser.manager,
      directReportsCount: rawUser._count?.reports ?? 0,
      createdAt: rawUser.createdAt,
    };

    let manager: DirectoryUserDTO | null = null;
    let peers: DirectoryUserDTO[] = [];

    if (rawUser.managerId) {
      const [rawManager, rawPeers] = await Promise.all([
        prisma.user.findUnique({
          where: { id: rawUser.managerId },
          select: safeDirectorySelect,
        }),
        prisma.user.findMany({
          where: {
            managerId: rawUser.managerId,
            id: { not: userId },
            isActive: true,
          },
          orderBy: { name: "asc" },
          select: safeDirectorySelect,
        }),
      ]);

      if (rawManager) {
        manager = {
          id: rawManager.id,
          name: rawManager.name,
          email: rawManager.email,
          role: rawManager.role,
          isActive: rawManager.isActive,
          departmentId: rawManager.departmentId,
          department: rawManager.department,
          managerId: rawManager.managerId,
          manager: rawManager.manager,
          directReportsCount: rawManager._count?.reports ?? 0,
          createdAt: rawManager.createdAt,
        };
      }

      peers = rawPeers.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        role: p.role,
        isActive: p.isActive,
        departmentId: p.departmentId,
        department: p.department,
        managerId: p.managerId,
        manager: p.manager,
        directReportsCount: p._count?.reports ?? 0,
        createdAt: p.createdAt,
      }));
    }

    const rawReports = await prisma.user.findMany({
      where: {
        managerId: userId,
        isActive: true,
      },
      orderBy: { name: "asc" },
      select: safeDirectorySelect,
    });

    const directReports: DirectoryUserDTO[] = rawReports.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      isActive: r.isActive,
      departmentId: r.departmentId,
      department: r.department,
      managerId: r.managerId,
      manager: r.manager,
      directReportsCount: r._count?.reports ?? 0,
      createdAt: r.createdAt,
    }));

    return {
      user,
      manager,
      peers,
      directReports,
    };
  }
}

export const directoryRepository = new DirectoryRepository();
