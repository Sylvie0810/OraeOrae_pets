import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type Variant = "primary" | "muted" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-sm hover:bg-brand-dark",
  muted: "bg-[#7fd1c4] text-white shadow-sm hover:brightness-95",
  ghost: "bg-white text-ink border border-line hover:bg-canvas",
};

export function Button({ children, className = "", variant = "primary", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`tap whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${variants[variant]} ${className}`}
      {...p}
    >
      {children}
    </button>
  );
}

export function Input({ className = "", ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15 ${className}`}
      {...p}
    />
  );
}

export function Select({ className = "", children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      className={`w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15 ${className}`}
      {...p}
    >
      {children}
    </select>
  );
}

export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const base = `animate-rise rounded-card bg-white p-4 shadow-[0_2px_12px_rgba(44,42,51,0.05)] ${className}`;
  // When clickable, render as a real button for keyboard/a11y and add a tap affordance.
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`tap w-full text-left transition active:scale-[0.99] ${base}`}>
        {children}
      </button>
    );
  }
  return <div className={base}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-base font-bold text-ink">{children}</h3>
      {action}
    </div>
  );
}
