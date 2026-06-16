import type { InsightCard as Card } from "@shared/types";

const tone: Record<Card["severity"], string> = {
  red: "bg-cat-health-bg border-cat-health/30",
  yellow: "bg-cat-vaccine-bg border-cat-vaccine/30",
  green: "bg-cat-food-bg border-cat-food/30",
};
const dot: Record<Card["severity"], string> = { red: "🔴", yellow: "🟡", green: "🟢" };

export function InsightCardView({ card }: { card: Card }) {
  return (
    <div className={`animate-rise rounded-card border p-4 ${tone[card.severity]}`}>
      <div className="flex items-start gap-2">
        <span className="text-sm leading-6">{dot[card.severity]}</span>
        <div className="flex-1">
          <div className="font-bold text-ink">{card.title}</div>
          <div className="mt-1 text-sm text-ink-soft">{card.evidence}</div>
          <div className="mt-2 inline-block rounded-lg bg-white/70 px-2.5 py-1.5 text-sm font-semibold text-ink">
            → {card.recommendedAction}
          </div>
          {card.disclaimer && <div className="mt-2 text-xs text-ink-soft/80">{card.disclaimer}</div>}
        </div>
      </div>
    </div>
  );
}
