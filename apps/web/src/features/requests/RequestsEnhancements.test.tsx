import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryBadge, getCategoryConfig } from "../../components/ui/CategoryBadge";
import { PriorityBadge } from "../../components/ui/PriorityBadge";
import { ApprovalStepper } from "../approvals/ApprovalStepper";
import { formatKolkataDate, formatKolkataDateTime } from "../../lib/utils";
import type { RequestApprovalStep } from "../../types/requests";

describe("Frontend Enhancements: /requests", () => {
  describe("Category Icons & Badge", () => {
    it("renders IT category with correct label and icon metadata", () => {
      const config = getCategoryConfig("IT");
      expect(config.label).toBe("IT");
      expect(config.icon).toBeDefined();

      render(<CategoryBadge category="IT" />);
      expect(screen.getByText("IT")).toBeInTheDocument();
      expect(screen.getByLabelText(/Category: IT/i)).toBeInTheDocument();
    });

    it("renders HR category with correct label and icon metadata", () => {
      const config = getCategoryConfig("HR");
      expect(config.label).toBe("HR");
      expect(config.icon).toBeDefined();

      render(<CategoryBadge category="HR" />);
      expect(screen.getByText("HR")).toBeInTheDocument();
      expect(screen.getByLabelText(/Category: HR/i)).toBeInTheDocument();
    });

    it("renders Finance category with correct label and icon metadata", () => {
      const config = getCategoryConfig("FINANCE");
      expect(config.label).toBe("Finance");
      expect(config.icon).toBeDefined();

      render(<CategoryBadge category="FINANCE" />);
      expect(screen.getByText("Finance")).toBeInTheDocument();
      expect(screen.getByLabelText(/Category: Finance/i)).toBeInTheDocument();
    });

    it("renders Facilities category with correct label and icon metadata", () => {
      const config = getCategoryConfig("FACILITIES");
      expect(config.label).toBe("Facilities");
      expect(config.icon).toBeDefined();

      render(<CategoryBadge category="FACILITIES" />);
      expect(screen.getByText("Facilities")).toBeInTheDocument();
      expect(screen.getByLabelText(/Category: Facilities/i)).toBeInTheDocument();
    });

    it("renders Other category with correct fallback label and icon metadata", () => {
      const config = getCategoryConfig("OTHER");
      expect(config.label).toBe("Other");
      expect(config.icon).toBeDefined();

      render(<CategoryBadge category="OTHER" />);
      expect(screen.getByText("Other")).toBeInTheDocument();
      expect(screen.getByLabelText(/Category: Other/i)).toBeInTheDocument();
    });
  });

  describe("Pulsing URGENT Badge with reduced motion support", () => {
    it("renders pulsing animation classes on URGENT priority", () => {
      const { container } = render(<PriorityBadge priority="URGENT" />);

      expect(screen.getByText("Urgent")).toBeInTheDocument();
      const badge = screen.getByLabelText(/Priority: Urgent \(Urgent\)/i);
      expect(badge).toBeInTheDocument();

      // Check motion-safe pulse class and motion-reduce:animate-none
      expect(badge.className).toContain("motion-safe:animate-pulse");
      expect(badge.className).toContain("motion-reduce:animate-none");

      // Check pinging dot element with motion-reduce:hidden
      const pingDot = container.querySelector(".motion-safe\\:animate-ping");
      expect(pingDot).toBeInTheDocument();
      expect(pingDot?.className).toContain("motion-reduce:hidden");
    });

    it("does not render pulsing animation on standard priorities (LOW, MEDIUM, HIGH)", () => {
      const { container } = render(<PriorityBadge priority="HIGH" />);

      expect(screen.getByText("High")).toBeInTheDocument();
      const badge = screen.getByLabelText(/Priority: High/i);
      expect(badge.className).not.toContain("motion-safe:animate-pulse");

      const pingDot = container.querySelector(".motion-safe\\:animate-ping");
      expect(pingDot).toBeNull();
    });
  });

  describe("ApprovalStepper with REAL approval steps", () => {
    const mockSteps: RequestApprovalStep[] = [
      {
        id: "step-1",
        stepOrder: 1,
        approverRole: "MANAGER",
        approverId: "user-mgr-1",
        status: "APPROVED",
        comment: "Budget looks appropriate. Approved.",
        decidedAt: "2026-11-03T09:30:00.000Z",
        approver: {
          id: "user-mgr-1",
          name: "Ravi Kumar",
          email: "ravi@example.com",
          role: "MANAGER",
        },
      },
      {
        id: "step-2",
        stepOrder: 2,
        approverRole: "ADMIN",
        approverId: null,
        status: "PENDING",
        comment: null,
        decidedAt: null,
        approver: null,
      },
      {
        id: "step-3",
        stepOrder: 3,
        approverRole: "ADMIN",
        approverId: null,
        status: "SKIPPED",
        comment: null,
        decidedAt: null,
        approver: null,
      },
    ];

    it("renders real steps with approver name, decision time and decision comments", () => {
      render(<ApprovalStepper steps={mockSteps} currentStatus="IN_REVIEW" />);

      // Step 1: Approved by Ravi Kumar
      expect(screen.getByText(/Step 1/i)).toBeInTheDocument();
      expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();
      expect(screen.getByText("1 of 3 Approved")).toBeInTheDocument();
      expect(screen.getAllByText(/Approved/i).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/"Budget looks appropriate\. Approved\."/i)).toBeInTheDocument();

      // Step 2: Highlighted as pending active step
      expect(screen.getByText(/Step 2/i)).toBeInTheDocument();
      expect(screen.getByText(/Pending Action/i)).toBeInTheDocument();
      expect(screen.getByText(/Currently awaiting action from ADMIN/i)).toBeInTheDocument();

      // Step 3: Skipped state
      expect(screen.getByText(/Step 3/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Skipped/i).length).toBeGreaterThanOrEqual(1);
    });

    it("highlights current pending step with aria-current='step'", () => {
      render(<ApprovalStepper steps={mockSteps} currentStatus="IN_REVIEW" />);

      const activeStepItem = screen.getByRole("listitem", { current: "step" });
      expect(activeStepItem).toBeInTheDocument();
      expect(activeStepItem).toHaveTextContent(/Step 2/i);
    });

    it("renders rejected state clearly when a step is rejected", () => {
      const rejectedSteps: RequestApprovalStep[] = [
        {
          id: "step-1",
          stepOrder: 1,
          approverRole: "MANAGER",
          approverId: "user-mgr-1",
          status: "REJECTED",
          comment: "Missing vendor quotes.",
          decidedAt: "2026-11-03T10:00:00.000Z",
          approver: {
            id: "user-mgr-1",
            name: "Ravi Kumar",
            email: "ravi@example.com",
            role: "MANAGER",
          },
        },
      ];

      render(<ApprovalStepper steps={rejectedSteps} currentStatus="REJECTED" />);

      expect(screen.getByText(/Workflow Terminated \(Rejected\)/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Rejected/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/"Missing vendor quotes\."/i)).toBeInTheDocument();
    });

    it("renders informative empty state when no steps are configured", () => {
      render(<ApprovalStepper steps={[]} currentStatus="DRAFT" />);
      expect(
        screen.getByText(/No formal approval steps registered for this request/i)
      ).toBeInTheDocument();
    });
  });

  describe("Asia/Kolkata Date Formatting", () => {
    it("formats ISO timestamps in Asia/Kolkata timezone", () => {
      // 2026-11-03T09:30:00.000Z in UTC is 2026-11-03 15:00 in Asia/Kolkata (UTC+5:30)
      const utcIso = "2026-11-03T09:30:00.000Z";
      const formattedDate = formatKolkataDate(utcIso);
      expect(formattedDate).toContain("3");
      expect(formattedDate).toContain("Nov");
      expect(formattedDate).toContain("2026");

      const formattedDateTime = formatKolkataDateTime(utcIso);
      expect(formattedDateTime).toContain("3");
      expect(formattedDateTime).toContain("Nov");
      expect(formattedDateTime).toContain("2026");
      // 15:00 = 03:00 pm in Kolkata
      expect(formattedDateTime).toMatch(/0?3:00/);
    });

    it("handles null and undefined dates gracefully", () => {
      expect(formatKolkataDate(null)).toBe("—");
      expect(formatKolkataDate(undefined)).toBe("—");
      expect(formatKolkataDateTime(null)).toBe("—");
    });
  });
});
