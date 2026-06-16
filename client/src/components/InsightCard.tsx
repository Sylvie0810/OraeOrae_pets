import type { InsightCard as Card } from "@shared/types";
const tone = { red: "bg-red-50 border-red-200", yellow: "bg-amber-50 border-amber-200", green: "bg-emerald-50 border-emerald-200" };
const dot = { red: "🔴", yellow: "🟡", green: "🟢" };
export function InsightCardView({ card }: { card: Card }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone[card.severity]}`}>
      <div className="font-semibold">{dot[card.severity]} {card.title}</div>
      <div className="mt-1 text-sm text-slate-600">{card.evidence}</div>
      <div className="mt-2 text-sm font-medium">→ {card.recommendedAction}</div>
      {card.disclaimer && <div className="mt-2 text-xs text-slate-400">{card.disclaimer}</div>}
    </div>
  );
}
