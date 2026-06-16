import type { Express } from "express";
import { authRouter } from "./auth.routes";

export function registerRoutes(app: Express) {
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
}
