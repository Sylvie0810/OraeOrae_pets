import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import { useDog } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Card, SectionTitle } from "@/components/ui";
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
                <YAxis domain={["auto", "auto"]} fontSize={11} width={40} stroke="#8b8a94" tickLine={false} axisLine={false} />
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
