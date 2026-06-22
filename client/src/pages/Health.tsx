import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { api } from "@/lib/api";
import { useDog } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Select, Card, SectionTitle } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { SkinSection } from "@/components/SkinSection";
import type { MedicalRecord, Medication, Checkup } from "@shared/schema";

const today = () => new Date().toISOString().slice(0, 10);
const kindLabel = (k: string) => ({ visit: "병원", vaccine: "백신", dewormer: "구충제", other: "기타" } as any)[k] ?? k;
const kindIcon = (k: string) => ({ visit: "🏥", vaccine: "💉", dewormer: "🪱", other: "📋" } as any)[k] ?? "📋";

export default function Health() {
  const { dogId } = useDog();
  if (!dogId) return <Card className="mt-2 text-sm text-ink-soft">강아지를 먼저 등록하세요.</Card>;
  return (
    <div className="flex flex-col gap-4 pb-2 pt-1">
      <MedicationsCard dogId={dogId} />
      <SkinSection dogId={dogId} />
      <CheckupsCard dogId={dogId} />
      <MedicalRecordsCard dogId={dogId} />
    </div>
  );
}

/* ---------------- chronic medications ---------------- */
function MedicationsCard({ dogId }: { dogId: number }) {
  const { data: meds } = useQuery({ queryKey: ["medications", dogId], queryFn: () => api<Medication[]>(`/api/medical/medications/${dogId}`) });
  const inval = () => queryClient.invalidateQueries({ queryKey: ["medications", dogId] });
  const add = useMutation({ mutationFn: (b: any) => api(`/api/medical/medications/${dogId}`, { method: "POST", body: JSON.stringify(b) }), onSuccess: inval });
  const toggle = useMutation({ mutationFn: (m: Medication) => api(`/api/medical/medications/${m.id}`, { method: "PATCH", body: JSON.stringify({ active: !m.active, endDate: m.active ? today() : null }) }), onSuccess: inval });
  const del = useMutation({ mutationFn: (id: number) => api(`/api/medical/medications/${id}`, { method: "DELETE" }), onSuccess: inval });
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <SectionTitle action={<button onClick={() => setOpen(true)} className="text-sm font-semibold text-brand">+ 추가</button>}>💊 복용 중인 약</SectionTitle>
      {!meds?.length ? (
        <p className="py-3 text-center text-sm text-ink-soft">등록된 약이 없어요.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {meds.map((m) => (
            <div key={m.id} className={`rounded-xl border p-3 ${m.active ? "border-cat-food/30 bg-cat-food-bg" : "border-line bg-canvas"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-ink">{m.name} {!m.active && <span className="text-xs font-normal text-ink-soft">(종료)</span>}</div>
                  <div className="text-xs text-ink-soft">{[m.dose, m.frequency].filter(Boolean).join(" · ")}</div>
                  <div className="text-xs text-ink-soft">{m.startDate ?? "?"} ~ {m.endDate ?? "현재"}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggle.mutate(m)} className="tap text-xs text-brand">{m.active ? "종료" : "재시작"}</button>
                  <button onClick={() => del.mutate(m.id)} className="tap text-sm" aria-label="삭제">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="약 추가">
        <MedicationForm onAdd={(b) => { add.mutate(b); setOpen(false); }} />
      </Modal>
    </Card>
  );
}

function MedicationForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startDate, setStartDate] = useState(today());
  return (
    <div className="flex flex-col gap-2">
      <Input placeholder="약 이름 (예: 씬지로이드)" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex gap-2">
        <Input placeholder="용량 (예: 0.1mg 1정)" value={dose} onChange={(e) => setDose(e.target.value)} />
        <Input placeholder="횟수 (예: 1일 2회)" value={frequency} onChange={(e) => setFrequency(e.target.value)} />
      </div>
      <label className="text-xs text-ink-soft">시작일</label>
      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      <Button onClick={() => { if (name) onAdd({ name, dose: dose || null, frequency: frequency || null, startDate, active: true }); }} className="mt-1">추가</Button>
    </div>
  );
}

/* ---------------- annual checkups ---------------- */
const flagTone = (f: string | null) => f === "high" ? "text-cat-health" : f === "low" ? "text-cat-walk" : "text-ink";
const METRIC_COLORS = ["#ff7a5c", "#5b9bf3", "#3ec9a7", "#a78bfa", "#fb9d4b", "#fb7185"];

function CheckupsCard({ dogId }: { dogId: number }) {
  const { data: checkups } = useQuery({ queryKey: ["checkups", dogId], queryFn: () => api<Checkup[]>(`/api/medical/checkups/${dogId}`) });
  const { data: compare } = useQuery({
    queryKey: ["checkup-compare", dogId, checkups?.length],
    queryFn: () => api<{ comparison: string | null }>(`/api/medical/checkups/${dogId}/compare`),
    enabled: (checkups?.length ?? 0) >= 2,
  });
  const inval = () => { queryClient.invalidateQueries({ queryKey: ["checkups", dogId] }); queryClient.invalidateQueries({ queryKey: ["checkup-compare", dogId] }); };
  const del = useMutation({ mutationFn: (id: number) => api(`/api/medical/checkups/${id}`, { method: "DELETE" }), onSuccess: inval });
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openMetric, setOpenMetric] = useState<string | null>(null);

  async function analyze(file: File) {
    setError("");
    if (file.size > 15 * 1024 * 1024) { setError("15MB 이하만 올릴 수 있어요."); return; }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("report", file);
      const res = await fetch(`/api/medical/checkups/${dogId}/analyze`, { method: "POST", credentials: "include", body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "분석 실패");
      inval();
    } catch (e: any) { setError(e.message ?? "분석에 실패했어요."); }
    finally { setBusy(false); }
  }

  // metric names that appear across checkups (for the trend chart)
  const metricNames = useMemo(() => {
    const set = new Set<string>();
    for (const c of checkups ?? []) for (const m of c.metrics ?? []) if (m.value != null) set.add(m.name);
    return [...set];
  }, [checkups]);

  // build a per-date series for the selected metric
  const trend = useMemo(() => {
    if (!openMetric) return [];
    return (checkups ?? []).map((c) => {
      const m = (c.metrics ?? []).find((x) => x.name === openMetric);
      return { date: c.date.slice(2), value: m?.value ?? null };
    }).filter((d) => d.value != null);
  }, [checkups, openMetric]);

  return (
    <Card>
      <SectionTitle>🩺 건강검진 결과</SectionTitle>
      <p className="mb-2 text-xs text-ink-soft">결과지(사진·PDF)를 올리면 AI가 수치를 읽고 매년 비교해드려요.</p>

      {busy ? (
        <div className="rounded-xl border-2 border-dashed border-brand/40 bg-brand-soft px-4 py-3 text-center text-sm font-semibold text-brand-dark">결과지 분석 중… 🩺</div>
      ) : (
        <button onClick={() => fileRef.current?.click()} className="tap w-full rounded-xl border-2 border-dashed border-brand/40 bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark">
          📄 결과지 올려서 분석하기
        </button>
      )}
      {error && <div className="mt-1 text-xs text-cat-health">{error}</div>}
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) analyze(f); e.target.value = ""; }} />

      {/* AI year-over-year comparison */}
      {compare?.comparison && (
        <div className="mt-3 rounded-xl bg-cat-walk-bg p-3 text-sm text-ink">
          <div className="mb-1 font-bold">📈 연도별 비교</div>
          {compare.comparison}
        </div>
      )}

      {/* metric trend chart */}
      {metricNames.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {metricNames.map((n) => (
              <button key={n} onClick={() => setOpenMetric(openMetric === n ? null : n)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${openMetric === n ? "bg-brand text-white" : "bg-canvas text-ink-soft"}`}>{n}</button>
            ))}
          </div>
          {openMetric && trend.length > 0 && (
            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer>
                <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <XAxis dataKey="date" fontSize={11} stroke="#8b8a94" tickLine={false} axisLine={false} />
                  <YAxis domain={["auto", "auto"]} fontSize={11} width={40} stroke="#8b8a94" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #efedf2", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="value" name={openMetric} stroke={METRIC_COLORS[0]} strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* per-checkup list */}
      <div className="mt-3 flex flex-col gap-2">
        {[...(checkups ?? [])].reverse().map((c) => (
          <div key={c.id} className="rounded-xl border border-line p-3">
            <div className="flex items-start justify-between">
              <div className="text-sm font-bold text-ink">{c.date} {c.hospital && <span className="font-normal text-ink-soft">· {c.hospital}</span>}</div>
              <div className="flex gap-2">
                {c.reportUrl && <a href={c.reportUrl} target="_blank" rel="noreferrer" className="text-xs text-brand">원본</a>}
                <button onClick={() => del.mutate(c.id)} className="tap text-sm" aria-label="삭제">🗑️</button>
              </div>
            </div>
            {c.summary && <p className="mt-1 text-sm text-ink-soft">{c.summary}</p>}
            {!!c.metrics?.length && (
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {c.metrics.filter((m) => m.value != null).map((m, i) => (
                  <div key={i} className="flex justify-between border-b border-line py-0.5">
                    <span className="text-ink-soft">{m.name}</span>
                    <span className={`font-semibold ${flagTone(m.flag)}`}>{m.value}{m.unit ?? ""}{m.flag === "high" ? " ▲" : m.flag === "low" ? " ▼" : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- medical records timeline ---------------- */
function MedicalRecordsCard({ dogId }: { dogId: number }) {
  const { data: records } = useQuery({ queryKey: ["medical-records", dogId], queryFn: () => api<MedicalRecord[]>(`/api/medical/records/${dogId}`) });
  const inval = () => queryClient.invalidateQueries({ queryKey: ["medical-records", dogId] });
  const add = useMutation({ mutationFn: (b: any) => api(`/api/medical/records/${dogId}`, { method: "POST", body: JSON.stringify(b) }), onSuccess: inval });
  const del = useMutation({ mutationFn: (id: number) => api(`/api/medical/records/${id}`, { method: "DELETE" }), onSuccess: inval });
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <SectionTitle action={<button onClick={() => setOpen(true)} className="text-sm font-semibold text-brand">+ 추가</button>}>🏥 병원 · 접종 기록</SectionTitle>
      {!records?.length ? (
        <p className="py-3 text-center text-sm text-ink-soft">기록이 없어요.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-xl bg-canvas p-3">
              <span className="text-xl">{kindIcon(r.kind)}</span>
              <div className="flex-1">
                <div className="text-sm font-bold text-ink">{r.title}</div>
                <div className="text-xs text-ink-soft">{r.date} · {kindLabel(r.kind)}{r.hospital ? ` · ${r.hospital}` : ""}{r.cost ? ` · ${Number(r.cost).toLocaleString()}원` : ""}</div>
                {r.note && <div className="mt-0.5 text-xs text-ink-soft">{r.note}</div>}
              </div>
              <button onClick={() => del.mutate(r.id)} className="tap text-sm" aria-label="삭제">🗑️</button>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="병원·접종 기록 추가">
        <MedicalForm onAdd={(b) => { add.mutate(b); setOpen(false); }} />
      </Modal>
    </Card>
  );
}

function MedicalForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [kind, setKind] = useState("visit");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today());
  const [hospital, setHospital] = useState("");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <Select value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="visit">병원 방문</option><option value="vaccine">백신</option><option value="dewormer">구충제</option><option value="other">기타</option>
      </Select>
      <Input placeholder="제목 (예: 갑상선 정기검진)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="flex gap-2">
        <Input placeholder="병원 (선택)" value={hospital} onChange={(e) => setHospital(e.target.value)} />
        <Input type="number" placeholder="비용 (선택)" value={cost} onChange={(e) => setCost(e.target.value)} />
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="메모 (선택)" rows={2}
        className="w-full resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
      <Button onClick={() => { if (title) onAdd({ kind, title, date, hospital: hospital || null, cost: cost || null, note: note || null }); }} className="mt-1">추가</Button>
    </div>
  );
}
