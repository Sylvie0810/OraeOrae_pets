import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { hashPassword, verifyPassword, signToken, requireAuth, type AuthedRequest } from "../auth";
import { z } from "zod";
import type { Response } from "express";

export const authRouter = Router();

const credentials = z.object({ email: z.string().email(), password: z.string().min(6), name: z.string().min(1).optional() });

function setCookie(res: Response, token: string) {
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 30 * 24 * 3600 * 1000 });
}

authRouter.post("/register", async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const { email, password, name } = parsed.data;
  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length) return res.status(409).json({ error: "email taken" });
  const [user] = await db.insert(users).values({ email, passwordHash: await hashPassword(password), name: name ?? email.split("@")[0] }).returning();
  setCookie(res, signToken({ userId: user.id }));
  res.json({ id: user.id, email: user.email, name: user.name });
});

authRouter.post("/login", async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash)))
    return res.status(401).json({ error: "invalid credentials" });
  setCookie(res, signToken({ userId: user.id }));
  res.json({ id: user.id, email: user.email, name: user.name });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.userId!));
  if (!user) return res.status(404).json({ error: "not found" });
  res.json({ id: user.id, email: user.email, name: user.name });
});
