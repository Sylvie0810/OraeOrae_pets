import type { Express } from "express";
import express from "express";
import path from "path";
import fs from "fs";

export function serveStatic(app: Express) {
  const dist = path.resolve(import.meta.dirname, "public");
  app.use(express.static(dist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    const index = path.join(dist, "index.html");
    if (fs.existsSync(index)) return res.sendFile(index);
    next();
  });
}
