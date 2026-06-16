import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Select, Card, SectionTitle } from "@/components/ui";
import type { Expense } from "@shared/schema";

const CATEGORIES = [
  { v: "food", l: "사료" }, { v: "treat", l: "간식" }, { v: "toy", l: "장난감" },
  { v: "hospital", l: "병원" }, { v: "clothing", l: "옷" }, { v: "grooming", l: "미용" }, { v: "etc", l: "기타" },
];
const COLORS = ["#5b9bf3", "#3ec9a7", "#a78bfa", "#34d2c4", "#ff8fb1", "#fb9d4b", "#8b8a94"];

export default function Expenses() {
  const { data: list } = useQuery({ queryKey: ["expenses"], queryFn: () => api<Expense[]>("/api/expenses") });
  const { data: summary } = useQuery({ queryKey: ["expense-summary"], queryFn: () => api<{ category: string; total: string }[]>("/api/expenses/summary") });
  const add = useMutation({
    mutationFn: (b: any) => api("/api/expenses", { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expenses"] }); queryClient.invalidateQueries({ queryKey: ["expense-summary"] }); },
  });

  const pie = (summary ?? []).map((s) => ({ name: CATEGORIES.find((c) => c.v === s.category)?.l ?? s.category, value: Number(s.total) }));
  const total = pie.reduce((a, b) => a + b.value, 0);

  return (
    <div className="flex flex-col gap-4 pb-2 pt-1">
      <Card>
        <SectionTitle>💰 카테고리별 지출</SectionTitle>
        {pie.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-soft">아직 지출 기록이 없어요.</p>
        ) : (
          <>
            <div className="mb-1 text-center">
              <div className="text-xs text-ink-soft">이번까지 총 지출</div>
              <div className="text-2xl font-bold text-ink">{total.toLocaleString()}원</div>
            </div>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={2} stroke="none">
                    {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>지출 추가</SectionTitle>
        <ExpenseForm onAdd={(b) => add.mutate(b)} />
      </Card>

      <Card>
        <SectionTitle>지출 내역</SectionTitle>
        {!list?.length ? (
          <p className="py-4 text-center text-sm text-ink-soft">기록이 없어요.</p>
        ) : (
          <ul className="flex flex-col">
            {list.map((e) => (
              <li key={e.id} className="flex items-center justify-between border-b border-line py-2.5 last:border-0">
                <span className="text-sm text-ink">
                  <span className="mr-2 rounded-md bg-canvas px-2 py-0.5 text-xs text-ink-soft">{e.date.slice(5)}</span>
                  {CATEGORIES.find((c) => c.v === e.category)?.l} {e.vendor ?? ""}
                </span>
                <span className="font-semibold text-ink">{Number(e.amount).toLocaleString()}원</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ExpenseForm({ onAdd }: { onAdd: (b: any) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [category, setCategory] = useState("food");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [brand, setBrand] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <Select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}</Select>
      <Input type="number" placeholder="금액" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div className="flex gap-2">
        <Input placeholder="구매처" value={vendor} onChange={(e) => setVendor(e.target.value)} />
        <Input placeholder="브랜드" value={brand} onChange={(e) => setBrand(e.target.value)} />
      </div>
      <Button onClick={() => { if (amount) { onAdd({ category, amount, vendor, brand, date: today }); setAmount(""); setVendor(""); setBrand(""); } }} className="mt-1">지출 추가</Button>
    </div>
  );
}
