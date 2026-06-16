import { Router } from "express";
import { and, eq, inArray, isNotNull, desc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  dogs, dailyLogs, feedingEntries, walkEntries, poopEntries,
  insertFeedingSchema, insertWalkSchema, insertPoopSchema,
} from "@shared/schema";
import { requireAuth, type AuthedRequest } from "../auth";
import { dogOwnedBy } from "./_helpers";

export const dailyRouter = Router();
dailyRouter.use(requireAuth);

// GET /api/daily/suggestions/feeding -> distinct past feeding names (this user's dogs),
// most-recent first, for autocomplete. MUST be declared before "/:dogId/:date".
dailyRouter.get("/suggestions/feeding", async (req: AuthedRequest, res) => {
  const myDogs = await db.select({ id: dogs.id }).from(dogs).where(eq(dogs.userId, req.userId!));
  const dogIds = myDogs.map((d) => d.id);
  if (!dogIds.length) return res.json([]);
  const myLogs = await db.select({ id: dailyLogs.id }).from(dailyLogs).where(inArray(dailyLogs.dogId, dogIds));
  const logIds = myLogs.map((l) => l.id);
  if (!logIds.length) return res.json([]);
  const rows = await db
    .select({ name: feedingEntries.name })
    .from(feedingEntries)
    .where(and(inArray(feedingEntries.dailyLogId, logIds), isNotNull(feedingEntries.name)))
    .groupBy(feedingEntries.name)
    .orderBy(desc(sql`max(${feedingEntries.createdAt})`))
    .limit(20);
  res.json(rows.map((r) => r.name).filter(Boolean));
});

async function getOrCreateDailyLog(dogId: number, date: string) {
  const [existing] = await db.select().from(dailyLogs).where(and(eq(dailyLogs.dogId, dogId), eq(dailyLogs.date, date)));
  if (existing) return existing;
  const [created] = await db.insert(dailyLogs).values({ dogId, date }).returning();
  return created;
}

async function loadDrawer(logId: number) {
  const [log] = await db.select().from(dailyLogs).where(eq(dailyLogs.id, logId));
  const feedings = await db.select().from(feedingEntries).where(eq(feedingEntries.dailyLogId, logId));
  const walks = await db.select().from(walkEntries).where(eq(walkEntries.dailyLogId, logId));
  const poops = await db.select().from(poopEntries).where(eq(poopEntries.dailyLogId, logId));
  return { log, feedings, walks, poops };
}

// GET /api/daily/:dogId/:date -> full drawer (creates if absent)
dailyRouter.get("/:dogId/:date", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const log = await getOrCreateDailyLog(dogId, req.params.date);
  res.json(await loadDrawer(log.id));
});

// add entries
dailyRouter.post("/:dogId/:date/feeding", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const log = await getOrCreateDailyLog(dogId, req.params.date);
  const parsed = insertFeedingSchema.safeParse({ ...req.body, dailyLogId: log.id });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.insert(feedingEntries).values(parsed.data).returning();
  res.json(row);
});

dailyRouter.post("/:dogId/:date/walk", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const log = await getOrCreateDailyLog(dogId, req.params.date);
  const parsed = insertWalkSchema.safeParse({ ...req.body, dailyLogId: log.id });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.insert(walkEntries).values(parsed.data).returning();
  res.json(row);
});

dailyRouter.post("/:dogId/:date/poop", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const log = await getOrCreateDailyLog(dogId, req.params.date);
  const parsed = insertPoopSchema.safeParse({ ...req.body, dailyLogId: log.id });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.insert(poopEntries).values(parsed.data).returning();
  res.json(row);
});

// delete entries (verify ownership via daily log -> dog)
async function dailyLogDogId(dailyLogId: number): Promise<number | null> {
  const [log] = await db.select().from(dailyLogs).where(eq(dailyLogs.id, dailyLogId));
  return log?.dogId ?? null;
}

dailyRouter.delete("/feeding/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [entry] = await db.select().from(feedingEntries).where(eq(feedingEntries.id, id));
  const dogId = entry ? await dailyLogDogId(entry.dailyLogId) : null;
  if (dogId === null || !(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  await db.delete(feedingEntries).where(eq(feedingEntries.id, id));
  res.json({ ok: true });
});

dailyRouter.delete("/walk/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [entry] = await db.select().from(walkEntries).where(eq(walkEntries.id, id));
  const dogId = entry ? await dailyLogDogId(entry.dailyLogId) : null;
  if (dogId === null || !(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  await db.delete(walkEntries).where(eq(walkEntries.id, id));
  res.json({ ok: true });
});

dailyRouter.delete("/poop/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [entry] = await db.select().from(poopEntries).where(eq(poopEntries.id, id));
  const dogId = entry ? await dailyLogDogId(entry.dailyLogId) : null;
  if (dogId === null || !(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  await db.delete(poopEntries).where(eq(poopEntries.id, id));
  res.json({ ok: true });
});

// PATCH entries (whitelist updatable fields via partial insert schema, omit dailyLogId)
dailyRouter.patch("/feeding/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [entry] = await db.select().from(feedingEntries).where(eq(feedingEntries.id, id));
  const dogId = entry ? await dailyLogDogId(entry.dailyLogId) : null;
  if (dogId === null || !(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const parsed = insertFeedingSchema.partial().omit({ dailyLogId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.update(feedingEntries).set(parsed.data).where(eq(feedingEntries.id, id)).returning();
  res.json(row);
});

dailyRouter.patch("/walk/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [entry] = await db.select().from(walkEntries).where(eq(walkEntries.id, id));
  const dogId = entry ? await dailyLogDogId(entry.dailyLogId) : null;
  if (dogId === null || !(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const parsed = insertWalkSchema.partial().omit({ dailyLogId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.update(walkEntries).set(parsed.data).where(eq(walkEntries.id, id)).returning();
  res.json(row);
});

dailyRouter.patch("/poop/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [entry] = await db.select().from(poopEntries).where(eq(poopEntries.id, id));
  const dogId = entry ? await dailyLogDogId(entry.dailyLogId) : null;
  if (dogId === null || !(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const parsed = insertPoopSchema.partial().omit({ dailyLogId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.update(poopEntries).set(parsed.data).where(eq(poopEntries.id, id)).returning();
  res.json(row);
});
