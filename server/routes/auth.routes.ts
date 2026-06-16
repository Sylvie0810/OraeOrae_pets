import { Router } from "express";
import { eq } from "drizzle-orm";
import { OAuth2Client } from "google-auth-library";
import { db } from "../db";
import { users } from "@shared/schema";
import { hashPassword, verifyPassword, signToken, requireAuth, type AuthedRequest } from "../auth";
import { z } from "zod";
import type { Response } from "express";

export const authRouter = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const credentials = z.object({ email: z.string().email(), password: z.string().min(6), name: z.string().min(1).optional() });

// bcrypt hash of a fixed dummy password — used to keep /login wall-clock time
// constant when the email doesn't exist, so timing can't reveal account existence.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8DvB3vWzPzZ7p6q1bF7y0n6zV3qF5e";

const COOKIE_OPTS = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 30 * 24 * 3600 * 1000,
};

function setCookie(res: Response, token: string) {
  res.cookie("token", token, COOKIE_OPTS);
}

authRouter.post("/register", async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const { email, password, name } = parsed.data;
  const existing = await db.select().from(users).where(eq(users.email, email));
  // Uniform message avoids confirming whether an email is already registered.
  if (existing.length) return res.status(409).json({ error: "unable to create account; check your email" });
  const [user] = await db.insert(users).values({ email, passwordHash: await hashPassword(password), name: name ?? email.split("@")[0] }).returning();
  setCookie(res, signToken({ userId: user.id }));
  res.json({ id: user.id, email: user.email, name: user.name });
});

authRouter.post("/login", async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));
  // Always run a bcrypt comparison (against a dummy hash when the user is missing)
  // so response time doesn't reveal whether the account exists.
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: "invalid credentials" });
  setCookie(res, signToken({ userId: user.id }));
  res.json({ id: user.id, email: user.email, name: user.name });
});

// POST /api/auth/google  { credential: <Google ID token> }
authRouter.post("/google", async (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: "google login not configured" });
  const credential = z.string().min(1).safeParse(req.body?.credential);
  if (!credential.success) return res.status(400).json({ error: "missing credential" });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential.data, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: "invalid google token" });
  }
  if (!payload?.email || !payload.sub) return res.status(401).json({ error: "invalid google token" });

  const email = payload.email;
  const googleId = payload.sub;
  const name = payload.name ?? email.split("@")[0];
  const photoUrl = payload.picture ?? null;

  // Upsert: match by googleId first, then by email (link existing email account).
  let [user] = await db.select().from(users).where(eq(users.googleId, googleId));
  if (!user) {
    const [byEmail] = await db.select().from(users).where(eq(users.email, email));
    if (byEmail) {
      [user] = await db.update(users).set({ googleId, photoUrl: byEmail.photoUrl ?? photoUrl }).where(eq(users.id, byEmail.id)).returning();
    } else {
      [user] = await db.insert(users).values({ email, name, googleId, photoUrl, passwordHash: null }).returning();
    }
  }
  setCookie(res, signToken({ userId: user.id }));
  res.json({ id: user.id, email: user.email, name: user.name });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token", { httpOnly: true, sameSite: "lax", secure: COOKIE_OPTS.secure, path: "/" });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.userId!));
  if (!user) return res.status(404).json({ error: "not found" });
  res.json({ id: user.id, email: user.email, name: user.name, photoUrl: user.photoUrl });
});
