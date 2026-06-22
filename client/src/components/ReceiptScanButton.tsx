import { useRef, useState } from "react";

export interface ReceiptResult {
  receiptUrl: string;
  extracted: {
    amount: number | null;
    vendor: string | null;
    date: string | null;
    category: string | null;
    items: string | null;
  };
}

// Captures/uploads a receipt photo, runs server OCR, and hands the result back.
export function ReceiptScanButton({ onResult }: { onResult: (r: ReceiptResult) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    if (file.size > 8 * 1024 * 1024) { setError("8MB 이하 이미지만 올릴 수 있어요."); return; }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/receipt/scan", { method: "POST", credentials: "include", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "영수증 분석 실패");
      }
      onResult(await res.json());
    } catch (e: any) {
      setError(e.message ?? "영수증 분석에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="tap flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/40 bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark disabled:opacity-60"
      >
        {busy ? "영수증 분석 중… 🧾" : "📷 영수증 촬영으로 자동 입력"}
      </button>
      {error && <div className="text-xs text-cat-health">{error}</div>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}
