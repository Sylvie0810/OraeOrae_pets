import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Select, Card } from "@/components/ui";
import type { Expense } from "@shared/schema";

const CATEGORIES = [
  { v: "food", l: "사료" }, { v: "treat", l: "간식" }, { v: "toy", l: "장난감" },
  { v: "hospital", l: "병원" }, { v: "clothing", l: "옷" }, { v: "grooming", l: "미용" }, { v: "etc", l: "기타" },
];
const COLORS = ["#0f172a", "#475569", "#94a3b8", "#f59e0b", "#10b981", "#ef4444", "#a78bfa"];

export default function Expenses() {
  const { data: list } = useQuery({ queryKey: ["expenses"], queryFn: () => api<Expense[]>("/api/expenses") });
  const { data: summary } = useQuery({ queryKey: ["expense-summary"], queryFn: () => api<{ category: string; total: string }[]>("/api/expenses/summary") });
  const add = useMutation({
    mutationFn: (b: any) => api("/api/expenses", { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expenses"] }); queryClient.invalidateQueries({ queryKey: ["expense-summary"] }); },
  });

  const pie = (summary ?? []).map((s) => ({ name: CATEGORIES.find((c) => c.v === s.category)?.l ?? s.category, value: Number(s.total) }));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mb-2 font-semibold">💰 카테고리별 지출</h3>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pie} dataKey="value" nameKey="name" outerRadius={80} label>
                {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card><ExpenseForm onAdd={(b) => add.mutate(b)} /></Card>
      <Card>
        <h3 className="mb-2 font-semibold">지출 내역</h3>
        <ul className="text-sm">{list?.map((e) => <li key={e.id} className="flex justify-between border-b py-1"><span>{e.date.slice(5)} {CATEGORIES.find((c) => c.v === e.category)?.l} {e.vendor ?? ""}</span><span>{Number(e.amount).toLocaleString()}원</span></li>)}</ul>
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
      <Input placeholder="구매처" value={vendor} onChange={(e) => setVendor(e.target.value)} />
      <Input placeholder="브랜드" value={brand} onChange={(e) => setBrand(e.target.value)} />
      <Button onClick={() => { if (amount) { onAdd({ category, amount, vendor, brand, date: today }); setAmount(""); setVendor(""); setBrand(""); } }}>지출 추가</Button>
    </div>
  );
}
