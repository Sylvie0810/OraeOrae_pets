export interface AggregatedMetrics {
  dogName: string;
  todayWeightKg: number | null;
  targetKg: number | null;
  gapKg: number | null;          // today - target
  trend7d: "up" | "down" | "flat" | "unknown";
  avgFoodG7d: number | null;
  walkCount7d: number;
  walkMinutes7d: number;
  abnormalPoop7d: number;        // soft+constipation+diarrhea count
  daysOfData: number;
}

export interface InsightCard {
  severity: "red" | "yellow" | "green";
  title: string;
  evidence: string;
  recommendedAction: string;
  disclaimer?: string;
}
