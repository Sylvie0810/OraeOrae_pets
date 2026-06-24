import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { dogs, weightLogs, weightGoals, dailyLogs, feedingEntries, walkEntries, poopEntries, coachCards } from "@shared/schema";
import { requireAuth, type AuthedRequest } from "../auth";
import { dogOwnedBy } from "./_helpers";
import { aggregate } from "../ai/aggregate";
import { getInsightProvider } from "../ai/geminiProvider";
import { todayKST } from "@shared/date";
import type { InsightCard } from "@shared/types";

export const insightsRouter = Router();
insightsRouter.use(requireAuth);

insightsRouter.get("/:dogId", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const today = (req.query.date as string) ?? todayKST();
  const refresh = req.query.refresh === "1"; // force a regen (escape hatch)

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

  // Coach cards are cached per (dog, day): generate once, reuse all day.
  // The metrics above are cheap to recompute and are always returned fresh
  // (so today's weight etc. stays live); only the LLM call is cached.
  // Cache ops are wrapped so a not-yet-migrated table degrades to "generate
  // every time" instead of failing the whole Home page.
  if (!refresh) {
    try {
      const [cached] = await db.select().from(coachCards)
        .where(and(eq(coachCards.dogId, dogId), eq(coachCards.date, today)));
      if (cached) return res.json({ metrics, cards: cached.cards as InsightCard[] });
    } catch (e) {
      console.error("coach cache read failed (continuing without cache):", e);
    }
  }

  const ageYears = dog.birthDate ? Math.floor((Date.now() - Date.parse(dog.birthDate)) / (365.25 * 86400000)) : undefined;
  const cards = await getInsightProvider().generate(metrics, { breed: dog.breed ?? undefined, ageYears });

  // Persist for the rest of the day. onConflictDoUpdate keeps a forced refresh
  // (or a same-day regen) from violating the (dogId, date) unique constraint.
  try {
    await db.insert(coachCards)
      .values({ dogId, date: today, cards })
      .onConflictDoUpdate({ target: [coachCards.dogId, coachCards.date], set: { cards, createdAt: new Date() } });
  } catch (e) {
    console.error("coach cache write failed (returning fresh cards anyway):", e);
  }

  res.json({ metrics, cards });
});
