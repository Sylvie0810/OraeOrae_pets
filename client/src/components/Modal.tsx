import type { ReactNode } from "react";

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div
        className="animate-rise my-auto max-h-[88vh] w-full max-w-md overflow-y-auto rounded-card bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* sticky header so the title + close stay visible while the body scrolls */}
        <div className="sticky top-0 -mt-1 mb-4 flex items-center justify-between bg-white pb-2 pt-1">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="tap grid h-8 w-8 place-items-center rounded-full bg-canvas text-ink-soft" aria-label="닫기">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
