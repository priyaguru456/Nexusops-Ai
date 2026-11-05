import { Prisma, Document, Acknowledgement, User, Department } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export interface PolicyWithRelations extends Document {
  department?: Department | null;
  targetDepartment?: Department | null;
  uploadedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  _count?: {
    chunks: number;
    acknowledgements: number;
  };
}

export const policyRepository = {
  async findPolicyById(id: string): Promise<PolicyWithRelations | null> {
    return prisma.document.findUnique({
      where: { id },
      include: {
        department: true,
        targetDepartment: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            chunks: true,
            acknowledgements: true,
          },
        },
      },
    });
  },

  async createPolicy(data: Prisma.DocumentCreateInput): Promise<Document> {
    return prisma.document.create({
      data,
      include: {
        department: true,
        targetDepartment: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  async updatePolicy(id: string, data: Prisma.DocumentUpdateInput): Promise<Document> {
    return prisma.document.update({
      where: { id },
      data,
      include: {
        department: true,
        targetDepartment: true,
      },
    });
  },

  async findPolicies(
    where: Prisma.DocumentWhereInput,
    options: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.DocumentOrderByWithRelationInput;
    } = {}
  ): Promise<PolicyWithRelations[]> {
    const skip = options.skip !== undefined ? Math.max(0, Number(options.skip) || 0) : undefined;
    const take = options.take !== undefined ? Math.max(1, Number(options.take) || 20) : undefined;

    return prisma.document.findMany({
      where,
      skip,
      take,
      orderBy: options.orderBy || { createdAt: "desc" },
      include: {
        department: true,
        targetDepartment: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            chunks: true,
            acknowledgements: true,
          },
        },
      },
    });
  },

  async countPolicies(where: Prisma.DocumentWhereInput): Promise<number> {
    return prisma.document.count({ where });
  },

  async findAcknowledgement(
    documentId: string,
    userId: string,
    version: number
  ): Promise<Acknowledgement | null> {
    return prisma.acknowledgement.findUnique({
      where: {
        documentId_userId_version: {
          documentId,
          userId,
          version,
        },
      },
    });
  },

  async createAcknowledgement(data: {
    documentId: string;
    userId: string;
    version: number;
  }): Promise<Acknowledgement> {
    return prisma.acknowledgement.create({
      data: {
        documentId: data.documentId,
        userId: data.userId,
        version: data.version,
      },
    });
  },

  async findAcknowledgementsForUser(
    userId: string,
    documentIds: string[]
  ): Promise<Acknowledgement[]> {
    if (documentIds.length === 0) return [];
    return prisma.acknowledgement.findMany({
      where: {
        userId,
        documentId: { in: documentIds },
      },
    });
  },

  async findPolicyAcknowledgementHistory(documentId: string): Promise<
    (Acknowledgement & {
      user: { id: string; name: string; email: string; department: { id: string; name: string } | null };
    })[]
  > {
    return prisma.acknowledgement.findMany({
      where: { documentId },
      orderBy: { acknowledgedAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  },

  async findActiveUsers(departmentId?: string): Promise<
    (User & {
      department: Department | null;
    })[]
  > {
    return prisma.user.findMany({
      where: {
        isActive: true,
        ...(departmentId ? { departmentId } : {}),
      },
      include: {
        department: true,
      },
      orderBy: { name: "asc" },
    });
  },

  async findAllDepartments(): Promise<Department[]> {
    return prisma.department.findMany({
      orderBy: { name: "asc" },
    });
  },

  async findAcknowledgementsForPolicies(
    documentIds: string[]
  ): Promise<Acknowledgement[]> {
    if (documentIds.length === 0) return [];
    return prisma.acknowledgement.findMany({
      where: {
        documentId: { in: documentIds },
      },
    });
  },
};
