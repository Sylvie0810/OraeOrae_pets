import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useDog } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Select, Card, SectionTitle } from "@/components/ui";
import { AutocompleteInput } from "@/components/AutocompleteInput";

const todayStr = () => new Date().toISOString().slice(0, 10);
const slotLabel = (s?: string) => ({ morning: "오전", afternoon: "오후", evening: "저녁" } as any)[s ?? ""] ?? "";
const poopLabel = (s?: string) => ({ normal: "정상", soft: "무름", constipation: "변비", diarrhea: "설사" } as any)[s ?? ""] ?? "";

export default function Today() {
  const { dogId } = useDog();
  const [date, setDate] = useState(todayStr());
  const key = ["daily", dogId, date];
  const { data } = useQuery({ queryKey: key, queryFn: () => api(`/api/daily/${dogId}/${date}`), enabled: !!dogId });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const addWeight = useMutation({
    mutationFn: (weightKg: string) => api(`/api/weights/${dogId}`, { method: "POST", body: JSON.stringify({ date, weightKg }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["weights", dogId] }),
  });
  const addFeeding = useMutation({ mutationFn: (b: any) => api(`/api/daily/${dogId}/${date}/feeding`, { method: "POST", body: JSON.stringify(b) }), onSuccess: invalidate });
  const addWalk = useMutation({ mutationFn: (b: any) => api(`/api/daily/${dogId}/${date}/walk`, { method: "POST", body: JSON.stringify(b) }), onSuccess: invalidate });
  const addPoop = useMutation({ mutationFn: (b: any) => api(`/api/daily/${dogId}/${date}/poop`, { method: "POST", body: JSON.stringify(b) }), onSuccess: invalidate });

  if (!dogId) return <Card className="mt-2 text-sm text-ink-soft">강아지를 먼저 등록하세요.</Card>;

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex items-center justify-between pt-1">
        <h2 className="text-lg font-bold text-ink">오늘의 기록</h2>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
      </div>

      <Card>
        <SectionTitle>⚖️ 체중</SectionTitle>
        <WeightForm onAdd={(kg) => addWeight.mutate(kg)} />
      </Card>

      <Card>
        <SectionTitle>🍚 사료 · 간식</SectionTitle>
        <FeedingForm onAdd={(b) => addFeeding.mutate(b)} />
        <div className="mt-3 flex flex-col gap-1.5">
          {data?.feedings?.map((f: any) => <FeedingRow key={f.id} entry={f} onChanged={invalidate} />)}
        </div>
      </Card>

      <Card>
        <SectionTitle>🐾 산책</SectionTitle>
        <WalkForm onAdd={(b) => addWalk.mutate(b)} />
        <div className="mt-3 flex flex-col gap-1.5">
          {data?.walks?.map((w: any) => <WalkRow key={w.id} entry={w} onChanged={invalidate} />)}
        </div>
      </Card>

      <Card>
        <SectionTitle>💩 배변</SectionTitle>
        <PoopForm onAdd={(b) => addPoop.mutate(b)} />
        <div className="mt-3 flex flex-col gap-1.5">
          {data?.poops?.map((p: any) => <PoopRow key={p.id} entry={p} onChanged={invalidate} />)}
        </div>
      </Card>
    </div>
  );
}

/* ---------- shared row chrome ---------- */
function RowShell({ children, onEdit, onDelete }: { children: React.ReactNode; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2">
      <div className="flex-1 text-sm text-ink">{children}</div>
      <button onClick={onEdit} className="tap text-sm" aria-label="수정">✏️</button>
      <button onClick={onDelete} className="tap text-sm" aria-label="삭제">🗑️</button>
    </div>
  );
}

function useEntryMutations(seg: string, onChanged: () => void) {
  const patch = useMutation({ mutationFn: (v: { id: number; body: any }) => api(`/api/daily/${seg}/${v.id}`, { method: "PATCH", body: JSON.stringify(v.body) }), onSuccess: onChanged });
  const del = useMutation({ mutationFn: (id: number) => api(`/api/daily/${seg}/${id}`, { method: "DELETE" }), onSuccess: onChanged });
  return { patch, del };
}

/* ---------- feeding ---------- */
function FeedingRow({ entry, onChanged }: { entry: any; onChanged: () => void }) {
  const { patch, del } = useEntryMutations("feeding", onChanged);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(entry.name ?? "");
  const [amountG, setAmountG] = useState(entry.amountG ?? "");
  if (edit) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-soft px-3 py-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" className="flex-1" />
        <Input type="number" value={amountG} onChange={(e) => setAmountG(e.target.value)} placeholder="g" className="w-20" />
        <Button onClick={() => { patch.mutate({ id: entry.id, body: { name, amountG } }); setEdit(false); }}>저장</Button>
        <button onClick={() => setEdit(false)} className="text-sm text-ink-soft">취소</button>
      </div>
    );
  }
  return (
    <RowShell onEdit={() => setEdit(true)} onDelete={() => del.mutate(entry.id)}>
      {entry.kind === "food" ? "사료" : "간식"} {entry.name ?? ""} {entry.amountG ?? "?"}g
    </RowShell>
  );
}

