import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db } from "../db";
import { weightLogs, weightGoals, insertWeightLogSchema, insertWeightGoalSchema } from "@shared/schema";
import { requireAuth, type AuthedRequest } from "../auth";
import { dogOwnedBy } from "./_helpers";

export const weightsRouter = Router();
weightsRouter.use(requireAuth);

// GET /api/weights/:dogId  -> logs (asc by date)
weightsRouter.get("/:dogId", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const logs = await db.select().from(weightLogs).where(eq(weightLogs.dogId, dogId)).orderBy(asc(weightLogs.date));
  res.json(logs);
});

weightsRouter.post("/:dogId", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const parsed = insertWeightLogSchema.safeParse({ ...req.body, dogId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [log] = await db.insert(weightLogs).values(parsed.data).returning();
  res.json(log);
});

// goals
weightsRouter.get("/:dogId/goals", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const goals = await db.select().from(weightGoals).where(eq(weightGoals.dogId, dogId)).orderBy(asc(weightGoals.effectiveFrom));
  res.json(goals);
});

weightsRouter.post("/:dogId/goals", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const parsed = insertWeightGoalSchema.safeParse({ ...req.body, dogId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [goal] = await db.insert(weightGoals).values(parsed.data).returning();
  res.json(goal);
});

weightsRouter.patch("/log/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(weightLogs).where(eq(weightLogs.id, id));
  if (!row || !(await dogOwnedBy(req.userId!, row.dogId))) return res.status(404).json({ error: "not found" });
  const parsed = insertWeightLogSchema.partial().omit({ dogId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [updated] = await db.update(weightLogs).set(parsed.data).where(eq(weightLogs.id, id)).returning();
  res.json(updated);
});

weightsRouter.delete("/log/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(weightLogs).where(eq(weightLogs.id, id));
  if (!row || !(await dogOwnedBy(req.userId!, row.dogId))) return res.status(404).json({ error: "not found" });
  await db.delete(weightLogs).where(eq(weightLogs.id, id));
  res.json({ ok: true });
});
