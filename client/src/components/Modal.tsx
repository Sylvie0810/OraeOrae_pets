import type { ReactNode } from "react";

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="animate-rise max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-card bg-white p-5 shadow-xl sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="tap grid h-8 w-8 place-items-center rounded-full bg-canvas text-ink-soft" aria-label="닫기">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
