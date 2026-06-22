import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Select, Card, SectionTitle } from "@/components/ui";
import { AutocompleteInput } from "@/components/AutocompleteInput";
import { Modal } from "@/components/Modal";
import { ReceiptScanButton, type ReceiptResult } from "@/components/ReceiptScanButton";
import type { Expense } from "@shared/schema";

const CATEGORIES = [
  { v: "food", l: "사료" }, { v: "treat", l: "간식" }, { v: "toy", l: "장난감" },
  { v: "hospital", l: "병원" }, { v: "clothing", l: "옷" }, { v: "grooming", l: "미용" }, { v: "etc", l: "기타" },
];
const COLORS = ["#5b9bf3", "#3ec9a7", "#a78bfa", "#34d2c4", "#ff8fb1", "#fb9d4b", "#8b8a94"];
const catLabel = (v: string) => CATEGORIES.find((c) => c.v === v)?.l ?? v;
const won = (n: number) => `${n.toLocaleString()}원`;

function invalidateExpenses() {
  queryClient.invalidateQueries({ queryKey: ["expenses"] });
  queryClient.invalidateQueries({ queryKey: ["expense-summary"] });
}

export default function Expenses() {
  const { data: list } = useQuery({ queryKey: ["expenses"], queryFn: () => api<Expense[]>("/api/expenses") });
  const del = useMutation({ mutationFn: (id: number) => api(`/api/expenses/${id}`, { method: "DELETE" }), onSuccess: invalidateExpenses });
  const [editing, setEditing] = useState<Expense | "new" | null>(null);

  // analysis derived entirely from the full expense list (req 8)
  const months = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of list ?? []) {
      const key = e.date.slice(0, 7); // YYYY-MM
      m.set(key, (m.get(key) ?? 0) + Number(e.amount));
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, total]) => ({ month: month.slice(2), total }));
  }, [list]);

  const [selMonth, setSelMonth] = useState<string>("all"); // 'all' or 'YY-MM'
  const filtered = useMemo(() => (list ?? []).filter((e) => selMonth === "all" || e.date.slice(2, 7) === selMonth), [list, selMonth]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filtered) m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([cat, total]) => ({ cat, name: catLabel(cat), value: total }));
  }, [filtered]);
  const total = byCategory.reduce((a, b) => a + b.value, 0);
  const topCat = byCategory[0];

  return (
    <div className="flex flex-col gap-4 pb-2 pt-1">
      {/* monthly trend */}
      <Card>
        <SectionTitle action={<button onClick={() => setEditing("new")} className="text-sm font-semibold text-brand">+ 추가</button>}>💰 월별 지출 추이</SectionTitle>
        {months.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-soft">아직 지출 기록이 없어요.</p>
        ) : (
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={months} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <XAxis dataKey="month" fontSize={11} stroke="#8b8a94" tickLine={false} axisLine={false} />
                <YAxis fontSize={10} width={44} stroke="#8b8a94" tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: any) => won(Number(v))} contentStyle={{ borderRadius: 12, border: "1px solid #efedf2", fontSize: 12 }} />
                <Bar dataKey="total" fill="#ff7a5c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* category breakdown (filterable by month) */}
      {byCategory.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">항목별 지출</h3>
            <Select value={selMonth} onChange={(e) => setSelMonth(e.target.value)} className="w-32">
              <option value="all">전체</option>
              {months.map((m) => <option key={m.month} value={m.month}>{m.month}</option>)}
            </Select>
          </div>
          <div className="mb-2 text-center">
            <div className="text-xs text-ink-soft">{selMonth === "all" ? "전체" : selMonth} 지출</div>
            <div className="text-2xl font-bold text-ink">{won(total)}</div>
          </div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={46} outerRadius={78} paddingAngle={2} stroke="none">
                  {byCategory.map((d) => <Cell key={d.cat} fill={COLORS[CATEGORIES.findIndex((c) => c.v === d.cat) % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => won(Number(v))} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {topCat && (
            <div className="mt-2 rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm text-ink">
              가장 많이 쓴 항목은 <b>{topCat.name}</b> — {won(topCat.value)} ({Math.round((topCat.value / total) * 100)}%)
            </div>
          )}
        </Card>
      )}

      {/* list */}
      <Card>
        <SectionTitle>지출 내역</SectionTitle>
        {!filtered.length ? (
          <p className="py-4 text-center text-sm text-ink-soft">기록이 없어요.</p>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 border-b border-line py-2.5 last:border-0">
                {e.receiptUrl && (
                  <a href={e.receiptUrl} target="_blank" rel="noreferrer">
                    <img src={e.receiptUrl} alt="영수증" className="h-10 w-10 rounded-md border border-line object-cover" />
                  </a>
                )}
                <div className="flex-1">
                  <div className="text-sm text-ink">
                    <span className="mr-2 rounded-md bg-canvas px-2 py-0.5 text-xs text-ink-soft">{e.date.slice(5)}</span>
                    {catLabel(e.category)} {e.vendor ?? ""}
                  </div>
                  {e.note && <div className="mt-0.5 pl-1 text-xs text-ink-soft">📝 {e.note}</div>}
                </div>
                <span className="font-semibold text-ink">{won(Number(e.amount))}</span>
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
  const [note, setNote] = useState(expense?.note ?? "");
  const [date, setDate] = useState(expense?.date ?? today);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(expense?.receiptUrl ?? null);

  const save = useMutation({
    mutationFn: (body: any) =>
      expense
        ? api(`/api/expenses/${expense.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : api("/api/expenses", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { invalidateExpenses(); onDone(); },
  });

  // OCR result -> auto-fill the form (user reviews before saving)
  function applyScan(r: ReceiptResult) {
    setReceiptUrl(r.receiptUrl);
    const x = r.extracted;
    if (x.amount != null) setAmount(String(x.amount));
    if (x.vendor) setVendor(x.vendor);
    if (x.date) setDate(x.date);
    if (x.category) setCategory(x.category);
    if (x.items) setNote((prev) => prev || x.items!);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* req 8: receipt OCR — only when adding a new expense */}
      {!expense && <ReceiptScanButton onResult={applyScan} />}
      {receiptUrl && (
        <a href={receiptUrl} target="_blank" rel="noreferrer" className="self-start">
          <img src={receiptUrl} alt="영수증" className="h-20 rounded-lg border border-line object-cover" />
        </a>
      )}
      <Select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}</Select>
      <Input type="number" placeholder="금액" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div className="flex gap-2">
        <AutocompleteInput value={vendor} onChange={setVendor} placeholder="구매처 (저장됨)" suggestUrl="/api/expenses/suggestions?field=vendor" queryKey={["expense-vendor-suggestions"]} />
        <AutocompleteInput value={brand} onChange={setBrand} placeholder="브랜드 (저장됨)" suggestUrl="/api/expenses/suggestions?field=brand" queryKey={["expense-brand-suggestions"]} />
      </div>
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="메모 (선택) — 예: 정기검진, 사료 대용량"
        rows={2}
        className="w-full resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
      <Button onClick={() => { if (amount) save.mutate({ category, amount, vendor, brand, note: note || null, date, receiptUrl: receiptUrl || null }); }} className="mt-1">
        {expense ? "저장" : "지출 추가"}
      </Button>
    </div>
  );
}
