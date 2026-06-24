import { Router } from "express";
import { createHash } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { dogs, weightLogs, weightGoals, dailyLogs, feedingEntries, walkEntries, poopEntries, coachCards } from "@shared/schema";
import { requireAuth, type AuthedRequest } from "../auth";
import { dogOwnedBy } from "./_helpers";
import { aggregate } from "../ai/aggregate";
import { getInsightProvider } from "../ai/geminiProvider";
import { todayKST } from "@shared/date";
import type { InsightCard, AggregatedMetrics } from "@shared/types";

// Hash of the coach's inputs. Changes whenever the underlying metrics change
// (a walk edited, weight added, etc.), so cached cards regenerate automatically.
// breed/age are included since they also feed the prompt.
function coachFingerprint(m: AggregatedMetrics, ctx: { breed?: string; ageYears?: number }): string {
  return createHash("sha1").update(JSON.stringify({ m, ctx })).digest("hex");
}

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

  const ageYears = dog.birthDate ? Math.floor((Date.now() - Date.parse(dog.birthDate)) / (365.25 * 86400000)) : undefined;
  const ctx = { breed: dog.breed ?? undefined, ageYears };
  const fingerprint = coachFingerprint(metrics, ctx);

  // Coach cards are cached per (dog, day) and keyed on a fingerprint of the
  // metrics. Reuse the cached cards only when the data is unchanged AND the
  // caller didn't force a refresh; if a walk/weight/etc. was edited the
  // fingerprint mismatches and we regenerate. The metrics themselves are always
  // returned fresh. Cache ops are wrapped so a not-yet-migrated table degrades
  // to "generate every time" instead of failing the whole Home page.
  if (!refresh) {
    try {
      const [cached] = await db.select().from(coachCards)
        .where(and(eq(coachCards.dogId, dogId), eq(coachCards.date, today)));
      if (cached && cached.fingerprint === fingerprint) {
        return res.json({ metrics, cards: cached.cards as InsightCard[] });
      }
    } catch (e) {
      console.error("coach cache read failed (continuing without cache):", e);
    }
  }

  const cards = await getInsightProvider().generate(metrics, ctx);

  // Persist for reuse. onConflictDoUpdate keeps a forced refresh (or a same-day
  // regen after a data edit) from violating the (dogId, date) unique constraint.
  try {
    await db.insert(coachCards)
      .values({ dogId, date: today, fingerprint, cards })
      .onConflictDoUpdate({ target: [coachCards.dogId, coachCards.date], set: { fingerprint, cards, createdAt: new Date() } });
  } catch (e) {
    console.error("coach cache write failed (returning fresh cards anyway):", e);
  }

  res.json({ metrics, cards });
});
