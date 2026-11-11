import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const DEFAULT_DEPARTMENTS = ["Engineering", "Human Resources", "IT", "Finance", "Operations"];

export interface CreateOrganizationData {
  name: string;
  slug: string;
  initialAdmin?: {
    name: string;
    email: string;
    passwordHash: string;
  };
}

export class OrganizationRepository {
  async findAll(filters: {
    search?: string;
    isActive?: boolean;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.OrganizationWhereInput = {};

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.organization.count({ where }),
      prisma.organization.findMany({
        where,
        skip: filters.skip,
        take: filters.take,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              users: true,
              departments: true,
              workRequests: true,
              documents: true,
            },
          },
        },
      }),
    ]);

    return { total, items };
  }

  async findById(id: string) {
    return prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            departments: true,
            workRequests: true,
            documents: true,
          },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    return prisma.organization.findUnique({
      where: { slug: slug.toLowerCase().trim() },
    });
  }

  async createWithDefaults(data: CreateOrganizationData) {
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: data.name,
          slug: data.slug.toLowerCase().trim(),
          isActive: true,
        },
      });

      await tx.department.createMany({
        data: DEFAULT_DEPARTMENTS.map((name) => ({
          name,
          organizationId: organization.id,
        })),
      });

      let initialAdmin = null;
      if (data.initialAdmin) {
        const itDept = await tx.department.findFirst({
          where: { organizationId: organization.id, name: "IT" },
        });

        initialAdmin = await tx.user.create({
          data: {
            name: data.initialAdmin.name,
            email: data.initialAdmin.email.toLowerCase().trim(),
            passwordHash: data.initialAdmin.passwordHash,
            role: Role.ADMIN,
            isActive: true,
            organizationId: organization.id,
            departmentId: itDept?.id ?? null,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            organizationId: true,
            departmentId: true,
            createdAt: true,
          },
        });
      }

      const fullOrg = await tx.organization.findUnique({
        where: { id: organization.id },
        include: {
          _count: {
            select: {
              users: true,
              departments: true,
              workRequests: true,
              documents: true,
            },
          },
        },
      });

      return { organization: fullOrg ?? organization, initialAdmin };
    });
  }

  async update(
    id: string,
    data: { name?: string; slug?: string; isActive?: boolean }
  ) {
    return prisma.organization.update({
      where: { id },
      data,
      include: {
        _count: {
          select: {
            users: true,
            departments: true,
            workRequests: true,
            documents: true,
          },
        },
      },
    });
  }
}

export const organizationRepository = new OrganizationRepository();
