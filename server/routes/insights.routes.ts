import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { dogs, weightLogs, weightGoals, dailyLogs, feedingEntries, walkEntries, poopEntries } from "@shared/schema";
import { requireAuth, type AuthedRequest } from "../auth";
import { dogOwnedBy } from "./_helpers";
import { aggregate } from "../ai/aggregate";
import { getInsightProvider } from "../ai/geminiProvider";

export const insightsRouter = Router();
insightsRouter.use(requireAuth);

insightsRouter.get("/:dogId", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const today = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);

  const [dog] = await db.select().from(dogs).where(eq(dogs.id, dogId));
  const wLogs = await db.select().from(weightLogs).where(eq(weightLogs.dogId, dogId));
  const goals = await db.select().from(weightGoals).where(eq(weightGoals.dogId, dogId));
  const logs = await db.select().from(dailyLogs).where(eq(dailyLogs.dogId, dogId));
  const logIds = logs.map((l) => l.id);
  const dateById = new Map(logs.map((l) => [l.id, l.date]));

  const feedings = logIds.length ? await db.select().from(feedingEntries) : [];
  const walks = logIds.length ? await db.select().from(walkEntries) : [];
  const poops = logIds.length ? await db.select().from(poopEntries) : [];
  const withDate = (rows: { dailyLogId: number }[]) =>
    rows.filter((r) => dateById.has(r.dailyLogId)).map((r) => ({ ...r, dailyDate: dateById.get(r.dailyLogId) }));

  const metrics = aggregate({
    dogName: dog.name,
    weightLogs: wLogs,
    goals,
    feedings: withDate(feedings),
    walks: withDate(walks),
    poops: withDate(poops),
  }, today);

  const ageYears = dog.birthDate ? Math.floor((Date.now() - Date.parse(dog.birthDate)) / (365.25 * 86400000)) : undefined;
  const cards = await getInsightProvider().generate(metrics, { breed: dog.breed ?? undefined, ageYears });
  res.json({ metrics, cards });
});
