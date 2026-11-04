import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SlaBadge, calculateSlaStatus } from "./SlaBadge";

describe("SLA Calculation & Badge Logic", () => {
  const baseTime = 1793700000000; // Fixed reference point

  it("calculates green variant for steps pending under 24 hours", () => {
    // 5 hours ago
    const activatedAt = new Date(baseTime - 5 * 3600 * 1000).toISOString();
    const result = calculateSlaStatus(activatedAt, activatedAt, null, 72, baseTime);

    expect(result.variant).toBe("green");
    expect(result.elapsedDisplay).toBe("5h pending");
    expect(result.escalationLabel).toBe("Escalates in 67h");
  });

  it("calculates amber variant for steps pending 24 to 48 hours", () => {
    // 30 hours ago
    const activatedAt = new Date(baseTime - 30 * 3600 * 1000).toISOString();
    const result = calculateSlaStatus(activatedAt, activatedAt, null, 72, baseTime);

    expect(result.variant).toBe("amber");
    expect(result.elapsedDisplay).toBe("30h pending");
    expect(result.escalationLabel).toBe("Escalates in 42h");
  });

  it("calculates red variant for steps pending over 48 hours", () => {
    // 55 hours ago
    const activatedAt = new Date(baseTime - 55 * 3600 * 1000).toISOString();
    const result = calculateSlaStatus(activatedAt, activatedAt, null, 72, baseTime);

    expect(result.variant).toBe("red");
    expect(result.elapsedDisplay).toBe("55h pending");
    expect(result.escalationLabel).toBe("Escalates in 17h");
  });

  it("shows Escalated when escalatedAt timestamp exists", () => {
    const activatedAt = new Date(baseTime - 75 * 3600 * 1000).toISOString();
    const escalatedAt = new Date(baseTime - 1 * 3600 * 1000).toISOString();
    const result = calculateSlaStatus(activatedAt, activatedAt, escalatedAt, 72, baseTime);

    expect(result.variant).toBe("red");
    expect(result.escalationLabel).toBe("Escalated");
    expect(result.isEscalated).toBe(true);
  });

  it("does not show escalation info when no threshold exists", () => {
    const activatedAt = new Date(baseTime - 10 * 3600 * 1000).toISOString();
    const result = calculateSlaStatus(activatedAt, activatedAt, null, null, baseTime);

    expect(result.variant).toBe("green");
    expect(result.escalationLabel).toBeNull();
  });

  it("falls back to createdAt when activatedAt is null", () => {
    const createdAt = new Date(baseTime - 3 * 3600 * 1000).toISOString();
    const result = calculateSlaStatus(null, createdAt, null, 72, baseTime);

    expect(result.variant).toBe("green");
    expect(result.elapsedDisplay).toBe("3h pending");
  });

  it("renders SlaBadge component correctly in DOM", () => {
    const activatedAt = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    render(
      <SlaBadge
        activatedAt={activatedAt}
        createdAt={activatedAt}
        escalationThresholdHours={72}
      />
    );

    expect(screen.getByText(/2h pending/i)).toBeInTheDocument();
    expect(screen.getByText(/Escalates in 70h/i)).toBeInTheDocument();
  });
});
