import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const SECRET = process.env.JWT_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-secret");
if (!SECRET) {
  throw new Error("JWT_SECRET is required in production");
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}
export function signToken(payload: { userId: number }): string {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}
export function verifyToken(token: string): { userId: number } | null {
  try {
    return jwt.verify(token, SECRET) as { userId: number };
  } catch {
    return null;
  }
}

// Invite-only signup: only emails on this allowlist may create a NEW account.
// Existing accounts always log in regardless of this list (see auth.routes).
// Configured via ALLOWED_EMAILS env var (comma-separated). Empty/unset = closed
// to everyone (fail-safe: nobody gets in by accident if the var is forgotten).
const ALLOWED_EMAILS = new Set(
  (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);
export function isSignupAllowed(email: string): boolean {
  return ALLOWED_EMAILS.has(email.trim().toLowerCase());
}

export interface AuthedRequest extends Request {
  userId?: number;
}
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: "unauthorized" });
  req.userId = payload.userId;
  next();
}
