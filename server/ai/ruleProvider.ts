import type { AggregatedMetrics, InsightCard } from "@shared/types";
import type { InsightProvider } from "./insightProvider";

export class RuleProvider implements InsightProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generate(m: AggregatedMetrics, _context?: { breed?: string; ageYears?: number; conditions?: string[] }): Promise<InsightCard[]> {
    if (m.daysOfData < 3) {
      return [{ severity: "yellow", title: "데이터가 더 필요해요", evidence: `기록 ${m.daysOfData}일`, recommendedAction: "며칠 더 기록하면 분석을 시작할게요." }];
    }
    const cards: InsightCard[] = [];
    if (m.gapKg !== null && m.gapKg > 0.15) {
      cards.push({
        severity: "red",
        title: `${m.dogName}, 목표보다 +${m.gapKg.toFixed(2)}kg`,
        evidence: `7일 추세 ${m.trend7d}, 사료 평균 ${m.avgFoodG7d ?? "?"}g, 산책 ${m.walkCount7d}회`,
        recommendedAction: m.avgFoodG7d && m.avgFoodG7d > 60 ? "사료를 하루 5g 줄여보세요." : "산책 횟수를 늘려보세요.",
      });
    } else if (m.gapKg !== null && Math.abs(m.gapKg) <= 0.15 && m.trend7d === "flat") {
      cards.push({
        severity: "green",
        title: `${m.dogName}, 목표 구간 유지 중`,
        evidence: `목표 대비 ${m.gapKg.toFixed(2)}kg, 추세 안정`,
        recommendedAction: "현재 루틴을 그대로 유지하세요.",
      });
    }
    if (m.walkCount7d === 0) {
      cards.push({ severity: "yellow", title: `${m.dogName}, 최근 산책 기록 없음`, evidence: "7일간 산책 0회", recommendedAction: "가벼운 산책부터 시작해보세요." });
    }
    if (m.abnormalPoop7d >= 2) {
      cards.push({ severity: "yellow", title: `${m.dogName}, 배변 상태 주의`, evidence: `7일간 비정상 배변 ${m.abnormalPoop7d}회`, recommendedAction: "사료/간식 변화를 점검하고 지속되면 수의사와 상담하세요.", disclaimer: "참고용이며 수의사 상담을 대체하지 않습니다." });
    }
    if (!cards.length) cards.push({ severity: "green", title: `${m.dogName}, 특이사항 없음`, evidence: "주요 지표 정상 범위", recommendedAction: "지금처럼 유지하세요." });
    return cards;
  }
}
