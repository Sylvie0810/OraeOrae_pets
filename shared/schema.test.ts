import { describe, it, expect } from "vitest";
import { insertDogSchema, insertWeightLogSchema, insertExpenseSchema } from "./schema";

describe("insert schemas", () => {
  it("accepts a valid dog", () => {
    const r = insertDogSchema.safeParse({ userId: 1, name: "레오" });
    expect(r.success).toBe(true);
  });
  it("rejects a dog without name", () => {
    const r = insertDogSchema.safeParse({ userId: 1 });
    expect(r.success).toBe(false);
  });
  it("requires weight fields", () => {
    const r = insertWeightLogSchema.safeParse({ dogId: 1, date: "2026-06-16", weightKg: "3.5" });
    expect(r.success).toBe(true);
  });
  it("requires expense category + amount", () => {
    const r = insertExpenseSchema.safeParse({ userId: 1, date: "2026-06-16", category: "food", amount: "12000" });
    expect(r.success).toBe(true);
  });
});
