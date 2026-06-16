import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useDog } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Select, Card } from "@/components/ui";

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

  if (!dogId) return <div>강아지를 먼저 등록하세요.</div>;

  return (
    <div className="flex flex-col gap-4">
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      <Card>
        <h3 className="mb-2 font-semibold">⚖️ 체중</h3>
        <WeightForm onAdd={(kg) => addWeight.mutate(kg)} />
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">🍚 사료/간식</h3>
        <FeedingForm onAdd={(b) => addFeeding.mutate(b)} />
        <ul className="mt-2 text-sm">{data?.feedings?.map((f: any) => <li key={f.id}>{f.kind === "food" ? "사료" : "간식"} {f.name ?? ""} {f.amountG ?? "?"}g</li>)}</ul>
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">🚶 산책</h3>
        <WalkForm onAdd={(b) => addWalk.mutate(b)} />
        <ul className="mt-2 text-sm">{data?.walks?.map((w: any) => <li key={w.id}>{w.slot ?? ""} {w.durationMin ?? "?"}분</li>)}</ul>
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">💩 배변</h3>
        <PoopForm onAdd={(b) => addPoop.mutate(b)} />
        <ul className="mt-2 text-sm">{data?.poops?.map((p: any) => <li key={p.id}>{p.status ?? ""}</li>)}</ul>
      </Card>
    </div>
  );
}

function WeightForm({ onAdd }: { onAdd: (kg: string) => void }) {
  const [kg, setKg] = useState("");
  return <div className="flex gap-2"><Input type="number" step="0.01" placeholder="kg" value={kg} onChange={(e) => setKg(e.target.value)} /><Button onClick={() => { if (kg) { onAdd(kg); setKg(""); } }}>저장</Button></div>;
}
function FeedingForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [kind, setKind] = useState("food");
  const [name, setName] = useState("");
  const [amountG, setAmountG] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={kind} onChange={(e) => setKind(e.target.value)}><option value="food">사료</option><option value="treat">간식</option></Select>
      <Input placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
      <Input type="number" placeholder="g" value={amountG} onChange={(e) => setAmountG(e.target.value)} />
      <Button onClick={() => { onAdd({ kind, name, amountG }); setName(""); setAmountG(""); }}>추가</Button>
    </div>
  );
}
function WalkForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [slot, setSlot] = useState("morning");
  const [durationMin, setDurationMin] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={slot} onChange={(e) => setSlot(e.target.value)}><option value="morning">오전</option><option value="afternoon">오후</option><option value="evening">저녁</option></Select>
      <Input type="number" placeholder="분" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
      <Button onClick={() => { onAdd({ slot, durationMin: Number(durationMin) }); setDurationMin(""); }}>추가</Button>
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
      <Button onClick={() => onAdd({ status })}>추가</Button>
    </div>
  );
}
