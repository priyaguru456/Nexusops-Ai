import bcrypt from "bcryptjs";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";
import { auditService } from "../audit/audit.service";
import { userRepository } from "../users/user.repository";
import { organizationRepository } from "./organization.repository";
import type {
  CreateOrganizationInput,
  GetOrganizationsQuery,
  UpdateOrganizationInput,
} from "./organization.schema";
import type { AuthenticatedUser } from "../../types/express";

export class OrganizationService {
  async list(query: GetOrganizationsQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { total, items } = await organizationRepository.findAll({
      search: query.search,
      isActive: query.isActive,
      skip,
      take: limit,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getById(id: string) {
    const org = await organizationRepository.findById(id);
    if (!org) {
      throw AppError.notFound("Organization not found");
    }
    return org;
  }

  async create(input: CreateOrganizationInput, actor: AuthenticatedUser) {
    const existingSlug = await organizationRepository.findBySlug(input.slug);
    if (existingSlug) {
      throw AppError.conflict(`Organization slug '${input.slug}' is already taken`);
    }

    let initialAdmin:
      | { name: string; email: string; passwordHash: string }
      | undefined;

    if (input.adminEmail && input.adminName && input.adminPassword) {
      const existingUser = await userRepository.findByEmail(input.adminEmail);
      if (existingUser) {
        throw AppError.conflict("An account with the specified admin email already exists");
      }
      initialAdmin = {
        name: input.adminName,
        email: input.adminEmail,
        passwordHash: await bcrypt.hash(input.adminPassword, env.BCRYPT_ROUNDS),
      };
    }

    const result = await organizationRepository.createWithDefaults({
      name: input.name,
      slug: input.slug,
      initialAdmin,
    });

    await auditService.log({
      actorId: actor.id,
      organizationId: result.organization.id,
      action: "ORGANIZATION_CREATED",
      entityType: "Organization",
      entityId: result.organization.id,
      summary: `Created organization '${result.organization.name}' (${result.organization.slug})`,
      metadata: {
        slug: result.organization.slug,
        hasInitialAdmin: Boolean(result.initialAdmin),
      },
    });

    return result;
  }

  async update(id: string, input: UpdateOrganizationInput, actor: AuthenticatedUser) {
    const existing = await organizationRepository.findById(id);
    if (!existing) {
      throw AppError.notFound("Organization not found");
    }

    if (input.slug && input.slug !== existing.slug) {
      const slugMatch = await organizationRepository.findBySlug(input.slug);
      if (slugMatch) {
        throw AppError.conflict(`Organization slug '${input.slug}' is already taken`);
      }
    }

    const updated = await organizationRepository.update(id, {
      name: input.name,
      slug: input.slug,
      isActive: input.isActive,
    });

    await auditService.log({
      actorId: actor.id,
      organizationId: updated.id,
      action: "ORGANIZATION_UPDATED",
      entityType: "Organization",
      entityId: updated.id,
      summary: `Updated organization '${updated.name}'`,
      metadata: input,
    });

    return updated;
  }
}

export const organizationService = new OrganizationService();
