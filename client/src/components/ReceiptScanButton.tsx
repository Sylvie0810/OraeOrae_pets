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
  const cameraRef = useRef<HTMLInputElement>(null); // opens camera (capture)
  const galleryRef = useRef<HTMLInputElement>(null); // opens photo picker
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
      {busy ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/40 bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark">
          영수증 분석 중… 🧾
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="tap flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-brand/40 bg-brand-soft px-3 py-3 text-sm font-semibold text-brand-dark"
          >
            📷 촬영
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="tap flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-brand/40 bg-brand-soft px-3 py-3 text-sm font-semibold text-brand-dark"
          >
            🖼️ 사진 선택
          </button>
        </div>
      )}
      <p className="text-center text-[11px] text-ink-soft">영수증을 올리면 금액·구매처가 자동 입력돼요</p>
      {error && <div className="text-xs text-cat-health">{error}</div>}

      {/* camera (mobile opens the camera directly) */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
      {/* gallery (no capture → opens the photo picker / file chooser) */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}
