import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import { useDog } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Card } from "@/components/ui";
import type { WeightLog, WeightGoal } from "@shared/schema";

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

  if (!dogId) return <div>강아지를 먼저 등록하세요.</div>;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mb-2 font-semibold">📊 체중 추이</h3>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <XAxis dataKey="date" fontSize={11} />
              <YAxis domain={["auto", "auto"]} fontSize={11} width={32} />
              <Tooltip />
              {activeGoal && <ReferenceLine y={Number(activeGoal.targetKg)} stroke="#10b981" strokeDasharray="4 4" label="목표" />}
              <Line type="monotone" dataKey="kg" stroke="#0f172a" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">🎯 목표 체중</h3>
        <div className="text-sm text-slate-600">현재 목표: {activeGoal ? `${activeGoal.targetKg}kg` : "미설정"}</div>
        <GoalForm onAdd={(b) => setGoal.mutate(b)} />
      </Card>
    </div>
  );
}

function GoalForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [targetKg, setTargetKg] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="mt-2 flex gap-2">
      <Input type="number" step="0.01" placeholder="목표 kg" value={targetKg} onChange={(e) => setTargetKg(e.target.value)} />
      <Button onClick={() => { if (targetKg) { onAdd({ targetKg, effectiveFrom: today }); setTargetKg(""); } }}>설정</Button>
    </div>
  );
}
