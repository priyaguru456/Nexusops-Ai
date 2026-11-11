import { Prisma, Role, DocVisibility, DocStatus, Document, Acknowledgement } from "@prisma/client";
import { AppError } from "../../lib/errors";
import { AuthenticatedUser } from "../../types/express";
import { storageService } from "../../lib/storage";
import { documentQueue } from "../../lib/queue";
import { documentRepository } from "../documents/document.repository";
import { validateMimeAndExtension } from "../documents/document.service";
import { policyRepository, PolicyWithRelations } from "./policy.repository";
import {
  CreatePolicyMetadataInput,
  UploadPolicyVersionMetadataInput,
  ListPoliciesQuery,
} from "./policy.schema";
import { auditService } from "../audit/audit.service";
import { notificationService } from "../notifications/notification.service";
import { logger } from "../../lib/logger";
import {
  assertSameTenant,
  isAdminRole,
  isSuperAdmin,
  resolveTenantId,
  tenantWhere,
} from "../../lib/tenant";

export function formatKolkataDateTime(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "N/A";
  return (
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(d) + " IST"
  );
}

export function canUserAccessPolicy(
  user: AuthenticatedUser,
  policy: {
    organizationId?: string;
    visibility: DocVisibility;
    departmentId: string | null;
    targetDepartmentId: string | null;
    uploadedById: string;
  }
): boolean {
  if (
    !isSuperAdmin(user) &&
    user.organizationId !== undefined &&
    policy.organizationId !== undefined &&
    policy.organizationId !== user.organizationId
  ) {
    return false;
  }

  if (isAdminRole(user)) return true;

  // If a target department is specified, user must belong to that department
  if (policy.targetDepartmentId && policy.targetDepartmentId !== user.departmentId) {
    return false;
  }

  // Standard document visibility checks
  if (policy.uploadedById === user.id) return true;
  if (policy.visibility === DocVisibility.ALL) return true;
  if (policy.visibility === DocVisibility.MANAGERS && user.role === Role.MANAGER) return true;
  if (
    policy.visibility === DocVisibility.DEPARTMENT &&
    policy.departmentId &&
    user.departmentId === policy.departmentId
  ) {
    return true;
  }

  return false;
}