/* ---------- walk ---------- */
function WalkRow({ entry, onChanged }: { entry: any; onChanged: () => void }) {
  const { patch, del } = useEntryMutations("walk", onChanged);
  const [edit, setEdit] = useState(false);
  const [slot, setSlot] = useState(entry.slot ?? "morning");
  const [durationMin, setDurationMin] = useState(String(entry.durationMin ?? ""));
  if (edit) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-soft px-3 py-2">
        <Select value={slot} onChange={(e) => setSlot(e.target.value)} className="w-24"><option value="morning">오전</option><option value="afternoon">오후</option><option value="evening">저녁</option></Select>
        <Input type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="분" className="w-20" />
        <Button onClick={() => { patch.mutate({ id: entry.id, body: { slot, durationMin: Number(durationMin) } }); setEdit(false); }}>저장</Button>
        <button onClick={() => setEdit(false)} className="text-sm text-ink-soft">취소</button>
      </div>
    );
  }
  return (
    <RowShell onEdit={() => setEdit(true)} onDelete={() => del.mutate(entry.id)}>
      {slotLabel(entry.slot)} {entry.durationMin ?? "?"}분
    </RowShell>
  );
}

/* ---------- poop ---------- */
function PoopRow({ entry, onChanged }: { entry: any; onChanged: () => void }) {
  const { patch, del } = useEntryMutations("poop", onChanged);
  const [edit, setEdit] = useState(false);
  const [status, setStatus] = useState(entry.status ?? "normal");
  if (edit) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-soft px-3 py-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="flex-1">
          <option value="normal">정상</option><option value="soft">무름</option><option value="constipation">변비</option><option value="diarrhea">설사</option>
        </Select>
        <Button onClick={() => { patch.mutate({ id: entry.id, body: { status } }); setEdit(false); }}>저장</Button>
        <button onClick={() => setEdit(false)} className="text-sm text-ink-soft">취소</button>
      </div>
    );
  }
  return (
    <RowShell onEdit={() => setEdit(true)} onDelete={() => del.mutate(entry.id)}>
      {poopLabel(entry.status)}
    </RowShell>
  );
}

/* ---------- add forms ---------- */
function WeightForm({ onAdd }: { onAdd: (kg: string) => void }) {
  const [kg, setKg] = useState("");
  return (
    <div className="flex gap-2">
      <Input type="number" step="0.01" placeholder="kg" value={kg} onChange={(e) => setKg(e.target.value)} />
      <Button onClick={() => { if (kg) { onAdd(kg); setKg(""); } }}>저장</Button>
    </div>
  );
}
function FeedingForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [kind, setKind] = useState("food");
  const [name, setName] = useState("");
  const [amountG, setAmountG] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-24"><option value="food">사료</option><option value="treat">간식</option></Select>
      <div className="min-w-[40%] flex-1">
        <AutocompleteInput value={name} onChange={setName} placeholder="이름 (저장됨)" suggestUrl="/api/daily/suggestions/feeding" queryKey={["feeding-suggestions"]} />
      </div>
      <Input type="number" placeholder="g" value={amountG} onChange={(e) => setAmountG(e.target.value)} className="w-20" />
      <Button variant="muted" onClick={() => { onAdd({ kind, name, amountG }); setName(""); setAmountG(""); }}>추가</Button>
    </div>
  );
}
function WalkForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [slot, setSlot] = useState("morning");
  const [durationMin, setDurationMin] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={slot} onChange={(e) => setSlot(e.target.value)} className="w-24"><option value="morning">오전</option><option value="afternoon">오후</option><option value="evening">저녁</option></Select>
      <Input type="number" placeholder="분" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} className="flex-1" />
      <Button variant="muted" onClick={() => { onAdd({ slot, durationMin: Number(durationMin) }); setDurationMin(""); }}>추가</Button>
    </div>
  );
}
function PoopForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [status, setStatus] = useState("normal");
  return (
    <div className="flex gap-2">
      <Select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="normal">정상</option><option value="soft">무름</option><option value="constipation">변비</option><option value="diarrhea">설사</option>
      </Select>
      <Button variant="muted" onClick={() => onAdd({ status })}>추가</Button>
    </div>
  );
}
