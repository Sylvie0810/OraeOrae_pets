import { Router } from "express";
import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "../db";
import { expenses, insertExpenseSchema } from "@shared/schema";
import { requireAuth, type AuthedRequest } from "../auth";

export const expensesRouter = Router();
expensesRouter.use(requireAuth);

expensesRouter.get("/", async (req: AuthedRequest, res) => {
  const rows = await db.select().from(expenses).where(eq(expenses.userId, req.userId!)).orderBy(desc(expenses.date));
  res.json(rows);
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

expensesRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, req.userId!)));
  res.json({ ok: true });
});
