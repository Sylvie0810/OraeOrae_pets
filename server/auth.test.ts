import { describe, it, expect, vi, afterEach } from "vitest";
import { hashPassword, verifyPassword, signToken, verifyToken } from "./auth";

// isSignupAllowed reads ALLOWED_EMAILS at module-load time, so we re-import a
// fresh module copy after stubbing the env var.
async function loadIsSignupAllowed(allowed: string | undefined) {
  vi.resetModules();
  if (allowed === undefined) vi.stubEnv("ALLOWED_EMAILS", "");
  else vi.stubEnv("ALLOWED_EMAILS", allowed);
  return (await import("./auth")).isSignupAllowed;
}

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

describe("invite-only signup allowlist", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("allows only listed emails, case/space-insensitive", async () => {
    const isSignupAllowed = await loadIsSignupAllowed("urmypride@gmail.com");
    expect(isSignupAllowed("urmypride@gmail.com")).toBe(true);
    expect(isSignupAllowed("  URMYPRIDE@Gmail.com ")).toBe(true); // normalized
    expect(isSignupAllowed("stranger@gmail.com")).toBe(false);
  });

  it("is closed to everyone when the list is empty (fail-safe)", async () => {
    const isSignupAllowed = await loadIsSignupAllowed("");
    expect(isSignupAllowed("urmypride@gmail.com")).toBe(false);
  });

  it("supports multiple comma-separated emails", async () => {
    const isSignupAllowed = await loadIsSignupAllowed("a@x.com, b@y.com");
    expect(isSignupAllowed("a@x.com")).toBe(true);
    expect(isSignupAllowed("b@y.com")).toBe(true);
    expect(isSignupAllowed("c@z.com")).toBe(false);
  });
});
