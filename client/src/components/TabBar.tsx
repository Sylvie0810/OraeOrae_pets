import { Link, useLocation } from "wouter";

const tabs = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/today", label: "오늘", icon: "📝" },
  { href: "/weight", label: "체중", icon: "📊" },
  { href: "/expenses", label: "비용", icon: "💰" },
];

export function TabBar() {
  const [loc] = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map((t) => {
          const active = loc === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors ${active ? "text-brand" : "text-ink-soft"}`}
            >
              <span className={`text-lg leading-none transition-transform ${active ? "scale-110" : ""}`}>{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
