import { useLocation } from "wouter";

interface Item {
  label: string;
  icon: string;
  bg: string;
  fg: string;
  href?: string;
  soon?: boolean;
}

// Mirrors the old app's 2×4 pastel grid. Items without a route yet are marked "soon".
const ITEMS: Item[] = [
  { label: "몸무게", icon: "⚖️", bg: "bg-cat-weight-bg", fg: "text-cat-weight", href: "/today" },
  { label: "식사", icon: "🍚", bg: "bg-cat-food-bg", fg: "text-cat-food", href: "/today" },
  { label: "산책", icon: "🐾", bg: "bg-cat-walk-bg", fg: "text-cat-walk", href: "/today" },
  { label: "오늘의 추억", icon: "📷", bg: "bg-cat-memory-bg", fg: "text-cat-memory", soon: true },
  { label: "비용", icon: "💰", bg: "bg-cat-cost-bg", fg: "text-cat-cost", href: "/expenses" },
  { label: "건강", icon: "❤️", bg: "bg-cat-health-bg", fg: "text-cat-health", soon: true },
  { label: "접종", icon: "💉", bg: "bg-cat-vaccine-bg", fg: "text-cat-vaccine", soon: true },
  { label: "병원", icon: "🏥", bg: "bg-cat-hospital-bg", fg: "text-cat-hospital", soon: true },
];

export function QuickRecord() {
  const [, navigate] = useLocation();
  return (
    <div className="grid grid-cols-4 gap-y-4 gap-x-2">
      {ITEMS.map((it) => (
        <button
          key={it.label}
          onClick={() => it.href && navigate(it.href)}
          className="tap group flex flex-col items-center gap-1.5"
          disabled={!it.href}
        >
          <span className={`relative grid h-14 w-14 place-items-center rounded-full ${it.bg} text-2xl ${!it.href ? "opacity-60" : ""}`}>
            <span className={it.fg}>{it.icon}</span>
            {it.soon && (
              <span className="absolute -right-1 -top-1 rounded-full bg-ink-soft/80 px-1.5 py-0.5 text-[8px] font-bold text-white">곧</span>
            )}
          </span>
          <span className="text-xs font-medium text-ink">{it.label}</span>
        </button>
      ))}
    </div>
  );
}
