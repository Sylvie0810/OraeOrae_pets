import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useDog } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Select, Card, SectionTitle } from "@/components/ui";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function Today() {
  const { dogId } = useDog();
  const [date, setDate] = useState(todayStr());
  const key = ["daily", dogId, date];
  const { data } = useQuery({ queryKey: key, queryFn: () => api(`/api/daily/${dogId}/${date}`), enabled: !!dogId });

  const addWeight = useMutation({
    mutationFn: (weightKg: string) => api(`/api/weights/${dogId}`, { method: "POST", body: JSON.stringify({ date, weightKg }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["weights", dogId] }),
  });
  const addFeeding = useMutation({
    mutationFn: (b: any) => api(`/api/daily/${dogId}/${date}/feeding`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const addWalk = useMutation({
    mutationFn: (b: any) => api(`/api/daily/${dogId}/${date}/walk`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const addPoop = useMutation({
    mutationFn: (b: any) => api(`/api/daily/${dogId}/${date}/poop`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

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
        <EntryList items={data?.feedings} render={(f: any) => `${f.kind === "food" ? "사료" : "간식"} ${f.name ?? ""} ${f.amountG ?? "?"}g`} />
      </Card>

      <Card>
        <SectionTitle>🐾 산책</SectionTitle>
        <WalkForm onAdd={(b) => addWalk.mutate(b)} />
        <EntryList items={data?.walks} render={(w: any) => `${slotLabel(w.slot)} ${w.durationMin ?? "?"}분`} />
      </Card>

      <Card>
        <SectionTitle>💩 배변</SectionTitle>
        <PoopForm onAdd={(b) => addPoop.mutate(b)} />
        <EntryList items={data?.poops} render={(p: any) => poopLabel(p.status)} />
      </Card>
    </div>
  );
}

const slotLabel = (s?: string) => ({ morning: "오전", afternoon: "오후", evening: "저녁" } as any)[s ?? ""] ?? "";
const poopLabel = (s?: string) => ({ normal: "정상", soft: "무름", constipation: "변비", diarrhea: "설사" } as any)[s ?? ""] ?? "";

function EntryList({ items, render }: { items?: any[]; render: (x: any) => string }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-3 flex flex-col gap-1.5">
      {items.map((it) => (
        <li key={it.id} className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink">{render(it)}</li>
      ))}
    </ul>
  );
}

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
      <Input placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
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
