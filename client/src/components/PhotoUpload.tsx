import { useRef, useState } from "react";

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
}

// Circular avatar picker that uploads to /api/upload and returns the public URL.
export function PhotoUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    if (file.size > 5 * 1024 * 1024) {
      setError("5MB 이하 이미지만 올릴 수 있어요.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "업로드 실패");
      }
      const { url } = await res.json();
      onChange(url);
    } catch (e: any) {
      setError(e.message ?? "업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="tap relative grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-brand-soft text-2xl"
        aria-label="사진 추가"
      >
        {value ? (
          <img src={value} alt="강아지 사진" className="h-full w-full object-cover" />
        ) : (
          <span className="text-3xl">🐶</span>
        )}
        <span className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-full bg-brand text-xs text-white shadow">
          {uploading ? "…" : "📷"}
        </span>
      </button>
      {value && (
        <button type="button" onClick={() => onChange(null)} className="text-xs text-ink-soft underline">
          사진 제거
        </button>
      )}
      {error && <div className="text-xs text-cat-health">{error}</div>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}