export const policyService = {
  async create(
    file: Express.Multer.File,
    metadata: CreatePolicyMetadataInput,
    user: AuthenticatedUser
  ): Promise<Document> {
    if (!isAdminRole(user)) {
      throw AppError.forbidden("Only administrators can create new policies");
    }

    if (!file) {
      throw AppError.badRequest("Policy document file is required");
    }

    const organizationId = resolveTenantId(user);
    validateMimeAndExtension(file.originalname, file.mimetype);
    const stored = await storageService.save(file.buffer, file.originalname);

    const policy = await policyRepository.createPolicy({
      title: metadata.title,
      fileName: file.originalname,
      filePath: stored.relativePath,
      mimeType: file.mimetype,
      sizeBytes: stored.sizeBytes,
      category: metadata.category,
      isPolicy: true,
      isMandatory: metadata.isMandatory ?? false,
      version: 1,
      visibility: metadata.visibility || DocVisibility.ALL,
      status: DocStatus.UPLOADED,
      organization: { connect: { id: organizationId } },
      department: user.departmentId ? { connect: { id: user.departmentId } } : undefined,
      targetDepartment: metadata.targetDepartmentId
        ? { connect: { id: metadata.targetDepartmentId } }
        : undefined,
      uploadedBy: { connect: { id: user.id } },
    });

    try {
      await documentQueue.add("process-document", { documentId: policy.id });
    } catch (queueErr) {
      logger.error({ queueErr, policyId: policy.id }, "Failed to enqueue policy ingestion job");
    }

    await auditService.log({
      actorId: user.id,
      organizationId,
      action: "POLICY_CREATED",
      entityType: "Policy",
      entityId: policy.id,
      summary: `Created policy "${policy.title}" v1`,
      metadata: {
        title: policy.title,
        category: policy.category,
        isMandatory: policy.isMandatory,
        targetDepartmentId: metadata.targetDepartmentId || null,
        version: policy.version,
      },
    });

    // Notify target users within organization
    try {
      const activeUsers = await policyRepository.findActiveUsers(
        metadata.targetDepartmentId || undefined,
        organizationId
      );
      const userIdsToNotify = activeUsers.map((u) => u.id).filter((id) => id !== user.id);
      if (userIdsToNotify.length > 0) {
        await notificationService.notifyMultiple(
          userIdsToNotify,
          "POLICY_PUBLISHED",
          `New Policy: ${policy.title}`,
          `A new ${metadata.isMandatory ? "mandatory " : ""}policy "${policy.title}" has been published. Please review and acknowledge.`,
          `/policies/${policy.id}`,
          "Policy",
          policy.id
        );
      }
    } catch (notifyErr) {
      logger.warn({ notifyErr }, "Failed to dispatch policy created notification");
    }

    return policy;
  },

  async uploadNewVersion(
    policyId: string,
    file: Express.Multer.File,
    metadata: UploadPolicyVersionMetadataInput,
    user: AuthenticatedUser
  ): Promise<Document> {
    if (!isAdminRole(user)) {
      throw AppError.forbidden("Only administrators can upload a new policy version");
    }

    if (!file) {
      throw AppError.badRequest("New policy document file is required");
    }

    const existing = await policyRepository.findPolicyById(policyId);
    if (!existing || !existing.isPolicy) {
      throw AppError.notFound("Policy not found");
    }

    assertSameTenant(existing.organizationId, user, "Policy not found");

    validateMimeAndExtension(file.originalname, file.mimetype);
    const stored = await storageService.save(file.buffer, file.originalname);

    const oldVersion = existing.version;
    const newVersion = oldVersion + 1;

    // 1. Chunks from the old version must not stay in the index:
    // Delete old chunks before re-embedding new version
    await documentRepository.deleteChunks(policyId);

    // 2. Update document with incremented version and new file details
    // Note: old Acknowledgement records stay for history since version is part of composite key
    const updateData: Prisma.DocumentUpdateInput = {
      version: newVersion,
      fileName: file.originalname,
      filePath: stored.relativePath,
      mimeType: file.mimetype,
      sizeBytes: stored.sizeBytes,
      status: DocStatus.UPLOADED,
      errorMessage: null,
    };

    if (metadata.title) updateData.title = metadata.title;
    if (metadata.category) updateData.category = metadata.category;
    if (metadata.isMandatory !== undefined) updateData.isMandatory = metadata.isMandatory;
    if (metadata.visibility) updateData.visibility = metadata.visibility;
    if (metadata.targetDepartmentId !== undefined) {
      updateData.targetDepartment = metadata.targetDepartmentId
        ? { connect: { id: metadata.targetDepartmentId } }
        : { disconnect: true };
    }

    const updated = await policyRepository.updatePolicy(policyId, updateData);

    // 3. Enqueue document ingestion pipeline to re-embed latest version
    try {
      await documentQueue.add("process-document", { documentId: policyId });
    } catch (queueErr) {
      logger.error({ queueErr, policyId }, "Failed to enqueue re-embed job for new policy version");
    }

    // 4. Record audit log
    await auditService.log({
      actorId: user.id,
      organizationId: existing.organizationId,
      action: "POLICY_NEW_VERSION_UPLOADED",
      entityType: "Policy",
      entityId: policyId,
      summary: `Uploaded version ${newVersion} for policy "${updated.title}"`,
      metadata: {
        title: updated.title,
        oldVersion,
        newVersion,
        fileName: file.originalname,
      },
    });

    // 5. Notify all eligible users within organization that a new version requires acknowledgement
    try {
      const targetDeptId = updated.targetDepartmentId || undefined;
      const activeUsers = await policyRepository.findActiveUsers(
        targetDeptId,
        existing.organizationId
      );
      const recipientIds = activeUsers.map((u) => u.id).filter((id) => id !== user.id);
      if (recipientIds.length > 0) {
        await notificationService.notifyMultiple(
          recipientIds,
          "POLICY_VERSION_UPDATED",
          `Policy Updated: ${updated.title} (v${newVersion})`,
          `Policy "${updated.title}" has been updated to version ${newVersion}. Your acknowledgement has been reset; please review and re-acknowledge.`,
          `/policies/${updated.id}`,
          "Policy",
          updated.id
        );
      }
    } catch (notifyErr) {
      logger.warn({ notifyErr }, "Failed to send policy version update notifications");
    }

    return updated;
  },

  async list(query: ListPoliciesQuery, user: AuthenticatedUser) {
    const scope = tenantWhere(user);
    const conditions: Prisma.DocumentWhereInput[] = [{ isPolicy: true }, ...(scope.organizationId ? [scope] : [])];

    // Non-admins only see policies applicable to them
    if (!isAdminRole(user)) {
      const audienceConditions: Prisma.DocumentWhereInput[] = [
        { targetDepartmentId: null },
      ];
      if (user.departmentId) {
        audienceConditions.push({ targetDepartmentId: user.departmentId });
      }
      conditions.push({ OR: audienceConditions });

      // Check visibility constraints
      if (user.role === Role.MANAGER) {
        conditions.push({
          OR: [
            { visibility: DocVisibility.ALL },
            { visibility: DocVisibility.MANAGERS },
            ...(user.departmentId
              ? [{ visibility: DocVisibility.DEPARTMENT, departmentId: user.departmentId }]
              : []),
          ],
        });
      } else {
        // EMPLOYEE
        conditions.push({
          OR: [
            { visibility: DocVisibility.ALL },
            ...(user.departmentId
              ? [{ visibility: DocVisibility.DEPARTMENT, departmentId: user.departmentId }]
              : []),
          ],
        });
      }
    }

    if (query.search?.trim()) {
      conditions.push({
        OR: [
          { title: { contains: query.search.trim(), mode: "insensitive" } },
          { fileName: { contains: query.search.trim(), mode: "insensitive" } },
        ],
      });
    }

    if (query.category) {
      conditions.push({ category: query.category });
    }

    if (query.isMandatory !== undefined) {
      conditions.push({ isMandatory: query.isMandatory });
    }

    if (query.targetDepartmentId) {
      conditions.push({ targetDepartmentId: query.targetDepartmentId });
    }

    const where: Prisma.DocumentWhereInput = { AND: conditions };

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const allowedSortFields = ["createdAt", "title", "version", "category"] as const;
    const sortBy = allowedSortFields.includes(query.sortBy as any) ? query.sortBy : "createdAt";
    const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";
    const orderBy = { [sortBy]: sortOrder };

    const [policies, total] = await Promise.all([
      policyRepository.findPolicies(where, { skip, take: limit, orderBy }),
      policyRepository.countPolicies(where),
    ]);

    // Fetch user's acknowledgements for these policies
    const policyIds = policies.map((p) => p.id);
    const userAcks = await policyRepository.findAcknowledgementsForUser(user.id, policyIds);

    const acksByDocIdAndVersion = new Map<string, Acknowledgement>();
    for (const ack of userAcks) {
      acksByDocIdAndVersion.set(`${ack.documentId}:${ack.version}`, ack);
    }

    let items = policies.map((policy) => {
      const ack = acksByDocIdAndVersion.get(`${policy.id}:${policy.version}`);
      return {
        id: policy.id,
        title: policy.title,
        fileName: policy.fileName,
        category: policy.category,
        isMandatory: policy.isMandatory,
        version: policy.version,
        visibility: policy.visibility,
        status: policy.status,
        createdAt: policy.createdAt,
        targetDepartment: policy.targetDepartment
          ? { id: policy.targetDepartment.id, name: policy.targetDepartment.name }
          : null,
        department: policy.department
          ? { id: policy.department.id, name: policy.department.name }
          : null,
        uploadedBy: policy.uploadedBy,
        myAcknowledgement: {
          acknowledged: Boolean(ack),
          acknowledgedAt: ack ? ack.acknowledgedAt : null,
          version: policy.version,
        },
      };
    });

    // If query.acknowledged filter was passed, filter items
    if (query.acknowledged !== undefined) {
      items = items.filter((item) => item.myAcknowledgement.acknowledged === query.acknowledged);
    }

    return {
      policies: items,
      pagination: {
        page,
        limit,
        total: query.acknowledged !== undefined ? items.length : total,
        totalPages: Math.max(1, Math.ceil((query.acknowledged !== undefined ? items.length : total) / limit)),
      },
    };
  },

  async getById(id: string, user: AuthenticatedUser) {
    const policy = await policyRepository.findPolicyById(id);
    if (!policy || !policy.isPolicy) {
      throw AppError.notFound("Policy not found");
    }

    if (!canUserAccessPolicy(user, policy)) {
      throw AppError.forbidden("You do not have permission to access this policy");
    }

    const currentAck = await policyRepository.findAcknowledgement(policy.id, user.id, policy.version);
    const history = await policyRepository.findPolicyAcknowledgementHistory(policy.id);

    return {
      id: policy.id,
      title: policy.title,
      fileName: policy.fileName,
      category: policy.category,
      isMandatory: policy.isMandatory,
      version: policy.version,
      visibility: policy.visibility,
      status: policy.status,
      sizeBytes: policy.sizeBytes,
      createdAt: policy.createdAt,
      targetDepartment: policy.targetDepartment,
      department: policy.department,
      uploadedBy: policy.uploadedBy,
      myAcknowledgement: {
        acknowledged: Boolean(currentAck),
        acknowledgedAt: currentAck?.acknowledgedAt || null,
        version: policy.version,
      },
      acknowledgementHistory: isAdminRole(user) || user.role === Role.MANAGER ? history : undefined,
    };
  },

  async getMyStatus(user: AuthenticatedUser) {
    // 1. Get all policies applicable to this user within their organization
    const scope = tenantWhere(user);
    const where: Prisma.DocumentWhereInput = {
      isPolicy: true,
      ...scope,
      OR: [
        { targetDepartmentId: null },
        ...(user.departmentId ? [{ targetDepartmentId: user.departmentId }] : []),
      ],
    };

    const applicablePolicies = await policyRepository.findPolicies(where, {
      take: 1000,
      orderBy: { createdAt: "desc" },
    });

    const policyIds = applicablePolicies.map((p) => p.id);
    const userAcks = await policyRepository.findAcknowledgementsForUser(user.id, policyIds);

    const ackMap = new Map<string, Acknowledgement>();
    for (const ack of userAcks) {
      ackMap.set(`${ack.documentId}:${ack.version}`, ack);
    }

    const policyStatuses = applicablePolicies.map((p) => {
      const ack = ackMap.get(`${p.id}:${p.version}`);
      return {
        policyId: p.id,
        title: p.title,
        category: p.category,
        version: p.version,
        isMandatory: p.isMandatory,
        acknowledged: Boolean(ack),
        acknowledgedAt: ack ? ack.acknowledgedAt : null,
      };
    });

    const totalApplicable = policyStatuses.length;
    const acknowledgedCount = policyStatuses.filter((p) => p.acknowledged).length;
    const pendingCount = totalApplicable - acknowledgedCount;
    const mandatoryPendingCount = policyStatuses.filter((p) => p.isMandatory && !p.acknowledged).length;
    const complianceRate =
      totalApplicable > 0 ? Number(((acknowledgedCount / totalApplicable) * 100).toFixed(1)) : 100.0;

    return {
      userId: user.id,
      departmentId: user.departmentId,
      totalApplicable,
      acknowledgedCount,
      pendingCount,
      mandatoryPendingCount,
      complianceRate,
      policies: policyStatuses,
    };
  },

  async acknowledge(policyId: string, user: AuthenticatedUser, versionInput?: number) {
    const policy = await policyRepository.findPolicyById(policyId);
    if (!policy || !policy.isPolicy) {
      throw AppError.notFound("Policy not found");
    }

    if (!canUserAccessPolicy(user, policy)) {
      throw AppError.forbidden("You do not have permission to acknowledge this policy");
    }

    // Acknowledge current version only
    if (versionInput !== undefined && versionInput !== policy.version) {
      throw AppError.badRequest(
        `Can only acknowledge the current policy version (v${policy.version}). Received v${versionInput}.`
      );
    }

    // Check if already acknowledged for the current version
    const existing = await policyRepository.findAcknowledgement(policy.id, user.id, policy.version);
    if (existing) {
      return {
        alreadyAcknowledged: true,
        message: `Policy "${policy.title}" v${policy.version} was already acknowledged.`,
        acknowledgement: existing,
      };
    }

    const acknowledgement = await policyRepository.createAcknowledgement({
      documentId: policy.id,
      userId: user.id,
      version: policy.version,
    });

    await auditService.log({
      actorId: user.id,
      organizationId: policy.organizationId,
      action: "POLICY_ACKNOWLEDGED",
      entityType: "Policy",
      entityId: policy.id,
      summary: `User acknowledged policy "${policy.title}" v${policy.version}`,
      metadata: {
        title: policy.title,
        version: policy.version,
        acknowledgedAt: acknowledgement.acknowledgedAt,
      },
    });

    return {
      alreadyAcknowledged: false,
      message: `Policy "${policy.title}" v${policy.version} acknowledged successfully.`,
      acknowledgement,
    };
  },

  async getComplianceSummary(
    query: { departmentId?: string; policyId?: string },
    user: AuthenticatedUser
  ) {
    // Permission checks: Admin and Manager only
    if (user.role === Role.EMPLOYEE) {
      throw AppError.forbidden("Access denied: Compliance summary is restricted to Managers and Administrators");
    }

    let scopedDepartmentId: string | undefined = query.departmentId;

    if (user.role === Role.MANAGER) {
      // Manager sees ONLY their own department
      if (!user.departmentId) {
        throw AppError.forbidden("Manager has no assigned department");
      }

      if (query.departmentId && query.departmentId !== user.departmentId) {
        throw AppError.forbidden("Managers can only view compliance for their own department");
      }

      scopedDepartmentId = user.departmentId;
    }

    // Fetch active users and departments scoped to the actor's organization
    const scope = tenantWhere(user);
    const activeUsers = await policyRepository.findActiveUsers(
      scopedDepartmentId,
      scope.organizationId
    );
    const departments = await policyRepository.findAllDepartments(scope.organizationId);
    const departmentMap = new Map(departments.map((d) => [d.id, d.name]));

    // Fetch policies in scope
    const policyWhere: Prisma.DocumentWhereInput = { isPolicy: true, ...scope };
    if (query.policyId) {
      policyWhere.id = query.policyId;
    }
    if (scopedDepartmentId) {
      policyWhere.OR = [
        { targetDepartmentId: null },
        { targetDepartmentId: scopedDepartmentId },
      ];
    }

    const policies = await policyRepository.findPolicies(policyWhere, {
      take: 1000,
      orderBy: { createdAt: "desc" },
    });

    // Fetch current acknowledgements for these policies
    const policyIds = policies.map((p) => p.id);
    const acknowledgements = await policyRepository.findAcknowledgementsForPolicies(policyIds);

    // Group acknowledgements by `${documentId}:${version}:${userId}`
    const acksSet = new Set<string>();
    for (const ack of acknowledgements) {
      acksSet.add(`${ack.documentId}:${ack.version}:${ack.userId}`);
    }

    // 1. Policy breakdown
    const policiesBreakdown = policies.map((policy) => {
      // Determine eligible users for this policy
      let eligibleUsers = activeUsers;
      if (policy.targetDepartmentId) {
        eligibleUsers = activeUsers.filter((u) => u.departmentId === policy.targetDepartmentId);
      }

      const totalEligible = eligibleUsers.length;
      let acknowledgedCount = 0;

      for (const u of eligibleUsers) {
        if (acksSet.has(`${policy.id}:${policy.version}:${u.id}`)) {
          acknowledgedCount++;
        }
      }

      const pendingCount = Math.max(0, totalEligible - acknowledgedCount);
      const compliancePercentage =
        totalEligible > 0
          ? Number(((acknowledgedCount / totalEligible) * 100).toFixed(1))
          : 100.0;

      return {
        policyId: policy.id,
        title: policy.title,
        category: policy.category,
        version: policy.version,
        isMandatory: policy.isMandatory,
        targetDepartmentId: policy.targetDepartmentId,
        targetDepartmentName: policy.targetDepartmentId
          ? departmentMap.get(policy.targetDepartmentId) || "Unknown"
          : "All Departments",
        totalEligible,
        acknowledgedCount,
        pendingCount,
        compliancePercentage,
      };
    });

    // 2. Department breakdown
    const deptsToReport = scopedDepartmentId
      ? departments.filter((d) => d.id === scopedDepartmentId)
      : departments;

    const departmentsBreakdown = deptsToReport.map((dept) => {
      const deptUsers = activeUsers.filter((u) => u.departmentId === dept.id);
      const deptUserIds = new Set(deptUsers.map((u) => u.id));

      // Policies applicable to this department
      const applicablePolicies = policies.filter(
        (p) => !p.targetDepartmentId || p.targetDepartmentId === dept.id
      );

      let totalRequirements = 0;
      let completedCount = 0;

      for (const p of applicablePolicies) {
        for (const u of deptUsers) {
          totalRequirements++;
          if (acksSet.has(`${p.id}:${p.version}:${u.id}`)) {
            completedCount++;
          }
        }
      }

      const pendingCount = Math.max(0, totalRequirements - completedCount);
      const compliancePercentage =
        totalRequirements > 0
          ? Number(((completedCount / totalRequirements) * 100).toFixed(1))
          : 100.0;

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        totalUsers: deptUsers.length,
        totalRequirements,
        completedCount,
        pendingCount,
        compliancePercentage,
      };
    });

    // 3. Overall Summary
    let totalRequirementsOverall = 0;
    let totalCompletedOverall = 0;
    for (const pb of policiesBreakdown) {
      totalRequirementsOverall += pb.totalEligible;
      totalCompletedOverall += pb.acknowledgedCount;
    }

    const overallComplianceRate =
      totalRequirementsOverall > 0
        ? Number(((totalCompletedOverall / totalRequirementsOverall) * 100).toFixed(1))
        : 100.0;

    return {
      summary: {
        totalPolicies: policies.length,
        mandatoryPolicies: policies.filter((p) => p.isMandatory).length,
        totalUsersInScope: activeUsers.length,
        totalRequirements: totalRequirementsOverall,
        totalCompleted: totalCompletedOverall,
        totalPending: Math.max(0, totalRequirementsOverall - totalCompletedOverall),
        overallComplianceRate,
        scopedDepartmentId: scopedDepartmentId || null,
        scopedDepartmentName: scopedDepartmentId ? departmentMap.get(scopedDepartmentId) || null : null,
      },
      policiesBreakdown,
      departmentsBreakdown,
    };
  },

  async exportComplianceCsv(
    query: { departmentId?: string; policyId?: string },
    user: AuthenticatedUser
  ): Promise<{ csv: string; fileName: string }> {
    // Enforce role permissions
    if (user.role === Role.EMPLOYEE) {
      throw AppError.forbidden("Access denied: CSV export is restricted to Managers and Administrators");
    }

    let scopedDepartmentId: string | undefined = query.departmentId;

    if (user.role === Role.MANAGER) {
      if (!user.departmentId) {
        throw AppError.forbidden("Manager has no assigned department");
      }
      if (query.departmentId && query.departmentId !== user.departmentId) {
        throw AppError.forbidden("Managers can only export compliance for their own department");
      }
      scopedDepartmentId = user.departmentId;
    }

    const scope = tenantWhere(user);
    const activeUsers = await policyRepository.findActiveUsers(
      scopedDepartmentId,
      scope.organizationId
    );
    const departments = await policyRepository.findAllDepartments(scope.organizationId);
    const departmentMap = new Map(departments.map((d) => [d.id, d.name]));

    const policyWhere: Prisma.DocumentWhereInput = { isPolicy: true, ...scope };
    if (query.policyId) {
      policyWhere.id = query.policyId;
    }
    if (scopedDepartmentId) {
      policyWhere.OR = [
        { targetDepartmentId: null },
        { targetDepartmentId: scopedDepartmentId },
      ];
    }

    const policies = await policyRepository.findPolicies(policyWhere, {
      take: 1000,
      orderBy: { title: "asc" },
    });

    const policyIds = policies.map((p) => p.id);
    const acknowledgements = await policyRepository.findAcknowledgementsForPolicies(policyIds);

    const ackDetailsMap = new Map<string, Acknowledgement>();
    for (const ack of acknowledgements) {
      ackDetailsMap.set(`${ack.documentId}:${ack.version}:${ack.userId}`, ack);
    }

    // Helper for CSV escaping (RFC 4180)
    const escapeCsv = (val: string | number | boolean | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      "Policy Title",
      "Category",
      "Version",
      "Mandatory",
      "Target Department",
      "User Name",
      "User Email",
      "User Department",
      "Status",
      "Acknowledged At (IST)",
    ];

    const rows: string[] = [headers.map(escapeCsv).join(",")];

    for (const policy of policies) {
      let eligibleUsers = activeUsers;
      if (policy.targetDepartmentId) {
        eligibleUsers = activeUsers.filter((u) => u.departmentId === policy.targetDepartmentId);
      }

      const targetDeptName = policy.targetDepartmentId
        ? departmentMap.get(policy.targetDepartmentId) || "Department Specific"
        : "All Departments";

      for (const u of eligibleUsers) {
        const ack = ackDetailsMap.get(`${policy.id}:${policy.version}:${u.id}`);
        const isAcked = Boolean(ack);
        const ackDateIst = ack ? formatKolkataDateTime(ack.acknowledgedAt) : "N/A";
        const userDeptName = u.department?.name || "Unassigned";

        rows.push(
          [
            policy.title,
            policy.category || "OTHER",
            `v${policy.version}`,
            policy.isMandatory ? "Yes" : "No",
            targetDeptName,
            u.name,
            u.email,
            userDeptName,
            isAcked ? "ACKNOWLEDGED" : "PENDING",
            ackDateIst,
          ]
            .map(escapeCsv)
            .join(",")
        );
      }
    }

    const csv = rows.join("\r\n");
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `policy-compliance-report-${timestamp}.csv`;

    await auditService.log({
      actorId: user.id,
      organizationId: resolveTenantId(user),
      action: "POLICY_COMPLIANCE_EXPORTED",
      entityType: "Policy",
      entityId: scopedDepartmentId || "ALL",
      summary: `Exported policy compliance CSV report (${rows.length - 1} records)`,
      metadata: {
        recordsCount: rows.length - 1,
        scopedDepartmentId: scopedDepartmentId || "ALL",
      },
    });

    return { csv, fileName };
  },
};
