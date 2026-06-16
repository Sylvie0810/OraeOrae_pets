import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, signToken, verifyToken } from "./auth";

describe("auth helpers", () => {
  it("hashes and verifies a password", async () => {
    const h = await hashPassword("secret123");
    expect(await verifyPassword("secret123", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("signs and verifies a token", () => {
    const t = signToken({ userId: 7 });
    expect(verifyToken(t)?.userId).toBe(7);
    expect(verifyToken("garbage")).toBeNull();
  });
});
