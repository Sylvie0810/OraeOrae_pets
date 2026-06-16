import type { AggregatedMetrics } from "@shared/types";

interface Row { [k: string]: any }
interface Input {
  dogName: string;
  weightLogs: Row[]; // {date, weightKg}
  goals: Row[];      // {effectiveFrom, targetKg}
  feedings: Row[];   // {amountG, dailyDate}
  walks: Row[];      // {durationMin, dailyDate}
  poops: Row[];      // {status, dailyDate}
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

export function aggregate(input: Input, today: string): AggregatedMetrics {
  const sorted = [...input.weightLogs].sort((a, b) => a.date.localeCompare(b.date));
  const todayWeightKg = sorted.length ? Number(sorted[sorted.length - 1].weightKg) : null;

  // active goal = latest goal with effectiveFrom <= today
  const activeGoal = [...input.goals]
    .filter((g) => g.effectiveFrom <= today)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
    .pop();
  const targetKg = activeGoal ? Number(activeGoal.targetKg) : null;
  const gapKg = todayWeightKg !== null && targetKg !== null ? Number((todayWeightKg - targetKg).toFixed(3)) : null;

  // trend: compare latest vs earliest within 7d window
  const within7 = sorted.filter((w) => daysBetween(w.date, today) <= 7 && daysBetween(w.date, today) >= 0);
  let trend7d: AggregatedMetrics["trend7d"] = "unknown";
  if (within7.length >= 2) {
    const first = Number(within7[0].weightKg);
    const last = Number(within7[within7.length - 1].weightKg);
    const delta = last - first;
    trend7d = Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "up" : "down";
  } else if (sorted.length >= 2) {
    const delta = Number(sorted[sorted.length - 1].weightKg) - Number(sorted[sorted.length - 2].weightKg);
    trend7d = Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "up" : "down";
  }

  const inWindow = (d: string) => daysBetween(d, today) <= 7 && daysBetween(d, today) >= 0;
  const foods = input.feedings.filter((f) => inWindow(f.dailyDate) && f.amountG != null).map((f) => Number(f.amountG));
  const avgFoodG7d = foods.length ? Number((foods.reduce((a, b) => a + b, 0) / foods.length).toFixed(1)) : null;

  const walks = input.walks.filter((w) => inWindow(w.dailyDate));
  const walkCount7d = walks.length;
  const walkMinutes7d = walks.reduce((a, w) => a + (w.durationMin ?? 0), 0);

  const abnormalPoop7d = input.poops.filter((p) => inWindow(p.dailyDate) && p.status && p.status !== "normal").length;

  const dates = new Set([
    ...input.weightLogs.map((w) => w.date),
    ...input.feedings.map((f) => f.dailyDate),
    ...input.walks.map((w) => w.dailyDate),
    ...input.poops.map((p) => p.dailyDate),
  ]);

  return {
    dogName: input.dogName,
    todayWeightKg,
    targetKg,
    gapKg,
    trend7d,
    avgFoodG7d,
    walkCount7d,
    walkMinutes7d,
    abnormalPoop7d,
    daysOfData: dates.size,
  };
}
