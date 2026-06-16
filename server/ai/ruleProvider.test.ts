import { describe, it, expect } from "vitest";
import { RuleProvider } from "./ruleProvider";

const provider = new RuleProvider();

describe("RuleProvider", () => {
  it("stays silent with insufficient data", async () => {
    const cards = await provider.generate({ daysOfData: 2 } as any, {});
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toContain("데이터");
  });
  it("flags overweight + high food as red", async () => {
    const cards = await provider.generate(
      { dogName: "레오", daysOfData: 7, gapKg: 0.3, trend7d: "up", avgFoodG7d: 70, walkCount7d: 1, abnormalPoop7d: 0 } as any,
      {}
    );
    expect(cards.some((c) => c.severity === "red")).toBe(true);
  });
  it("congratulates on-target as green", async () => {
    const cards = await provider.generate(
      { dogName: "레오", daysOfData: 14, gapKg: 0.0, trend7d: "flat", avgFoodG7d: 60, walkCount7d: 7, abnormalPoop7d: 0 } as any,
      {}
    );
    expect(cards.some((c) => c.severity === "green")).toBe(true);
  });
});
