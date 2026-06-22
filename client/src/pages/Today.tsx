import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useDog } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Select, Card, SectionTitle } from "@/components/ui";
import { AutocompleteInput } from "@/components/AutocompleteInput";
import type { Dog } from "@shared/schema";

const todayStr = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5); // "HH:MM"
const slotLabel = (s?: string) => ({ morning: "오전", afternoon: "오후", evening: "저녁" } as any)[s ?? ""] ?? "";
const poopLabel = (s?: string) => ({ normal: "정상", soft: "무름", constipation: "변비", diarrhea: "설사" } as any)[s ?? ""] ?? "";

export default function Today() {
  const { dogId } = useDog();
  const [date, setDate] = useState(todayStr());
  const [bothDogs, setBothDogs] = useState(true); // req 5: apply to both dogs by default
  const { data: dogs } = useQuery({ queryKey: ["dogs"], queryFn: () => api<Dog[]>("/api/dogs") });
  const key = ["daily", dogId, date];
  const { data } = useQuery({ queryKey: key, queryFn: () => api(`/api/daily/${dogId}/${date}`), enabled: !!dogId });

  // target dog ids for an add: current dog, plus the others when "both" is on
  const targetDogIds = (): number[] => {
    if (!dogId) return [];
    if (bothDogs && dogs) return dogs.map((d) => d.id);
    return [dogId];
  };
  const invalidateAll = () => {
    for (const id of targetDogIds()) queryClient.invalidateQueries({ queryKey: ["daily", id, date] });
    queryClient.invalidateQueries({ queryKey: ["weights", dogId] });
  };
  // POST the same body to every target dog (req 5)
  async function addToTargets(seg: string, body: any) {
    await Promise.all(targetDogIds().map((id) => api(`/api/daily/${id}/${date}/${seg}`, { method: "POST", body: JSON.stringify(body) })));
  }

  const addWeight = useMutation({
    mutationFn: (weightKg: string) => api(`/api/weights/${dogId}`, { method: "POST", body: JSON.stringify({ date, weightKg }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["weights", dogId] }),
  });
  const addFeeding = useMutation({ mutationFn: (b: any) => addToTargets("feeding", b), onSuccess: invalidateAll });
  const addWalk = useMutation({ mutationFn: (b: any) => addToTargets("walk", b), onSuccess: invalidateAll });
  const addPoop = useMutation({ mutationFn: (b: any) => addToTargets("poop", b), onSuccess: invalidateAll });
  const addSupp = useMutation({ mutationFn: (b: any) => addToTargets("supplement", b), onSuccess: invalidateAll });
  const saveMemo = useMutation({
    mutationFn: (summaryNote: string) => api(`/api/daily/${dogId}/${date}/memo`, { method: "PATCH", body: JSON.stringify({ summaryNote }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const invalidateDrawer = () => queryClient.invalidateQueries({ queryKey: key });

  if (!dogId) return <Card className="mt-2 text-sm text-ink-soft">강아지를 먼저 등록하세요.</Card>;

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex items-center justify-between pt-1">
        <h2 className="text-lg font-bold text-ink">오늘의 기록</h2>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
      </div>

      {/* req 5: both-dogs toggle */}
      {dogs && dogs.length > 1 && (
        <label className="flex items-center gap-2 rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm font-medium text-ink">
          <input type="checkbox" checked={bothDogs} onChange={(e) => setBothDogs(e.target.checked)} className="h-4 w-4 accent-[#ff7a5c]" />
          사료·간식·산책·영양제를 <b>{dogs.map((d) => d.name).join(" · ")}</b> 모두에게 한 번에 기록
        </label>
      )}

      <Card>
        <SectionTitle>⚖️ 체중</SectionTitle>
        <WeightForm onAdd={(kg) => addWeight.mutate(kg)} />
      </Card>

      <Card>
        <SectionTitle>🍚 사료 · 간식</SectionTitle>
        <FeedingForm onAdd={(b) => addFeeding.mutate(b)} />
        <div className="mt-3 flex flex-col gap-1.5">
          {data?.feedings?.map((f: any) => <FeedingRow key={f.id} entry={f} onChanged={invalidateDrawer} />)}
        </div>
      </Card>

      <Card>
        <SectionTitle>💊 영양제 · 약</SectionTitle>
        <SupplementForm onAdd={(b) => addSupp.mutate(b)} />
        <div className="mt-3 flex flex-col gap-1.5">
          {data?.supplements?.map((s: any) => <SupplementRow key={s.id} entry={s} onChanged={invalidateDrawer} />)}
        </div>
      </Card>

      <Card>
        <SectionTitle>🐾 산책</SectionTitle>
        <WalkForm onAdd={(b) => addWalk.mutate(b)} />
        <div className="mt-3 flex flex-col gap-1.5">
          {data?.walks?.map((w: any) => <WalkRow key={w.id} entry={w} onChanged={invalidateDrawer} />)}
        </div>
      </Card>

      <Card>
        <SectionTitle>💩 배변</SectionTitle>
        <PoopForm onAdd={(b) => addPoop.mutate(b)} />
        <div className="mt-3 flex flex-col gap-1.5">
          {data?.poops?.map((p: any) => <PoopRow key={p.id} entry={p} onChanged={invalidateDrawer} />)}
        </div>
      </Card>

      {/* req 7: daily memo */}
      <Card>
        <SectionTitle>📝 메모</SectionTitle>
        <MemoForm value={data?.log?.summaryNote ?? ""} onSave={(t) => saveMemo.mutate(t)} />
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

// human-readable amount summary for a feeding entry (req 6: any of g / qty / kcal)
function feedingAmount(f: any): string {
  const parts: string[] = [];
  if (f.amountG != null && f.amountG !== "") parts.push(`${f.amountG}g`);
  if (f.qty != null && f.qty !== "") parts.push(`${f.qty}개`);
  if (f.kcal != null && f.kcal !== "") parts.push(`${f.kcal}kcal`);
  return parts.join(" · ");
}

/* ---------- feeding ---------- */
function FeedingRow({ entry, onChanged }: { entry: any; onChanged: () => void }) {
  const { patch, del } = useEntryMutations("feeding", onChanged);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(entry.name ?? "");
  const [amountG, setAmountG] = useState(entry.amountG ?? "");
  const [qty, setQty] = useState(entry.qty ?? "");
  const [kcal, setKcal] = useState(entry.kcal ?? "");
  const [fedAt, setFedAt] = useState(entry.fedAt?.slice(0, 5) ?? "");
  if (edit) {
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-brand-soft p-2">
        <div className="flex flex-wrap gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" className="flex-1" />
          <Input type="time" value={fedAt} onChange={(e) => setFedAt(e.target.value)} className="w-28" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Input type="number" value={amountG} onChange={(e) => setAmountG(e.target.value)} placeholder="g" className="w-20" />
          <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="개수" className="w-20" />
          <Input type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="kcal" className="w-24" />
          <Button onClick={() => { patch.mutate({ id: entry.id, body: { name, amountG: amountG || null, qty: qty || null, kcal: kcal || null, fedAt: fedAt || null } }); setEdit(false); }}>저장</Button>
          <button onClick={() => setEdit(false)} className="text-sm text-ink-soft">취소</button>
        </div>
      </div>
    );
  }
  const amt = feedingAmount(entry);
  return (
    <RowShell onEdit={() => setEdit(true)} onDelete={() => del.mutate(entry.id)}>
      {entry.fedAt && <span className="mr-1 text-xs text-ink-soft">{entry.fedAt.slice(0, 5)}</span>}
      {entry.kind === "food" ? "사료" : "간식"} {entry.name ?? ""} {amt && `· ${amt}`}
    </RowShell>
  );
}

/* ---------- supplement ---------- */
function SupplementRow({ entry, onChanged }: { entry: any; onChanged: () => void }) {
  const { patch, del } = useEntryMutations("supplement", onChanged);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(entry.name ?? "");
  const [dose, setDose] = useState(entry.dose ?? "");
  const [givenAt, setGivenAt] = useState(entry.givenAt?.slice(0, 5) ?? "");
  if (edit) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-soft p-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" className="flex-1" />
        <Input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="용량" className="w-24" />
        <Input type="time" value={givenAt} onChange={(e) => setGivenAt(e.target.value)} className="w-28" />
        <Button onClick={() => { patch.mutate({ id: entry.id, body: { name, dose: dose || null, givenAt: givenAt || null } }); setEdit(false); }}>저장</Button>
        <button onClick={() => setEdit(false)} className="text-sm text-ink-soft">취소</button>
      </div>
    );
  }
  return (
    <RowShell onEdit={() => setEdit(true)} onDelete={() => del.mutate(entry.id)}>
      {entry.givenAt && <span className="mr-1 text-xs text-ink-soft">{entry.givenAt.slice(0, 5)}</span>}
      {entry.name} {entry.dose && `· ${entry.dose}`}
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
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-soft p-2">
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
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-soft p-2">
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
  const [qty, setQty] = useState("");
  const [kcal, setKcal] = useState("");
  const [fedAt, setFedAt] = useState(nowTime()); // req 4: default to now
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-24"><option value="food">사료</option><option value="treat">간식</option></Select>
        <div className="flex-1">
          <AutocompleteInput value={name} onChange={setName} placeholder="이름 (저장됨)" suggestUrl="/api/daily/suggestions/feeding" queryKey={["feeding-suggestions"]} />
        </div>
        <Input type="time" value={fedAt} onChange={(e) => setFedAt(e.target.value)} className="w-28" />
      </div>
      {/* req 6: any of weight / count / kcal — none required */}
      <div className="flex gap-2">
        <Input type="number" placeholder="g (선택)" value={amountG} onChange={(e) => setAmountG(e.target.value)} className="flex-1" />
        <Input type="number" placeholder="개수 (선택)" value={qty} onChange={(e) => setQty(e.target.value)} className="flex-1" />
        <Input type="number" placeholder="kcal (선택)" value={kcal} onChange={(e) => setKcal(e.target.value)} className="flex-1" />
        <Button variant="muted" onClick={() => { if (name) { onAdd({ kind, name, amountG: amountG || null, qty: qty || null, kcal: kcal || null, fedAt: fedAt || null }); setName(""); setAmountG(""); setQty(""); setKcal(""); } }}>추가</Button>
      </div>
    </div>
  );
}

function SupplementForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [givenAt, setGivenAt] = useState(nowTime());
  // req 3: autocomplete from past supplements, auto-fill dose when a known name is picked
  const { data: suggestions } = useQuery({ queryKey: ["supplement-suggestions"], queryFn: () => api<{ name: string; dose: string | null }[]>("/api/daily/suggestions/supplement"), staleTime: 60_000 });
  function pickName(v: string) {
    setName(v);
    const match = suggestions?.find((s) => s.name === v);
    if (match && match.dose) setDose(match.dose); // auto-fill last-used dose
  }
  return (
    <div className="flex flex-wrap gap-2">
      <div className="min-w-[40%] flex-1">
        <AutoSupplement value={name} onChange={pickName} options={suggestions ?? []} />
      </div>
      <Input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="용량 (선택)" className="w-24" />
      <Input type="time" value={givenAt} onChange={(e) => setGivenAt(e.target.value)} className="w-28" />
      <Button variant="muted" onClick={() => { if (name) { onAdd({ name, dose: dose || null, givenAt: givenAt || null }); setName(""); setDose(""); } }}>추가</Button>
    </div>
  );
}

// datalist-backed supplement name input (auto-fill handled by parent)
function AutoSupplement({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { name: string }[] }) {
  return (
    <>
      <input
        list="supp-list"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="영양제/약 이름 (저장됨)"
        className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
      <datalist id="supp-list">{options.map((o) => <option key={o.name} value={o.name} />)}</datalist>
    </>
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

function MemoForm({ value, onSave }: { value: string; onSave: (t: string) => void }) {
  const [text, setText] = useState(value);
  // keep local text in sync when switching days
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) { setLastValue(value); setText(value); }
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="예: 아미가 사료 거부, 저녁에 공복토 함"
        rows={3}
        className="w-full resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
      <Button onClick={() => onSave(text)} className="self-end">메모 저장</Button>
    </div>
  );
}
