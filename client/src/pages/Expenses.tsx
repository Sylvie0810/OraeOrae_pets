import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Select, Card, SectionTitle } from "@/components/ui";
import { AutocompleteInput } from "@/components/AutocompleteInput";
import { Modal } from "@/components/Modal";
import type { Expense } from "@shared/schema";

const CATEGORIES = [
  { v: "food", l: "사료" }, { v: "treat", l: "간식" }, { v: "toy", l: "장난감" },
  { v: "hospital", l: "병원" }, { v: "clothing", l: "옷" }, { v: "grooming", l: "미용" }, { v: "etc", l: "기타" },
];
const COLORS = ["#5b9bf3", "#3ec9a7", "#a78bfa", "#34d2c4", "#ff8fb1", "#fb9d4b", "#8b8a94"];
const catLabel = (v: string) => CATEGORIES.find((c) => c.v === v)?.l ?? v;

function invalidateExpenses() {
  queryClient.invalidateQueries({ queryKey: ["expenses"] });
  queryClient.invalidateQueries({ queryKey: ["expense-summary"] });
}

export default function Expenses() {
  const { data: list } = useQuery({ queryKey: ["expenses"], queryFn: () => api<Expense[]>("/api/expenses") });
  const { data: summary } = useQuery({ queryKey: ["expense-summary"], queryFn: () => api<{ category: string; total: string }[]>("/api/expenses/summary") });
  const del = useMutation({ mutationFn: (id: number) => api(`/api/expenses/${id}`, { method: "DELETE" }), onSuccess: invalidateExpenses });

  // null = closed, "new" = add, Expense = edit
  const [editing, setEditing] = useState<Expense | "new" | null>(null);

  const pie = (summary ?? []).map((s) => ({ name: catLabel(s.category), value: Number(s.total) }));
  const total = pie.reduce((a, b) => a + b.value, 0);

  return (
    <div className="flex flex-col gap-4 pb-2 pt-1">
      <Card>
        <SectionTitle action={<button onClick={() => setEditing("new")} className="text-sm font-semibold text-brand">+ 추가</button>}>💰 카테고리별 지출</SectionTitle>
        {pie.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-soft">아직 지출 기록이 없어요.</p>
        ) : (
          <>
            <div className="mb-1 text-center">
              <div className="text-xs text-ink-soft">총 지출</div>
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
        <SectionTitle>지출 내역</SectionTitle>
        {!list?.length ? (
          <p className="py-4 text-center text-sm text-ink-soft">기록이 없어요.</p>
        ) : (
          <ul className="flex flex-col">
            {list.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 border-b border-line py-2.5 last:border-0">
                <span className="flex-1 text-sm text-ink">
                  <span className="mr-2 rounded-md bg-canvas px-2 py-0.5 text-xs text-ink-soft">{e.date.slice(5)}</span>
                  {catLabel(e.category)} {e.vendor ?? ""}
                </span>
                <span className="font-semibold text-ink">{Number(e.amount).toLocaleString()}원</span>
                <button onClick={() => setEditing(e)} className="tap text-sm" aria-label="수정">✏️</button>
                <button onClick={() => del.mutate(e.id)} className="tap text-sm" aria-label="삭제">🗑️</button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "지출 추가" : "지출 수정"}>
        {editing !== null && <ExpenseForm expense={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function ExpenseForm({ expense, onDone }: { expense: Expense | null; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [category, setCategory] = useState(expense?.category ?? "food");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [vendor, setVendor] = useState(expense?.vendor ?? "");
  const [brand, setBrand] = useState(expense?.brand ?? "");
  const [date, setDate] = useState(expense?.date ?? today);

  const save = useMutation({
    mutationFn: (body: any) =>
      expense
        ? api(`/api/expenses/${expense.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : api("/api/expenses", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { invalidateExpenses(); onDone(); },
  });

  return (
    <div className="flex flex-col gap-2">
      <Select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}</Select>
      <Input type="number" placeholder="금액" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div className="flex gap-2">
        <AutocompleteInput value={vendor} onChange={setVendor} placeholder="구매처 (저장됨)" suggestUrl="/api/expenses/suggestions?field=vendor" queryKey={["expense-vendor-suggestions"]} />
        <AutocompleteInput value={brand} onChange={setBrand} placeholder="브랜드 (저장됨)" suggestUrl="/api/expenses/suggestions?field=brand" queryKey={["expense-brand-suggestions"]} />
      </div>
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <Button onClick={() => { if (amount) save.mutate({ category, amount, vendor, brand, date }); }} className="mt-1">
        {expense ? "저장" : "지출 추가"}
      </Button>
    </div>
  );
}
