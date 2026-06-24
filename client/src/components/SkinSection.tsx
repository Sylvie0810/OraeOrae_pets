import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Select, Card, SectionTitle } from "@/components/ui";
import type { SkinPhoto } from "@shared/schema";
import { todayKST } from "@shared/date";

const today = todayKST; // Asia/Seoul "today" — never UTC
const sourceLabel = (s: string) => (s === "shop" ? "🛁 스파샵" : "🏠 직접");
const PARTS = ["등", "배", "앞다리", "뒷다리", "귀", "얼굴", "목", "꼬리", "겨드랑이", "사타구니"];

export function SkinSection({ dogId }: { dogId: number }) {
  const { data: photos } = useQuery({ queryKey: ["skin", dogId], queryFn: () => api<SkinPhoto[]>(`/api/skin/${dogId}`) });
  const inval = () => queryClient.invalidateQueries({ queryKey: ["skin", dogId] });
  const del = useMutation({ mutationFn: (id: number) => api(`/api/skin/${id}`, { method: "DELETE" }), onSuccess: inval });

  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bodyPart, setBodyPart] = useState("등");
  const [date, setDate] = useState(today());
  const [comment, setComment] = useState("");
  const [source, setSource] = useState("owner");
  const [filter, setFilter] = useState<string>("all");

  // distinct body parts present (for the comparison filter)
  const parts = useMemo(() => [...new Set((photos ?? []).map((p) => p.bodyPart))], [photos]);

  // when a body part is selected, show that part oldest→newest (comparison); else newest first
  const shown = useMemo(() => {
    const list = (photos ?? []).filter((p) => filter === "all" || p.bodyPart === filter);
    return filter === "all" ? list : [...list].sort((a, b) => a.date.localeCompare(b.date));
  }, [photos, filter]);

  async function uploadFile(file: File) {
    setError("");
    if (file.size > 10 * 1024 * 1024) { setError("10MB 이하만 올릴 수 있어요."); return; }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      form.append("bodyPart", bodyPart || "기타");
      form.append("date", date);
      form.append("comment", comment);
      form.append("source", source);
      const res = await fetch(`/api/skin/${dogId}`, { method: "POST", credentials: "include", body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "업로드 실패");
      setComment("");
      inval();
    } catch (e: any) { setError(e.message ?? "업로드에 실패했어요."); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <SectionTitle>🐾 피부 사진</SectionTitle>
      <p className="mb-2 text-xs text-ink-soft">부위별로 사진을 올리면 같은 부위끼리 시간순으로 비교할 수 있어요.</p>

      {/* upload form */}
      <div className="flex flex-col gap-2 rounded-xl bg-brand-soft p-3">
        {/* 부위 선택 — 목록에서 고르거나 '직접 입력' */}
        <div className="flex gap-2">
          <Select value={PARTS.includes(bodyPart) ? bodyPart : "__custom"} onChange={(e) => setBodyPart(e.target.value === "__custom" ? "" : e.target.value)} className="flex-[2]">
            {PARTS.map((p) => <option key={p} value={p}>{p}</option>)}
            <option value="__custom">직접 입력…</option>
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1" />
        </div>
        {!PARTS.includes(bodyPart) && (
          <Input value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} placeholder="부위 직접 입력 (예: 옆구리)" autoFocus />
        )}
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="코멘트 (예: 탈모 부위 붉음, 딱지 생김)" rows={2}
          className="w-full resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
        <Select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="owner">🏠 직접 찍음</option>
          <option value="shop">🛁 스파샵 원장님</option>
        </Select>
        {busy ? (
          <div className="rounded-xl bg-white py-2.5 text-center text-sm font-semibold text-brand-dark">업로드 중… 📷</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="muted" onClick={() => fileRef.current?.click()}>📷 촬영</Button>
            <Button variant="muted" onClick={() => galleryRef.current?.click()}>🖼️ 사진 선택</Button>
          </div>
        )}
        {error && <div className="text-xs text-cat-health">{error}</div>}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
      </div>

      {/* body-part filter for comparison */}
      {parts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button onClick={() => setFilter("all")} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${filter === "all" ? "bg-brand text-white" : "bg-canvas text-ink-soft"}`}>전체</button>
          {parts.map((p) => (
            <button key={p} onClick={() => setFilter(p)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${filter === p ? "bg-brand text-white" : "bg-canvas text-ink-soft"}`}>{p}</button>
          ))}
        </div>
      )}
      {filter !== "all" && shown.length > 1 && (
        <p className="mt-2 text-xs text-ink-soft">← 과거부터 현재까지 · 가로로 넘겨서 비교하세요</p>
      )}

      {/* photo grid (or horizontal comparison strip when a part is selected) */}
      {!photos?.length ? (
        <p className="py-4 text-center text-sm text-ink-soft">아직 사진이 없어요.</p>
      ) : filter !== "all" ? (
        <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
          {shown.map((p) => <PhotoCard key={p.id} p={p} onDelete={() => del.mutate(p.id)} wide />)}
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-3">
          {shown.map((p) => <PhotoCard key={p.id} p={p} onDelete={() => del.mutate(p.id)} />)}
        </div>
      )}
    </Card>
  );
}

function PhotoCard({ p, onDelete, wide }: { p: SkinPhoto; onDelete: () => void; wide?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-line ${wide ? "w-44 shrink-0" : ""}`}>
      <a href={p.photoUrl} target="_blank" rel="noreferrer">
        <img src={p.photoUrl} alt={p.bodyPart} className="aspect-square w-full object-cover" />
      </a>
      <div className="p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-ink">{p.bodyPart}</span>
          <button onClick={onDelete} className="tap text-xs" aria-label="삭제">🗑️</button>
        </div>
        <div className="text-[11px] text-ink-soft">{p.date} · {sourceLabel(p.source)}</div>
        {p.comment && <div className="mt-1 text-xs text-ink-soft">{p.comment}</div>}
      </div>
    </div>
  );
}
