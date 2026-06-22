import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import { useDog } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Card, SectionTitle } from "@/components/ui";
import type { WeightLog, WeightGoal } from "@shared/schema";

function WeightRow({ log, prevKg, dogId }: { log: WeightLog; prevKg: number | null; dogId: number }) {
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["weights", dogId] });
  const patch = useMutation({ mutationFn: (weightKg: string) => api(`/api/weights/log/${log.id}`, { method: "PATCH", body: JSON.stringify({ weightKg }) }), onSuccess: invalidate });
  const del = useMutation({ mutationFn: () => api(`/api/weights/log/${log.id}`, { method: "DELETE" }), onSuccess: invalidate });
  const [edit, setEdit] = useState(false);
  const [kg, setKg] = useState(String(log.weightKg));

  // change vs the previous (older) record
  const delta = prevKg === null ? null : Number((Number(log.weightKg) - prevKg).toFixed(2));
  const deltaTone = delta === null || delta === 0 ? "bg-canvas text-ink-soft" : delta > 0 ? "bg-cat-health-bg text-cat-health" : "bg-cat-walk-bg text-cat-walk";
  const deltaText = delta === null ? "—" : delta === 0 ? "0.0kg" : `${delta > 0 ? "+" : ""}${delta}kg`;

  return (
    <div className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-0">
      <span className="w-20 text-xs text-ink-soft">{log.date}</span>
      {edit ? (
        <>
          <Input type="number" step="0.01" value={kg} onChange={(e) => setKg(e.target.value)} className="w-24" />
          <Button onClick={() => { patch.mutate(kg); setEdit(false); }}>저장</Button>
          <button onClick={() => setEdit(false)} className="text-sm text-ink-soft">취소</button>
        </>
      ) : (
        <>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${deltaTone}`}>{deltaText}</span>
          <span className="flex-1 text-right font-semibold text-ink">{log.weightKg}kg</span>
          <button onClick={() => setEdit(true)} className="tap text-sm" aria-label="수정">✏️</button>
          <button onClick={() => del.mutate()} className="tap text-sm" aria-label="삭제">🗑️</button>
        </>
      )}
    </div>
  );
}

export default function Weight() {
  const { dogId } = useDog();
  const { data: logs } = useQuery({ queryKey: ["weights", dogId], queryFn: () => api<WeightLog[]>(`/api/weights/${dogId}`), enabled: !!dogId });
  const { data: goals } = useQuery({ queryKey: ["weight-goals", dogId], queryFn: () => api<WeightGoal[]>(`/api/weights/${dogId}/goals`), enabled: !!dogId });

  const setGoal = useMutation({
    mutationFn: (b: any) => api(`/api/weights/${dogId}/goals`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["weight-goals", dogId] }),
  });

  const data = useMemo(() => (logs ?? []).map((l) => ({ date: l.date.slice(5), kg: Number(l.weightKg) })), [logs]);
  const activeGoal = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (goals ?? []).filter((g) => g.effectiveFrom <= today).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).pop();
  }, [goals]);

  // Y-axis domain that always includes the goal line, with a little padding,
  // so the dashed target is visible even when it's outside the data range.
  const yDomain = useMemo<[number, number]>(() => {
    const vals = data.map((d) => d.kg);
    if (activeGoal) vals.push(Number(activeGoal.targetKg));
    if (!vals.length) return [0, 1];
    const min = Math.min(...vals), max = Math.max(...vals);
    const pad = Math.max(0.1, (max - min) * 0.15);
    return [Number((min - pad).toFixed(2)), Number((max + pad).toFixed(2))];
  }, [data, activeGoal]);

  if (!dogId) return <Card className="mt-2 text-sm text-ink-soft">강아지를 먼저 등록하세요.</Card>;

  return (
    <div className="flex flex-col gap-4 pb-2 pt-1">
      <Card>
        <SectionTitle>📊 체중 추이</SectionTitle>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-soft">아직 기록이 없어요.<br />오늘 탭에서 체중을 입력해보세요.</p>
        ) : (
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <XAxis dataKey="date" fontSize={11} stroke="#8b8a94" tickLine={false} axisLine={false} />
                <YAxis domain={yDomain} fontSize={11} width={40} stroke="#8b8a94" tickLine={false} axisLine={false} allowDecimals />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #efedf2", fontSize: 12 }} />
                {activeGoal && <ReferenceLine y={Number(activeGoal.targetKg)} stroke="#3ec9a7" strokeDasharray="5 5" label={{ value: "목표", fontSize: 11, fill: "#3ec9a7" }} />}
                <Line type="monotone" dataKey="kg" stroke="#ff7a5c" strokeWidth={2.5} dot={{ r: 3, fill: "#ff7a5c" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>🎯 목표 체중</SectionTitle>
        <div className="rounded-xl bg-cat-food-bg px-3.5 py-3 text-sm font-semibold text-cat-food">
          현재 목표 {activeGoal ? `${activeGoal.targetKg}kg` : "미설정"}
        </div>
        <GoalForm onAdd={(b) => setGoal.mutate(b)} />
      </Card>

      <Card>
        <SectionTitle>기록 목록</SectionTitle>
        {!logs?.length ? (
          <p className="py-3 text-center text-sm text-ink-soft">기록이 없어요.</p>
        ) : (
          <div className="flex flex-col">
            {logs.map((l, i) => ({ log: l, prevKg: i > 0 ? Number(logs[i - 1].weightKg) : null }))
              .reverse()
              .map(({ log, prevKg }) => <WeightRow key={log.id} log={log} prevKg={prevKg} dogId={dogId} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

function GoalForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [targetKg, setTargetKg] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="mt-3 flex gap-2">
      <Input type="number" step="0.01" placeholder="목표 kg" value={targetKg} onChange={(e) => setTargetKg(e.target.value)} />
      <Button onClick={() => { if (targetKg) { onAdd({ targetKg, effectiveFrom: today }); setTargetKg(""); } }}>설정</Button>
    </div>
  );
}
