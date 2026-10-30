import { Prisma, Document } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export const documentRepository = {
  async create(data: Prisma.DocumentCreateInput): Promise<Document> {
    return prisma.document.create({
      data,
      include: {
        department: true,
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

  async findById(id: string) {
    return prisma.document.findUnique({
      where: { id },
      include: {
        department: true,
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
          },
        },
      },
    });
  },

  async findMany(
    where: Prisma.DocumentWhereInput,
    options: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.DocumentOrderByWithRelationInput;
    }
  ) {
    return prisma.document.findMany({
      where,
      skip: options.skip,
      take: options.take,
      orderBy: options.orderBy,
      include: {
        department: true,
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
          },
        },
      },
    });
  },

  async count(where: Prisma.DocumentWhereInput): Promise<number> {
    return prisma.document.count({ where });
  },

  async update(id: string, data: Prisma.DocumentUpdateInput) {
    return prisma.document.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    // Delete chunks first (explicit cascade)
    await prisma.documentChunk.deleteMany({
      where: { documentId: id },
    });
    return prisma.document.delete({
      where: { id },
    });
  },

  async deleteChunks(documentId: string) {
    return prisma.documentChunk.deleteMany({
      where: { documentId },
    });
  },
};
