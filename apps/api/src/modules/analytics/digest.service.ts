import { DigestSchedule, DigestDelivery, DigestDeliveryStatus, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { DEFAULT_ORGANIZATION_ID } from "../../lib/tenant";
import { analyticsService, AnalyticsOverview } from "./analytics.service";
import { emailService } from "../../lib/email.service";
import { auditService } from "../audit/audit.service";
import { logger } from "../../lib/logger";
import { env } from "../../config/env";
import { AuthenticatedUser } from "../../types/express";

export interface ZonedTime {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  hour: number;      // 0 - 23
  minute: number;
  dateStr: string;   // YYYY-MM-DD in zoned time
}

/**
 * Calculates current dayOfWeek and hour for a given date in any IANA timezone.
 */
export function getZonedTime(date: Date, timeZone: string): ZonedTime {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const partMap: Record<string, string> = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    const dayOfWeek = weekdayMap[partMap.weekday] ?? 0;
    const hour = parseInt(partMap.hour, 10) % 24;
    const minute = parseInt(partMap.minute, 10);
    const dateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;

    return { dayOfWeek, hour, minute, dateStr };
  } catch (err) {
    // Fallback to UTC if timezone string is invalid
    return {
      dayOfWeek: date.getUTCDay(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      dateStr: date.toISOString().slice(0, 10),
    };
  }
}

/**
 * Checks whether a weekly digest schedule is due to run at the given timestamp.
 */
export function isScheduleDue(schedule: DigestSchedule, now: Date = new Date()): boolean {
  if (!schedule.isActive) return false;

  const tz = schedule.timezone || "Asia/Kolkata";
  const currentZoned = getZonedTime(now, tz);

  // Must match configured day of week and hour
  if (currentZoned.dayOfWeek !== schedule.dayOfWeek) return false;
  if (currentZoned.hour !== schedule.hour) return false;

  // Prevent duplicate sends if it already ran today in this timezone
  if (schedule.lastRunAt) {
    const lastRunZoned = getZonedTime(schedule.lastRunAt, tz);
    if (lastRunZoned.dateStr === currentZoned.dateStr) {
      return false;
    }
    // Safety buffer: at least 20 hours must elapse between weekly executions
    const elapsedMs = now.getTime() - schedule.lastRunAt.getTime();
    if (elapsedMs < 20 * 3600 * 1000) {
      return false;
    }
  }

  return true;
}

export class DigestService {
  /**
   * Retrieves the configured DigestSchedule for an organization (or null if none exists).
   */
  async getSchedule(organizationId?: string): Promise<DigestSchedule | null> {
    return prisma.digestSchedule.findFirst({
      where: organizationId ? { organizationId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Upserts the weekly digest schedule for an organization.
   */
  async saveSchedule(
    userId: string,
    data: {
      recipients: string[];
      dayOfWeek: number;
      hour: number;
      timezone?: string;
      isActive?: boolean;
    },
    organizationId: string = DEFAULT_ORGANIZATION_ID
  ): Promise<DigestSchedule> {
    const timezone = data.timezone || "Asia/Kolkata";
    const isActive = data.isActive !== undefined ? data.isActive : true;

    // Clean recipients
    const recipients = Array.from(
      new Set(data.recipients.map((e) => e.trim().toLowerCase()).filter(Boolean))
    );

    const existing = await prisma.digestSchedule.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    let saved: DigestSchedule;
    if (existing) {
      saved = await prisma.digestSchedule.update({
        where: { id: existing.id },
        data: {
          recipients,
          dayOfWeek: data.dayOfWeek,
          hour: data.hour,
          timezone,
          isActive,
        },
      });
    } else {
      saved = await prisma.digestSchedule.create({
        data: {
          organizationId,
          recipients,
          dayOfWeek: data.dayOfWeek,
          hour: data.hour,
          timezone,
          isActive,
          createdBy: userId,
        },
      });
    }

    // Record audit log
    await auditService.log({
      organizationId,
      actorId: userId,
      action: "DIGEST_SCHEDULE_CONFIGURED",
      entityType: "DIGEST_SCHEDULE",
      entityId: saved.id,
      metadata: {
        recipientsCount: recipients.length,
        dayOfWeek: data.dayOfWeek,
        hour: data.hour,
        timezone,
        isActive,
      },
      summary: `Configured weekly analytics digest schedule for day ${data.dayOfWeek} at ${data.hour}:00 (${timezone})`,
    });

    return saved;
  }

  /**
   * Returns recent deliveries ordered by sentAt descending, scoped to an organization when specified.
   */
  async getDeliveries(
    page = 1,
    limit = 20,
    organizationId?: string
  ): Promise<{
    deliveries: DigestDelivery[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const where = organizationId ? { schedule: { organizationId } } : undefined;
    const [deliveries, total] = await Promise.all([
      prisma.digestDelivery.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: "desc" },
        include: {
          schedule: {
            select: {
              recipients: true,
              timezone: true,
            },
          },
        },
      }),
      prisma.digestDelivery.count({ where }),
    ]);

    return {
      deliveries,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Atomically claims execution for a schedule to prevent race conditions or duplicate sends.
   */
  async claimScheduleExecution(scheduleId: string, now: Date = new Date()): Promise<boolean> {
    const twentyHoursAgo = new Date(now.getTime() - 20 * 3600 * 1000);

    const result = await prisma.digestSchedule.updateMany({
      where: {
        id: scheduleId,
        isActive: true,
        OR: [
          { lastRunAt: null },
          { lastRunAt: { lt: twentyHoursAgo } },
        ],
      },
      data: {
        lastRunAt: now,
      },
    });

    return result.count > 0;
  }

  /**
   * Compiles the previous 7 days KPI summary using existing analytics service queries.
   */
  async compileDigestSummary(
    fromDate: Date,
    toDate: Date,
    organizationId: string | null = DEFAULT_ORGANIZATION_ID
  ): Promise<AnalyticsOverview> {
    const systemAdmin: AuthenticatedUser = {
      id: "system-admin-digest",
      name: "NexusOps System",
      email: "system@nexusops.com",
      role: organizationId === null ? Role.SUPER_ADMIN : Role.ADMIN,
      isActive: true,
      organizationId,
      departmentId: null,
      managerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return analyticsService.getOverview(systemAdmin, fromDate, toDate);
  }

  /**
   * Formats a date into a clean Asia/Kolkata string.
   */
  formatDateInZone(date: Date, timeZone: string): string {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  /**
   * Renders email-client safe, responsive HTML for the weekly analytics digest.
   */
  renderDigestHtml(
    overview: AnalyticsOverview,
    fromDate: Date,
    toDate: Date,
    timezone: string = "Asia/Kolkata"
  ): string {
    const fromStr = this.formatDateInZone(fromDate, timezone);
    const toStr = this.formatDateInZone(toDate, timezone);
    const clientUrl = env.CLIENT_URL || "http://localhost:5173";
    const dashboardLink = `${clientUrl}/analytics`;

    const totalRequests = overview.totals.totalRequests;
    const completedRequests = overview.totals.completed;
    const openRequests = overview.totals.open;
    const approvedRequests = overview.totals.approved;
    const rejectedRequests = overview.totals.rejected;

    const avgApproval = overview.performance.avgApprovalTimeHours !== null
      ? `${overview.performance.avgApprovalTimeHours.toFixed(1)}h`
      : "N/A";
    const avgCompletion = overview.performance.avgCompletionTimeHours !== null
      ? `${overview.performance.avgCompletionTimeHours.toFixed(1)}h`
      : "N/A";

    const totalTasks = overview.tasks.total;
    const doneTasks = overview.tasks.done;
    const inProgressTasks = overview.tasks.inProgress;
    const overdueTasks = overview.tasks.overdue;

    const totalQuestions = overview.aiSummary?.totalQuestions ?? 0;
    const avgLatency = overview.aiSummary?.avgLatencyMs !== null && overview.aiSummary?.avgLatencyMs !== undefined
      ? `${Math.round(overview.aiSummary.avgLatencyMs)}ms`
      : "N/A";
    const estimatedCost = overview.aiSummary?.estimatedCostUsd !== undefined
      ? `$${overview.aiSummary.estimatedCostUsd.toFixed(2)}`
      : "$0.00";

    const categoryRows = overview.requestsByCategory.length > 0
      ? overview.requestsByCategory
          .slice(0, 5)
          .map(
            (c) => `
              <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b;">${c.category}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right;">${c.count}</td>
              </tr>
            `
          )
          .join("")
      : `
        <tr>
          <td colspan="2" style="padding: 12px; text-align: center; color: #64748b; font-size: 13px;">No requests recorded this period.</td>
        </tr>
      `;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NexusOps AI - Weekly Analytics Digest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Brand Header -->
          <tr>
            <td style="background-color: #4f46e5; padding: 28px 32px; text-align: left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">NexusOps AI</div>
                    <div style="font-size: 14px; color: #c7d2fe; margin-top: 4px; font-weight: 500;">Weekly Operations & Analytics Digest</div>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(255, 255, 255, 0.2); border-radius: 9999px; font-size: 11px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">
                      7-Day KPI
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary Period Subheader -->
          <tr>
            <td style="padding: 20px 32px 8px 32px; border-bottom: 1px solid #f1f5f9;">
              <p style="margin: 0; font-size: 13px; color: #64748b; font-weight: 500;">
                Summary period: <strong style="color: #1e293b;">${fromStr} – ${toStr}</strong> (${timezone})
              </p>
            </td>
          </tr>

          <!-- KPI Cards Grid -->
          <tr>
            <td style="padding: 24px 32px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Card 1: Requests -->
                  <td width="48%" style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; vertical-align: top;">
                    <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; letter-spacing: 0.5px;">Work Requests</div>
                    <div style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 4px 0;">${totalRequests}</div>
                    <div style="font-size: 12px; color: #64748b;">
                      <span style="color: #16a34a; font-weight: 600;">${completedRequests}</span> completed · 
                      <span style="color: #2563eb; font-weight: 600;">${openRequests}</span> open
                    </div>
                  </td>
                  <td width="4%">&nbsp;</td>
                  <!-- Card 2: Tasks -->
                  <td width="48%" style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; vertical-align: top;">
                    <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; letter-spacing: 0.5px;">Team Tasks</div>
                    <div style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 4px 0;">${totalTasks}</div>
                    <div style="font-size: 12px; color: #64748b;">
                      <span style="color: #16a34a; font-weight: 600;">${doneTasks}</span> done · 
                      <span style="color: #dc2626; font-weight: 600;">${overdueTasks}</span> overdue
                    </div>
                  </td>
                </tr>
                <tr><td height="16" colspan="3"></td></tr>
                <tr>
                  <!-- Card 3: Performance -->
                  <td width="48%" style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; vertical-align: top;">
                    <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; letter-spacing: 0.5px;">Avg Turnaround</div>
                    <div style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 4px 0;">${avgCompletion}</div>
                    <div style="font-size: 12px; color: #64748b;">
                      Avg approval: <strong style="color: #1e293b;">${avgApproval}</strong>
                    </div>
                  </td>
                  <td width="4%">&nbsp;</td>
                  <!-- Card 4: AI & RAG Usage -->
                  <td width="48%" style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; vertical-align: top;">
                    <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; letter-spacing: 0.5px;">AI Queries & Cost</div>
                    <div style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 4px 0;">${totalQuestions}</div>
                    <div style="font-size: 12px; color: #64748b;">
                      Latency: ${avgLatency} · Cost: <strong style="color: #16a34a;">${estimatedCost}</strong>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Requests by Category Table -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #0f172a;">Top Requests by Category</h3>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f8fafc;">
                    <th align="left" style="padding: 8px 12px; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Category</th>
                    <th align="right" style="padding: 8px 12px; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Count</th>
                  </tr>
                </thead>
                <tbody>
                  ${categoryRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Action Button CTA -->
          <tr>
            <td align="center" style="padding: 8px 32px 32px 32px;">
              <a href="${dashboardLink}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);">
                View Full Analytics Dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                This automated digest is generated weekly by NexusOps AI Operations Platform.<br>
                To modify recipient settings, configure your preferences on the Analytics dashboard.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Dispatches the weekly email digest to recipients and creates a DigestDelivery log.
   */
  async sendDigest(options: {
    scheduleId?: string;
    organizationId?: string | null;
    recipients: string[];
    isTest?: boolean;
    timezone?: string;
  }): Promise<{ success: boolean; deliveryId: string; error?: string }> {
    const tz = options.timezone || "Asia/Kolkata";
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - 7 * 24 * 3600 * 1000);

    const recipients = Array.from(
      new Set(options.recipients.map((r) => r.trim()).filter(Boolean))
    );

    if (recipients.length === 0) {
      throw new Error("No recipients specified for email digest.");
    }

    // 1. Pre-create delivery log in PENDING status
    const delivery = await prisma.digestDelivery.create({
      data: {
        scheduleId: options.scheduleId || null,
        status: DigestDeliveryStatus.PENDING,
        recipientCount: recipients.length,
      },
    });

    try {
      // 2. Compile real KPI overview scoped to organization
      const overview = await this.compileDigestSummary(
        fromDate,
        toDate,
        options.organizationId !== undefined ? options.organizationId : DEFAULT_ORGANIZATION_ID
      );

      // 3. Render email HTML
      const html = this.renderDigestHtml(overview, fromDate, toDate, tz);
      const subject = options.isTest
        ? `[TEST] NexusOps AI - Weekly Analytics Digest (${this.formatDateInZone(toDate, tz)})`
        : `NexusOps AI - Weekly Analytics Digest (${this.formatDateInZone(toDate, tz)})`;

      // 4. Send email via email service
      await emailService.sendEmail({
        to: recipients,
        subject,
        html,
      });

      // 5. Update delivery status to SUCCESS
      await prisma.digestDelivery.update({
        where: { id: delivery.id },
        data: {
          status: DigestDeliveryStatus.SUCCESS,
          sentAt: new Date(),
        },
      });

      logger.info(
        {
          deliveryId: delivery.id,
          scheduleId: options.scheduleId,
          recipientsCount: recipients.length,
          isTest: options.isTest,
        },
        "Weekly digest successfully delivered and logged"
      );

      return { success: true, deliveryId: delivery.id };
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to send weekly digest email";

      // Update delivery status to FAILED with error message
      await prisma.digestDelivery.update({
        where: { id: delivery.id },
        data: {
          status: DigestDeliveryStatus.FAILED,
          error: errorMessage,
        },
      });

      logger.error(
        {
          deliveryId: delivery.id,
          scheduleId: options.scheduleId,
          error: errorMessage,
        },
        "Weekly digest delivery failed"
      );

      return { success: false, deliveryId: delivery.id, error: errorMessage };
    }
  }

  /**
   * Scans active schedules and triggers execution for any schedule that is due.
   */
  async checkAndTriggerDueSchedules(now: Date = new Date()): Promise<number> {
    const activeSchedules = await prisma.digestSchedule.findMany({
      where: { isActive: true },
    });

    let triggeredCount = 0;
    for (const schedule of activeSchedules) {
      if (isScheduleDue(schedule, now)) {
        // Atomic claim prevents duplicate sends
        const claimed = await this.claimScheduleExecution(schedule.id, now);
        if (claimed) {
          logger.info(
            { scheduleId: schedule.id, recipientsCount: schedule.recipients.length },
            "Claimed due weekly digest schedule for execution"
          );

          await this.sendDigest({
            scheduleId: schedule.id,
            organizationId: schedule.organizationId,
            recipients: schedule.recipients,
            timezone: schedule.timezone,
            isTest: false,
          });

          triggeredCount++;
        }
      }
    }

    return triggeredCount;
  }
}

export const digestService = new DigestService();
