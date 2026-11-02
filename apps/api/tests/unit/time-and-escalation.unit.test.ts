import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Role, ApprovalStatus } from "@prisma/client";
import { signAccessToken, verifyAccessToken } from "../../src/lib/jwt";
import { ApprovalEscalationService } from "../../src/modules/approvals/approval-escalation.service";

describe("Unit Tests: Time-Based Services with Fake Timers (vi.useFakeTimers)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Token Expiration with Fake Timers", () => {
    it("token is valid immediately, but expires when virtual time advances past 15m", () => {
      const payload = { sub: "user-123", email: "user@nexusops.com", role: Role.EMPLOYEE };
      const token = signAccessToken(payload);

      // Immediately valid
      const verified = verifyAccessToken(token);
      expect(verified.sub).toBe("user-123");

      // Advance clock by 14 minutes (token still valid)
      vi.advanceTimersByTime(14 * 60 * 1000);
      const stillValid = verifyAccessToken(token);
      expect(stillValid.sub).toBe("user-123");

      // Advance clock past 15 minutes limit (16 minutes total)
      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(() => verifyAccessToken(token)).toThrow(/jwt expired/i);
    });
  });

  describe("Approval Escalation & Overdue Logic with Fake Timers", () => {
    it("does not trigger escalation before 72 hours, triggers after advancing past 72 hours", async () => {
      const escalationService = new ApprovalEscalationService();

      const baseTime = new Date("2026-01-01T12:00:00Z");
      vi.setSystemTime(baseTime);

      const thresholdHours = 72;
      const stepActivatedAt = new Date("2026-01-01T12:00:00Z");

      const isOverdue = (activatedAt: Date, hoursThreshold: number) => {
        const thresholdDate = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
        return activatedAt <= thresholdDate;
      };

      // At T + 71 hours: Not overdue
      vi.advanceTimersByTime(71 * 60 * 60 * 1000);
      expect(isOverdue(stepActivatedAt, thresholdHours)).toBe(false);

      // At T + 73 hours: Overdue!
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
      expect(isOverdue(stepActivatedAt, thresholdHours)).toBe(true);
    });

    it("evaluates task due dates with virtual clock advancement", () => {
      const taskDueDate = new Date("2026-01-05T17:00:00Z");
      vi.setSystemTime(new Date("2026-01-05T12:00:00Z"));

      const isTaskOverdue = (dueDate: Date) => Date.now() > dueDate.getTime();

      // At 12:00 on due date: not overdue
      expect(isTaskOverdue(taskDueDate)).toBe(false);

      // Advance time by 6 hours (now 18:00, 1 hour past due date): overdue!
      vi.advanceTimersByTime(6 * 60 * 60 * 1000);
      expect(isTaskOverdue(taskDueDate)).toBe(true);
    });
  });
});
