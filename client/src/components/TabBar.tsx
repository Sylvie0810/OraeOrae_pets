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
    <nav className="fixed bottom-0 inset-x-0 grid grid-cols-4 border-t border-slate-200 bg-white">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`flex flex-col items-center py-2 text-xs ${loc === t.href ? "text-slate-900 font-semibold" : "text-slate-400"}`}>
          <span className="text-lg">{t.icon}</span>{t.label}
        </Link>
      ))}
    </nav>
  );
}
