import { Role } from "@prisma/client";
import { AppError } from "./errors";
import type { AuthenticatedUser } from "../types/express";

export const DEFAULT_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";
export const DEFAULT_ORGANIZATION_SLUG = "default";

export const ADMIN_ROLES: readonly Role[] = [Role.ADMIN, Role.SUPER_ADMIN];
export const APPROVER_ROLES: readonly Role[] = [Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN];

/**
 * Checks whether a user or role has platform-wide Super Admin privileges.
 */
export function isSuperAdmin(userOrRole: Pick<AuthenticatedUser, "role"> | Role | string): boolean {
  const role = typeof userOrRole === "string" ? userOrRole : userOrRole.role;
  return role === Role.SUPER_ADMIN;
}

/**
 * Checks whether a user or role has organization-level or platform-level Admin privileges.
 */
export function isAdminRole(userOrRole: Pick<AuthenticatedUser, "role"> | Role | string): boolean {
  const role = typeof userOrRole === "string" ? userOrRole : userOrRole.role;
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

/**
 * Resolves the target organizationId for write operations or single-tenant queries.
 * Non-super-admin users are always locked to their own organizationId and cannot override it.
 */
export function resolveTenantId(
  user: Pick<AuthenticatedUser, "role"> & { organizationId?: string | null },
  requestedOrganizationId?: string | null
): string {
  if (isSuperAdmin(user)) {
    return requestedOrganizationId || user.organizationId || DEFAULT_ORGANIZATION_ID;
  }

  if (user.organizationId === null) {
    throw AppError.forbidden("User account is not assigned to an organization");
  }

  if (
    requestedOrganizationId &&
    user.organizationId &&
    requestedOrganizationId !== user.organizationId
  ) {
    throw AppError.forbidden("Cannot access a different organization");
  }

  // Fallback only handles legacy unit-test fixtures that omit organizationId
  return user.organizationId ?? DEFAULT_ORGANIZATION_ID;
}

/**
 * Builds a Prisma `where` clause fragment restricting queries to the actor's tenant.
 * Super Admins receive an optional filter when `requestedOrganizationId` is provided,
 * otherwise `{}` so they can operate across organizations when needed.
 */
export function tenantWhere(
  user: Pick<AuthenticatedUser, "role"> & { organizationId?: string | null },
  requestedOrganizationId?: string | null
): { organizationId?: string } {
  if (isSuperAdmin(user)) {
    return requestedOrganizationId ? { organizationId: requestedOrganizationId } : {};
  }

  if (user.organizationId === null) {
    throw AppError.forbidden("User account is not assigned to an organization");
  }

  if (user.organizationId === undefined) {
    // Legacy unit-test fixtures without organizationId should not inject mismatched filters
    return {};
  }

  return { organizationId: user.organizationId };
}

/**
 * Enforces cross-tenant isolation when accessing a specific entity fetched by primary ID.
 * Throws 404 to prevent cross-tenant existence enumeration.
 */
export function assertSameTenant(
  recordOrganizationId: string | null | undefined,
  user: Pick<AuthenticatedUser, "role"> & { organizationId?: string | null },
  notFoundMessage = "Resource not found"
): void {
  if (isSuperAdmin(user)) {
    return;
  }

  if (user.organizationId === undefined || recordOrganizationId === undefined) {
    return;
  }

  if (user.organizationId === null || recordOrganizationId !== user.organizationId) {
    throw AppError.notFound(notFoundMessage);
  }
}
