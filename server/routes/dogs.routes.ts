import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { dogs, insertDogSchema } from "@shared/schema";
import { requireAuth, type AuthedRequest } from "../auth";

export const dogsRouter = Router();
dogsRouter.use(requireAuth);

dogsRouter.get("/", async (req: AuthedRequest, res) => {
  const rows = await db.select().from(dogs).where(eq(dogs.userId, req.userId!));
  res.json(rows);
});

dogsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = insertDogSchema.safeParse({ ...req.body, userId: req.userId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [dog] = await db.insert(dogs).values(parsed.data).returning();
  res.json(dog);
});

dogsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const owned = await db.select().from(dogs).where(and(eq(dogs.id, id), eq(dogs.userId, req.userId!)));
  if (!owned.length) return res.status(404).json({ error: "not found" });
  // Whitelist updatable fields — never let the caller set id/userId (mass assignment).
  const parsed = insertDogSchema.partial().omit({ userId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [dog] = await db
    .update(dogs)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(dogs.id, id), eq(dogs.userId, req.userId!)))
    .returning();
  res.json(dog);
});

dogsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(dogs).where(and(eq(dogs.id, id), eq(dogs.userId, req.userId!)));
  res.json({ ok: true });
});
