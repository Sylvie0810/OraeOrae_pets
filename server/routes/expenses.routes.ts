import { Router } from "express";
import { and, eq, desc, sql, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { expenses, insertExpenseSchema } from "@shared/schema";
import { requireAuth, type AuthedRequest } from "../auth";

export const expensesRouter = Router();
expensesRouter.use(requireAuth);

expensesRouter.get("/", async (req: AuthedRequest, res) => {
  const rows = await db.select().from(expenses).where(eq(expenses.userId, req.userId!)).orderBy(desc(expenses.date));
  res.json(rows);
});

// distinct past vendors / brands for autocomplete (?field=vendor|brand)
expensesRouter.get("/suggestions", async (req: AuthedRequest, res) => {
  const field = req.query.field === "brand" ? expenses.brand : expenses.vendor;
  const rows = await db
    .select({ value: field })
    .from(expenses)
    .where(and(eq(expenses.userId, req.userId!), isNotNull(field)))
    .groupBy(field)
    .orderBy(desc(sql`max(${expenses.createdAt})`))
    .limit(20);
  res.json(rows.map((r) => r.value).filter(Boolean));
});

expensesRouter.get("/summary", async (req: AuthedRequest, res) => {
  const rows = await db
    .select({ category: expenses.category, total: sql<string>`sum(${expenses.amount})` })
    .from(expenses)
    .where(eq(expenses.userId, req.userId!))
    .groupBy(expenses.category);
  res.json(rows);
});

expensesRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = insertExpenseSchema.safeParse({ ...req.body, userId: req.userId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.insert(expenses).values(parsed.data).returning();
  res.json(row);
});

expensesRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const owned = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, req.userId!)));
  if (!owned.length) return res.status(404).json({ error: "not found" });
  const parsed = insertExpenseSchema.partial().omit({ userId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.update(expenses).set(parsed.data).where(and(eq(expenses.id, id), eq(expenses.userId, req.userId!))).returning();
  res.json(row);
});

expensesRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, req.userId!)));
  res.json({ ok: true });
});
