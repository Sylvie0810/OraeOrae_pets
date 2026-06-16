import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Button({ children, className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`rounded-xl px-4 py-2 font-medium bg-slate-900 text-white active:scale-95 disabled:opacity-50 ${className}`} {...p}>{children}</button>;
}
export function Input({ className = "", ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`w-full rounded-xl border border-slate-300 px-3 py-2 ${className}`} {...p} />;
}
export function Select({ className = "", children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return <select className={`w-full rounded-xl border border-slate-300 px-3 py-2 ${className}`} {...p}>{children}</select>;
}
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}
