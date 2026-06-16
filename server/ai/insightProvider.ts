import type { AggregatedMetrics, InsightCard } from "@shared/types";

export interface InsightProvider {
  generate(metrics: AggregatedMetrics, context: { breed?: string; ageYears?: number; conditions?: string[] }): Promise<InsightCard[]>;
}
