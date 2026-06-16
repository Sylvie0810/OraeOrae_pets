import type { Express } from "express";
import { authRouter } from "./auth.routes";
import { dogsRouter } from "./dogs.routes";
import { weightsRouter } from "./weights.routes";
import { dailyRouter } from "./daily.routes";
import { expensesRouter } from "./expenses.routes";
import { insightsRouter } from "./insights.routes";
import { uploadRouter } from "./upload.routes";

export function registerRoutes(app: Express) {
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/dogs", dogsRouter);
  app.use("/api/weights", weightsRouter);
  app.use("/api/daily", dailyRouter);
  app.use("/api/expenses", expensesRouter);
  app.use("/api/insights", insightsRouter);
  app.use("/api/upload", uploadRouter);
}
