import { describe, it, expect } from "vitest";
import { aggregate } from "./aggregate";

const base = {
  dogName: "레오",
  weightLogs: [
    { date: "2026-06-10", weightKg: "3.4" },
    { date: "2026-06-16", weightKg: "3.6" },
  ],
  goals: [{ effectiveFrom: "2026-06-01", targetKg: "3.3" }],
  feedings: [{ amountG: "60", dailyDate: "2026-06-16" }, { amountG: "70", dailyDate: "2026-06-15" }],
  walks: [{ durationMin: 20, dailyDate: "2026-06-16" }],
  poops: [{ status: "soft", dailyDate: "2026-06-16" }, { status: "normal", dailyDate: "2026-06-15" }],
};

describe("aggregate", () => {
  it("computes gap and trend", () => {
    const m = aggregate(base as any, "2026-06-16");
    expect(m.todayWeightKg).toBe(3.6);
    expect(m.targetKg).toBe(3.3);
    expect(m.gapKg).toBeCloseTo(0.3, 5);
    expect(m.trend7d).toBe("up");
  });
  it("counts abnormal poop and walks", () => {
    const m = aggregate(base as any, "2026-06-16");
    expect(m.abnormalPoop7d).toBe(1);
    expect(m.walkCount7d).toBe(1);
    expect(m.walkMinutes7d).toBe(20);
  });
  it("reports unknown trend with insufficient data", () => {
    const m = aggregate({ ...base, weightLogs: [] } as any, "2026-06-16");
    expect(m.todayWeightKg).toBeNull();
    expect(m.trend7d).toBe("unknown");
  });
});
