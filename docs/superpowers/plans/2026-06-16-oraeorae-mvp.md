# OraeOrae MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the OraeOrae MVP — a personal dog-care web app for two Pomeranians that records daily weight/food/walk/poop, shows a weight timeline with diet/activity markers, tracks costs, and surfaces AI "actionable insight" cards.

**Architecture:** Monorepo with `client/` (React + Vite SPA), `server/` (Express REST API), `shared/` (Drizzle schema + shared types). PostgreSQL via Drizzle ORM. Express serves the built SPA from `dist/public` in production. AI insights computed by code-side aggregation + Vertex AI (Gemini) interpretation, behind a swappable interface. Deployed to Cloud Run via Cloud Build.

**Tech Stack:** React 18, Vite 5, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), Recharts, Wouter (router), TanStack Query, Express 4, Drizzle ORM + drizzle-kit, PostgreSQL, Zod, bcrypt + JWT (cookie), Vertex AI SDK (`@google-cloud/vertexai`), Vitest (tests), Node 22.

**Conventions (mirror ksleep-app):**
- Vite aliases: `@` → `client/src`, `@shared` → `shared`.
- Drizzle schema lives at `shared/schema.ts`; drizzle-kit `out: ./migrations`.
- Build outputs SPA to `dist/public`; server bundles to `dist/index.mjs`.
- Env: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLOUD_PROJECT`, `VERTEX_LOCATION`, `PORT`.
- Dates stored as `date` (YYYY-MM-DD) in app tz; times as `time` strings.

**Verification baseline:** `npm run check` (tsc) and `npm test` (vitest) must pass after each phase. `npm run dev` serves API+client on one port.

---

## File Structure (decomposition)

```
OraeoOrae/
├── package.json                # scripts: dev, build, check, test, db:push, db:generate
├── tsconfig.json               # paths for @ and @shared
├── vite.config.ts              # react + tailwind plugins, aliases, proxy /api → server
├── drizzle.config.ts
├── Dockerfile
├── cloudbuild.yaml
├── .env.example
├── shared/
│   ├── schema.ts               # 9 Drizzle tables + zod insert schemas
│   └── types.ts                # shared DTOs (InsightCard, AggregatedMetrics, …)
├── server/
│   ├── index.ts                # express app, mounts routes, serves static in prod
│   ├── db.ts                   # drizzle client from DATABASE_URL
│   ├── auth.ts                 # bcrypt hash/verify, JWT sign/verify, requireAuth mw
│   ├── static.ts               # serveStatic for prod, vite middleware for dev
│   ├── routes/
│   │   ├── index.ts            # registerRoutes(app)
│   │   ├── auth.routes.ts      # POST /api/auth/register, /login, /logout, GET /me
│   │   ├── dogs.routes.ts      # CRUD dogs
│   │   ├── weights.routes.ts   # weight logs + goals
│   │   ├── daily.routes.ts     # daily_logs + feeding/walk/poop entries
│   │   ├── expenses.routes.ts  # expenses CRUD + category summary
│   │   └── insights.routes.ts  # GET /api/insights/:dogId
│   └── ai/
│       ├── aggregate.ts        # pure: build AggregatedMetrics from rows
│       ├── insightProvider.ts  # interface InsightProvider
│       └── geminiProvider.ts   # Vertex AI impl
├── client/
│   ├── index.html
│   └── src/
│       ├── main.tsx            # react root + QueryClientProvider + router
│       ├── App.tsx             # route table + auth gate + tab layout
│       ├── index.css           # tailwind
│       ├── lib/
│       │   ├── api.ts          # typed fetch wrapper (credentials: include)
│       │   ├── queryClient.ts  # TanStack Query client
│       │   └── auth.tsx        # useAuth() context + DogContext (selected dog)
│       ├── components/
│       │   ├── TabBar.tsx
│       │   ├── DogSwitcher.tsx
│       │   ├── InsightCard.tsx
│       │   └── ui/             # Button, Input, Card, Select (small primitives)
│       └── pages/
│           ├── Login.tsx
│           ├── Home.tsx        # 🏠 insights + summary
│           ├── Today.tsx       # 📝 daily log all-in-one
│           ├── Weight.tsx      # 📊 timeline chart + goals
│           ├── Expenses.tsx    # 💰 cost analysis
│           └── Settings.tsx    # profile edit, add dog, logout
```

---

## Phase 0: Project scaffolding

### Task 0.1: Initialize package.json and TypeScript

**Files:**
- Create: `package.json`, `tsconfig.json`, `.node-version`, `.env.example`

- [ ] **Step 1: Create `.node-version`**

```
22
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "oraeorae",
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "cross-env NODE_ENV=development tsx watch --clear-screen=false server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.mjs",
    "start": "cross-env NODE_ENV=production node dist/index.mjs",
    "check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@google-cloud/vertexai": "^1.9.0",
    "@tanstack/react-query": "^5.59.0",
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.7",
    "cross-env": "^7.0.3",
    "drizzle-orm": "^0.36.0",
    "drizzle-zod": "^0.5.1",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.13.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.13.0",
    "wouter": "^3.3.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/cookie-parser": "^1.4.7",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.7.0",
    "@types/pg": "^8.11.10",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "drizzle-kit": "^0.28.0",
    "esbuild": "^0.24.0",
    "tailwindcss": "^4.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false,
    "types": ["node", "vitest/globals"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["client/src/*"],
      "@shared/*": ["shared/*"]
    }
  },
  "include": ["client/src", "server", "shared", "vite.config.ts", "drizzle.config.ts"]
}
```

- [ ] **Step 4: Create `.env.example`**

```
DATABASE_URL=postgres://user:pass@localhost:5432/oraeorae
JWT_SECRET=change-me-in-prod
GOOGLE_CLOUD_PROJECT=
VERTEX_LOCATION=us-central1
PORT=5000
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: completes, creates `package-lock.json` and `node_modules/`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json .node-version .env.example
git commit -m "chore: scaffold package.json + tsconfig"
```

### Task 0.2: Vite + Tailwind + Drizzle config

**Files:**
- Create: `vite.config.ts`, `drizzle.config.ts`, `client/index.html`, `client/src/index.css`, `client/src/main.tsx`, `client/src/App.tsx`, `vitest.config.ts`

- [ ] **Step 1: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    proxy: { "/api": "http://localhost:5000" },
  },
});
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { globals: true, environment: "node" },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
});
```

- [ ] **Step 3: Create `drizzle.config.ts`**

```ts
import type { Config } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export default {
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
} satisfies Config;
```

- [ ] **Step 4: Create `client/index.html`**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <title>오래오래</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `client/src/index.css`**

```css
@import "tailwindcss";

:root { font-family: system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif; }
body { margin: 0; background: #f8fafc; color: #0f172a; }
```

- [ ] **Step 6: Create minimal `client/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 7: Create placeholder `client/src/App.tsx`**

```tsx
export default function App() {
  return <div style={{ padding: 24 }}>오래오래 🐾</div>;
}
```

- [ ] **Step 8: Verify typecheck and build**

Run: `npm run check`
Expected: PASS (no type errors).
Run: `npm run build`
Expected: Vite builds `dist/public`, esbuild builds `dist/index.mjs` (server/index.ts won't exist yet — defer build verification to Phase 1; for now just confirm `vite build` succeeds by running `npx vite build`).

- [ ] **Step 9: Commit**

```bash
git add vite.config.ts vitest.config.ts drizzle.config.ts client/
git commit -m "chore: vite + tailwind + drizzle config, client skeleton"
```

---

## Phase 1: Database schema + server boot

### Task 1.1: Drizzle schema (9 tables)

**Files:**
- Create: `shared/schema.ts`
- Test: `shared/schema.test.ts`

- [ ] **Step 1: Write `shared/schema.ts`**

```ts
import { pgTable, serial, integer, text, date, time, numeric, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dogs = pgTable("dogs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  breed: text("breed"),
  birthDate: date("birth_date"),
  sex: text("sex"), // 'male' | 'female'
  neutered: boolean("neutered").default(false),
  registrationNo: text("registration_no"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const weightGoals = pgTable("weight_goals", {
  id: serial("id").primaryKey(),
  dogId: integer("dog_id").notNull().references(() => dogs.id),
  targetKg: numeric("target_kg").notNull(),
  effectiveFrom: date("effective_from").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const weightLogs = pgTable("weight_logs", {
  id: serial("id").primaryKey(),
  dogId: integer("dog_id").notNull().references(() => dogs.id),
  date: date("date").notNull(),
  weightKg: numeric("weight_kg").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailyLogs = pgTable("daily_logs", {
  id: serial("id").primaryKey(),
  dogId: integer("dog_id").notNull().references(() => dogs.id),
  date: date("date").notNull(),
  summaryNote: text("summary_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({ dogDate: unique().on(t.dogId, t.date) }));

export const feedingEntries = pgTable("feeding_entries", {
  id: serial("id").primaryKey(),
  dailyLogId: integer("daily_log_id").notNull().references(() => dailyLogs.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // 'food' | 'treat'
  name: text("name"),
  amountG: numeric("amount_g"),
  fedAt: time("fed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const walkEntries = pgTable("walk_entries", {
  id: serial("id").primaryKey(),
  dailyLogId: integer("daily_log_id").notNull().references(() => dailyLogs.id, { onDelete: "cascade" }),
  slot: text("slot"), // 'morning' | 'afternoon' | 'evening'
  durationMin: integer("duration_min"),
  distanceKm: numeric("distance_km"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const poopEntries = pgTable("poop_entries", {
  id: serial("id").primaryKey(),
  dailyLogId: integer("daily_log_id").notNull().references(() => dailyLogs.id, { onDelete: "cascade" }),
  poopedAt: time("pooped_at"),
  status: text("status"), // 'normal' | 'soft' | 'constipation' | 'diarrhea'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  dogId: integer("dog_id").references(() => dogs.id), // nullable = shared
  date: date("date").notNull(),
  category: text("category").notNull(), // food|treat|toy|hospital|clothing|grooming|etc
  amount: numeric("amount").notNull(),
  vendor: text("vendor"),
  brand: text("brand"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas (zod) — omit server-managed fields
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertDogSchema = createInsertSchema(dogs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWeightGoalSchema = createInsertSchema(weightGoals).omit({ id: true, createdAt: true });
export const insertWeightLogSchema = createInsertSchema(weightLogs).omit({ id: true, createdAt: true });
export const insertDailyLogSchema = createInsertSchema(dailyLogs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFeedingSchema = createInsertSchema(feedingEntries).omit({ id: true, createdAt: true });
export const insertWalkSchema = createInsertSchema(walkEntries).omit({ id: true, createdAt: true });
export const insertPoopSchema = createInsertSchema(poopEntries).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });

export type Dog = typeof dogs.$inferSelect;
export type WeightLog = typeof weightLogs.$inferSelect;
export type WeightGoal = typeof weightGoals.$inferSelect;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type FeedingEntry = typeof feedingEntries.$inferSelect;
export type WalkEntry = typeof walkEntries.$inferSelect;
export type PoopEntry = typeof poopEntries.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
```

- [ ] **Step 2: Write `shared/schema.test.ts`** (sanity: schemas validate)

```ts
import { describe, it, expect } from "vitest";
import { insertDogSchema, insertWeightLogSchema, insertExpenseSchema } from "./schema";

describe("insert schemas", () => {
  it("accepts a valid dog", () => {
    const r = insertDogSchema.safeParse({ userId: 1, name: "레오" });
    expect(r.success).toBe(true);
  });
  it("rejects a dog without name", () => {
    const r = insertDogSchema.safeParse({ userId: 1 });
    expect(r.success).toBe(false);
  });
  it("requires weight fields", () => {
    const r = insertWeightLogSchema.safeParse({ dogId: 1, date: "2026-06-16", weightKg: "3.5" });
    expect(r.success).toBe(true);
  });
  it("requires expense category + amount", () => {
    const r = insertExpenseSchema.safeParse({ userId: 1, date: "2026-06-16", category: "food", amount: "12000" });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: 4 passing.

- [ ] **Step 4: Commit**

```bash
git add shared/schema.ts shared/schema.test.ts
git commit -m "feat: drizzle schema (9 tables) + insert schemas"
```

### Task 1.2: DB client + Express boot + static serving

**Files:**
- Create: `server/db.ts`, `server/static.ts`, `server/index.ts`, `server/routes/index.ts`

- [ ] **Step 1: Create `server/db.ts`**

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

- [ ] **Step 2: Create `server/static.ts`**

```ts
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
```

Note: after esbuild bundles to `dist/index.mjs`, `import.meta.dirname` is `dist/`, so `dist/public` resolves correctly.

- [ ] **Step 3: Create `server/routes/index.ts`** (stub for now)

```ts
import type { Express } from "express";

export function registerRoutes(app: Express) {
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
}
```

- [ ] **Step 4: Create `server/index.ts`**

```ts
import express from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";

const app = express();
app.use(express.json());
app.use(cookieParser());

registerRoutes(app);

if (process.env.NODE_ENV === "production") {
  const { serveStatic } = await import("./static");
  serveStatic(app);
}

const port = Number(process.env.PORT ?? 5000);
app.listen(port, () => console.log(`oraeorae on :${port}`));
```

- [ ] **Step 5: Verify dev boot**

Run: `npm run dev` (background, then curl)
Run: `curl -s http://localhost:5000/api/health`
Expected: `{"ok":true}`. Stop the dev server.

- [ ] **Step 6: Verify production build**

Run: `npm run build`
Expected: builds `dist/public/*` and `dist/index.mjs` with no errors.

- [ ] **Step 7: Commit**

```bash
git add server/
git commit -m "feat: express boot, db client, static serving, health route"
```

---

## Phase 2: Auth (email + JWT cookie)

### Task 2.1: Auth helpers

**Files:**
- Create: `server/auth.ts`
- Test: `server/auth.test.ts`

- [ ] **Step 1: Write `server/auth.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, signToken, verifyToken } from "./auth";

describe("auth helpers", () => {
  it("hashes and verifies a password", async () => {
    const h = await hashPassword("secret123");
    expect(await verifyPassword("secret123", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("signs and verifies a token", () => {
    const t = signToken({ userId: 7 });
    expect(verifyToken(t)?.userId).toBe(7);
    expect(verifyToken("garbage")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test (fails — module missing)**

Run: `npm test -- server/auth.test.ts`
Expected: FAIL (cannot find `./auth`).

- [ ] **Step 3: Write `server/auth.ts`**

```ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const SECRET = process.env.JWT_SECRET ?? "dev-secret";

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}
export function signToken(payload: { userId: number }): string {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}
export function verifyToken(token: string): { userId: number } | null {
  try {
    return jwt.verify(token, SECRET) as { userId: number };
  } catch {
    return null;
  }
}

export interface AuthedRequest extends Request {
  userId?: number;
}
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: "unauthorized" });
  req.userId = payload.userId;
  next();
}
```

- [ ] **Step 4: Run test (passes)**

Run: `npm test -- server/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/auth.ts server/auth.test.ts
git commit -m "feat: auth helpers (bcrypt + jwt) + requireAuth middleware"
```

### Task 2.2: Auth routes

**Files:**
- Create: `server/routes/auth.routes.ts`
- Modify: `server/routes/index.ts`

- [ ] **Step 1: Write `server/routes/auth.routes.ts`**

```ts
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, insertUserSchema } from "@shared/schema";
import { hashPassword, verifyPassword, signToken, requireAuth, type AuthedRequest } from "../auth";
import { z } from "zod";

export const authRouter = Router();

const credentials = z.object({ email: z.string().email(), password: z.string().min(6), name: z.string().min(1).optional() });

function setCookie(res: any, token: string) {
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 30 * 24 * 3600 * 1000 });
}

authRouter.post("/register", async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const { email, password, name } = parsed.data;
  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length) return res.status(409).json({ error: "email taken" });
  const [user] = await db.insert(users).values({ email, passwordHash: await hashPassword(password), name: name ?? email.split("@")[0] }).returning();
  setCookie(res, signToken({ userId: user.id }));
  res.json({ id: user.id, email: user.email, name: user.name });
});

authRouter.post("/login", async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash)))
    return res.status(401).json({ error: "invalid credentials" });
  setCookie(res, signToken({ userId: user.id }));
  res.json({ id: user.id, email: user.email, name: user.name });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.userId!));
  if (!user) return res.status(404).json({ error: "not found" });
  res.json({ id: user.id, email: user.email, name: user.name });
});
```

- [ ] **Step 2: Mount in `server/routes/index.ts`**

```ts
import type { Express } from "express";
import { authRouter } from "./auth.routes";

export function registerRoutes(app: Express) {
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/routes/
git commit -m "feat: auth routes (register/login/logout/me)"
```

---

## Phase 3: Core resource routes (dogs, weights, daily, expenses)

> Pattern for every route file: import `db`, the table, the insert schema, and `requireAuth`. All routes are auth-guarded and scoped by `userId` (for dogs/expenses) or by ownership-of-dog (for weights/daily). Helper `assertDogOwned(userId, dogId)` lives in `server/routes/_helpers.ts`.

### Task 3.1: Ownership helper

**Files:**
- Create: `server/routes/_helpers.ts`
- Test: covered indirectly; add `server/routes/_helpers.test.ts`

- [ ] **Step 1: Write `server/routes/_helpers.ts`**

```ts
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { dogs } from "@shared/schema";

export async function dogOwnedBy(userId: number, dogId: number): Promise<boolean> {
  const rows = await db.select({ id: dogs.id }).from(dogs).where(and(eq(dogs.id, dogId), eq(dogs.userId, userId)));
  return rows.length > 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/_helpers.ts
git commit -m "feat: dogOwnedBy ownership helper"
```

### Task 3.2: Dogs routes

**Files:**
- Create: `server/routes/dogs.routes.ts`
- Modify: `server/routes/index.ts`

- [ ] **Step 1: Write `server/routes/dogs.routes.ts`**

```ts
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { dogs, insertDogSchema } from "@shared/schema";
import { requireAuth, type AuthedRequest } from "../auth";

export const dogsRouter = Router();
dogsRouter.use(requireAuth);

dogsRouter.get("/", async (req: AuthedRequest, res) => {
  const rows = await db.select().from(dogs).where(eq(dogs.userId, req.userId!));
  res.json(rows);
});

dogsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = insertDogSchema.safeParse({ ...req.body, userId: req.userId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [dog] = await db.insert(dogs).values(parsed.data).returning();
  res.json(dog);
});

dogsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const owned = await db.select().from(dogs).where(and(eq(dogs.id, id), eq(dogs.userId, req.userId!)));
  if (!owned.length) return res.status(404).json({ error: "not found" });
  const [dog] = await db.update(dogs).set({ ...req.body, updatedAt: new Date() }).where(eq(dogs.id, id)).returning();
  res.json(dog);
});

dogsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(dogs).where(and(eq(dogs.id, id), eq(dogs.userId, req.userId!)));
  res.json({ ok: true });
});
```

- [ ] **Step 2: Mount `app.use("/api/dogs", dogsRouter)` in `server/routes/index.ts`** (add import + line).

- [ ] **Step 3: Typecheck + commit**

Run: `npm run check` → PASS

```bash
git add server/routes/
git commit -m "feat: dogs CRUD routes"
```

### Task 3.3: Weights routes (logs + goals)

**Files:**
- Create: `server/routes/weights.routes.ts`
- Modify: `server/routes/index.ts`

- [ ] **Step 1: Write `server/routes/weights.routes.ts`**

```ts
import { Router } from "express";
import { and, eq, asc } from "drizzle-orm";
import { db } from "../db";
import { weightLogs, weightGoals, insertWeightLogSchema, insertWeightGoalSchema } from "@shared/schema";
import { requireAuth, type AuthedRequest } from "../auth";
import { dogOwnedBy } from "./_helpers";

export const weightsRouter = Router();
weightsRouter.use(requireAuth);

// GET /api/weights/:dogId  -> logs (asc by date)
weightsRouter.get("/:dogId", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const logs = await db.select().from(weightLogs).where(eq(weightLogs.dogId, dogId)).orderBy(asc(weightLogs.date));
  res.json(logs);
});

weightsRouter.post("/:dogId", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const parsed = insertWeightLogSchema.safeParse({ ...req.body, dogId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [log] = await db.insert(weightLogs).values(parsed.data).returning();
  res.json(log);
});

// goals
weightsRouter.get("/:dogId/goals", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const goals = await db.select().from(weightGoals).where(eq(weightGoals.dogId, dogId)).orderBy(asc(weightGoals.effectiveFrom));
  res.json(goals);
});

weightsRouter.post("/:dogId/goals", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const parsed = insertWeightGoalSchema.safeParse({ ...req.body, dogId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [goal] = await db.insert(weightGoals).values(parsed.data).returning();
  res.json(goal);
});

weightsRouter.delete("/log/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(weightLogs).where(eq(weightLogs.id, id));
  if (!row || !(await dogOwnedBy(req.userId!, row.dogId))) return res.status(404).json({ error: "not found" });
  await db.delete(weightLogs).where(eq(weightLogs.id, id));
  res.json({ ok: true });
});
```

- [ ] **Step 2: Mount `app.use("/api/weights", weightsRouter)`; typecheck; commit.**

```bash
git add server/routes/
git commit -m "feat: weight logs + goals routes"
```

### Task 3.4: Daily log routes (the "drawer")

**Files:**
- Create: `server/routes/daily.routes.ts`
- Modify: `server/routes/index.ts`

> The "오늘" screen needs one call to load a day's drawer with all entries, and calls to add/remove entries. `getOrCreateDailyLog(dogId, date)` ensures the unique (dogId,date) row exists.

- [ ] **Step 1: Write `server/routes/daily.routes.ts`**

```ts
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  dailyLogs, feedingEntries, walkEntries, poopEntries,
  insertFeedingSchema, insertWalkSchema, insertPoopSchema,
} from "@shared/schema";
import { requireAuth, type AuthedRequest } from "../auth";
import { dogOwnedBy } from "./_helpers";

export const dailyRouter = Router();
dailyRouter.use(requireAuth);

async function getOrCreateDailyLog(dogId: number, date: string) {
  const [existing] = await db.select().from(dailyLogs).where(and(eq(dailyLogs.dogId, dogId), eq(dailyLogs.date, date)));
  if (existing) return existing;
  const [created] = await db.insert(dailyLogs).values({ dogId, date }).returning();
  return created;
}

async function loadDrawer(logId: number) {
  const [log] = await db.select().from(dailyLogs).where(eq(dailyLogs.id, logId));
  const feedings = await db.select().from(feedingEntries).where(eq(feedingEntries.dailyLogId, logId));
  const walks = await db.select().from(walkEntries).where(eq(walkEntries.dailyLogId, logId));
  const poops = await db.select().from(poopEntries).where(eq(poopEntries.dailyLogId, logId));
  return { log, feedings, walks, poops };
}

// GET /api/daily/:dogId/:date -> full drawer (creates if absent)
dailyRouter.get("/:dogId/:date", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const log = await getOrCreateDailyLog(dogId, req.params.date);
  res.json(await loadDrawer(log.id));
});

// add entries
dailyRouter.post("/:dogId/:date/feeding", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const log = await getOrCreateDailyLog(dogId, req.params.date);
  const parsed = insertFeedingSchema.safeParse({ ...req.body, dailyLogId: log.id });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.insert(feedingEntries).values(parsed.data).returning();
  res.json(row);
});

dailyRouter.post("/:dogId/:date/walk", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const log = await getOrCreateDailyLog(dogId, req.params.date);
  const parsed = insertWalkSchema.safeParse({ ...req.body, dailyLogId: log.id });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.insert(walkEntries).values(parsed.data).returning();
  res.json(row);
});

dailyRouter.post("/:dogId/:date/poop", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const log = await getOrCreateDailyLog(dogId, req.params.date);
  const parsed = insertPoopSchema.safeParse({ ...req.body, dailyLogId: log.id });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.insert(poopEntries).values(parsed.data).returning();
  res.json(row);
});

// delete entries (verify ownership via daily log -> dog)
async function entryDogId(table: typeof feedingEntries | typeof walkEntries | typeof poopEntries, entryId: number): Promise<number | null> {
  const [entry] = await db.select().from(table as any).where(eq((table as any).id, entryId));
  if (!entry) return null;
  const [log] = await db.select().from(dailyLogs).where(eq(dailyLogs.id, (entry as any).dailyLogId));
  return log?.dogId ?? null;
}

for (const [seg, table] of [["feeding", feedingEntries], ["walk", walkEntries], ["poop", poopEntries]] as const) {
  dailyRouter.delete(`/${seg}/:id`, async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const dogId = await entryDogId(table, id);
    if (dogId === null || !(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
    await db.delete(table as any).where(eq((table as any).id, id));
    res.json({ ok: true });
  });
}
```

- [ ] **Step 2: Mount `app.use("/api/daily", dailyRouter)`; typecheck; commit.**

```bash
git add server/routes/
git commit -m "feat: daily log drawer routes (feeding/walk/poop)"
```

### Task 3.5: Expenses routes

**Files:**
- Create: `server/routes/expenses.routes.ts`
- Modify: `server/routes/index.ts`

- [ ] **Step 1: Write `server/routes/expenses.routes.ts`**

```ts
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
```

- [ ] **Step 2: Mount `app.use("/api/expenses", expensesRouter)`; typecheck; commit.**

```bash
git add server/routes/
git commit -m "feat: expenses routes + category summary"
```

---

## Phase 4: AI insights (aggregate in code, interpret with Gemini)

### Task 4.1: Aggregation (pure, tested)

**Files:**
- Create: `shared/types.ts`, `server/ai/aggregate.ts`
- Test: `server/ai/aggregate.test.ts`

- [ ] **Step 1: Write `shared/types.ts`**

```ts
export interface AggregatedMetrics {
  dogName: string;
  todayWeightKg: number | null;
  targetKg: number | null;
  gapKg: number | null;          // today - target
  trend7d: "up" | "down" | "flat" | "unknown";
  avgFoodG7d: number | null;
  walkCount7d: number;
  walkMinutes7d: number;
  abnormalPoop7d: number;        // soft+constipation+diarrhea count
  daysOfData: number;
}

export interface InsightCard {
  severity: "red" | "yellow" | "green";
  title: string;
  evidence: string;
  recommendedAction: string;
  disclaimer?: string;
}
```

- [ ] **Step 2: Write `server/ai/aggregate.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { aggregate } from "./aggregate";

const base = {
  dogName: "레오",
  weightLogs: [
    { date: "2026-06-10", weightKg: "3.4" },
    { date: "2026-06-16", weightKg: "3.6" },
  ],
  goals: [{ effectiveFrom: "2026-06-01", targetKg: "3.3" }],
  feedings: [{ amountG: "60", dailyDate: "2026-06-16" }, { amountG: "70", dailyDate: "2026-06-15" }],
  walks: [{ durationMin: 20, dailyDate: "2026-06-16" }],
  poops: [{ status: "soft", dailyDate: "2026-06-16" }, { status: "normal", dailyDate: "2026-06-15" }],
};

describe("aggregate", () => {
  it("computes gap and trend", () => {
    const m = aggregate(base as any, "2026-06-16");
    expect(m.todayWeightKg).toBe(3.6);
    expect(m.targetKg).toBe(3.3);
    expect(m.gapKg).toBeCloseTo(0.3, 5);
    expect(m.trend7d).toBe("up");
  });
  it("counts abnormal poop and walks", () => {
    const m = aggregate(base as any, "2026-06-16");
    expect(m.abnormalPoop7d).toBe(1);
    expect(m.walkCount7d).toBe(1);
    expect(m.walkMinutes7d).toBe(20);
  });
  it("reports unknown trend with insufficient data", () => {
    const m = aggregate({ ...base, weightLogs: [] } as any, "2026-06-16");
    expect(m.todayWeightKg).toBeNull();
    expect(m.trend7d).toBe("unknown");
  });
});
```

- [ ] **Step 3: Run (fails)** → `npm test -- server/ai/aggregate.test.ts` → FAIL.

- [ ] **Step 4: Write `server/ai/aggregate.ts`**

```ts
import type { AggregatedMetrics } from "@shared/types";

interface Row { [k: string]: any }
interface Input {
  dogName: string;
  weightLogs: Row[]; // {date, weightKg}
  goals: Row[];      // {effectiveFrom, targetKg}
  feedings: Row[];   // {amountG, dailyDate}
  walks: Row[];      // {durationMin, dailyDate}
  poops: Row[];      // {status, dailyDate}
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

export function aggregate(input: Input, today: string): AggregatedMetrics {
  const sorted = [...input.weightLogs].sort((a, b) => a.date.localeCompare(b.date));
  const todayWeightKg = sorted.length ? Number(sorted[sorted.length - 1].weightKg) : null;

  // active goal = latest goal with effectiveFrom <= today
  const activeGoal = [...input.goals]
    .filter((g) => g.effectiveFrom <= today)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
    .pop();
  const targetKg = activeGoal ? Number(activeGoal.targetKg) : null;
  const gapKg = todayWeightKg !== null && targetKg !== null ? Number((todayWeightKg - targetKg).toFixed(3)) : null;

  // trend: compare latest vs earliest within 7d window
  const within7 = sorted.filter((w) => daysBetween(w.date, today) <= 7 && daysBetween(w.date, today) >= 0);
  let trend7d: AggregatedMetrics["trend7d"] = "unknown";
  if (within7.length >= 2) {
    const first = Number(within7[0].weightKg);
    const last = Number(within7[within7.length - 1].weightKg);
    const delta = last - first;
    trend7d = Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "up" : "down";
  } else if (sorted.length >= 2) {
    const delta = Number(sorted[sorted.length - 1].weightKg) - Number(sorted[sorted.length - 2].weightKg);
    trend7d = Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "up" : "down";
  }

  const inWindow = (d: string) => daysBetween(d, today) <= 7 && daysBetween(d, today) >= 0;
  const foods = input.feedings.filter((f) => inWindow(f.dailyDate) && f.amountG != null).map((f) => Number(f.amountG));
  const avgFoodG7d = foods.length ? Number((foods.reduce((a, b) => a + b, 0) / foods.length).toFixed(1)) : null;

  const walks = input.walks.filter((w) => inWindow(w.dailyDate));
  const walkCount7d = walks.length;
  const walkMinutes7d = walks.reduce((a, w) => a + (w.durationMin ?? 0), 0);

  const abnormalPoop7d = input.poops.filter((p) => inWindow(p.dailyDate) && p.status && p.status !== "normal").length;

  const dates = new Set([
    ...input.weightLogs.map((w) => w.date),
    ...input.feedings.map((f) => f.dailyDate),
    ...input.walks.map((w) => w.dailyDate),
    ...input.poops.map((p) => p.dailyDate),
  ]);

  return {
    dogName: input.dogName,
    todayWeightKg,
    targetKg,
    gapKg,
    trend7d,
    avgFoodG7d,
    walkCount7d,
    walkMinutes7d,
    abnormalPoop7d,
    daysOfData: dates.size,
  };
}
```

- [ ] **Step 5: Run (passes)** → `npm test -- server/ai/aggregate.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/types.ts server/ai/aggregate.ts server/ai/aggregate.test.ts
git commit -m "feat: metrics aggregation (pure + tested)"
```

### Task 4.2: Insight provider interface + rule fallback + Gemini

**Files:**
- Create: `server/ai/insightProvider.ts`, `server/ai/ruleProvider.ts`, `server/ai/geminiProvider.ts`
- Test: `server/ai/ruleProvider.test.ts`

- [ ] **Step 1: Write `server/ai/insightProvider.ts`**

```ts
import type { AggregatedMetrics, InsightCard } from "@shared/types";

export interface InsightProvider {
  generate(metrics: AggregatedMetrics, context: { breed?: string; ageYears?: number; conditions?: string[] }): Promise<InsightCard[]>;
}
```

- [ ] **Step 2: Write `server/ai/ruleProvider.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { RuleProvider } from "./ruleProvider";

const provider = new RuleProvider();

describe("RuleProvider", () => {
  it("stays silent with insufficient data", async () => {
    const cards = await provider.generate({ daysOfData: 2 } as any, {});
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toContain("데이터");
  });
  it("flags overweight + high food as red", async () => {
    const cards = await provider.generate(
      { dogName: "레오", daysOfData: 7, gapKg: 0.3, trend7d: "up", avgFoodG7d: 70, walkCount7d: 1, abnormalPoop7d: 0 } as any,
      {}
    );
    expect(cards.some((c) => c.severity === "red")).toBe(true);
  });
  it("congratulates on-target as green", async () => {
    const cards = await provider.generate(
      { dogName: "레오", daysOfData: 14, gapKg: 0.0, trend7d: "flat", avgFoodG7d: 60, walkCount7d: 7, abnormalPoop7d: 0 } as any,
      {}
    );
    expect(cards.some((c) => c.severity === "green")).toBe(true);
  });
});
```

- [ ] **Step 3: Run (fails).**

- [ ] **Step 4: Write `server/ai/ruleProvider.ts`** (deterministic fallback; also used when no GCP project configured)

```ts
import type { AggregatedMetrics, InsightCard } from "@shared/types";
import type { InsightProvider } from "./insightProvider";

export class RuleProvider implements InsightProvider {
  async generate(m: AggregatedMetrics): Promise<InsightCard[]> {
    if (m.daysOfData < 3) {
      return [{ severity: "yellow", title: "데이터가 더 필요해요", evidence: `기록 ${m.daysOfData}일`, recommendedAction: "며칠 더 기록하면 분석을 시작할게요." }];
    }
    const cards: InsightCard[] = [];
    if (m.gapKg !== null && m.gapKg > 0.15) {
      cards.push({
        severity: "red",
        title: `${m.dogName}, 목표보다 +${m.gapKg.toFixed(2)}kg`,
        evidence: `7일 추세 ${m.trend7d}, 사료 평균 ${m.avgFoodG7d ?? "?"}g, 산책 ${m.walkCount7d}회`,
        recommendedAction: m.avgFoodG7d && m.avgFoodG7d > 60 ? "사료를 하루 5g 줄여보세요." : "산책 횟수를 늘려보세요.",
      });
    } else if (m.gapKg !== null && Math.abs(m.gapKg) <= 0.15 && m.trend7d === "flat") {
      cards.push({
        severity: "green",
        title: `${m.dogName}, 목표 구간 유지 중`,
        evidence: `목표 대비 ${m.gapKg.toFixed(2)}kg, 추세 안정`,
        recommendedAction: "현재 루틴을 그대로 유지하세요.",
      });
    }
    if (m.walkCount7d === 0) {
      cards.push({ severity: "yellow", title: `${m.dogName}, 최근 산책 기록 없음`, evidence: "7일간 산책 0회", recommendedAction: "가벼운 산책부터 시작해보세요." });
    }
    if (m.abnormalPoop7d >= 2) {
      cards.push({ severity: "yellow", title: `${m.dogName}, 배변 상태 주의`, evidence: `7일간 비정상 배변 ${m.abnormalPoop7d}회`, recommendedAction: "사료/간식 변화를 점검하고 지속되면 수의사와 상담하세요.", disclaimer: "참고용이며 수의사 상담을 대체하지 않습니다." });
    }
    if (!cards.length) cards.push({ severity: "green", title: `${m.dogName}, 특이사항 없음`, evidence: "주요 지표 정상 범위", recommendedAction: "지금처럼 유지하세요." });
    return cards;
  }
}
```

- [ ] **Step 5: Run (passes); commit.**

```bash
git add server/ai/insightProvider.ts server/ai/ruleProvider.ts server/ai/ruleProvider.test.ts
git commit -m "feat: insight provider interface + rule fallback"
```

- [ ] **Step 6: Write `server/ai/geminiProvider.ts`** (used when `GOOGLE_CLOUD_PROJECT` set; falls back to RuleProvider on error)

```ts
import { VertexAI } from "@google-cloud/vertexai";
import type { AggregatedMetrics, InsightCard } from "@shared/types";
import type { InsightProvider } from "./insightProvider";
import { RuleProvider } from "./ruleProvider";

const SYSTEM = `너는 반려견 건강 코치다. 주어진 '정확히 계산된' 지표만 근거로 한국어 인사이트 카드를 만든다.
- 숫자를 새로 계산하지 말고 주어진 값만 인용한다.
- 약물/질환 관련이면 disclaimer에 "참고용이며 수의사 상담을 대체하지 않습니다"를 넣는다.
- 출력은 JSON 배열. 각 항목: {severity:"red"|"yellow"|"green", title, evidence, recommendedAction, disclaimer?}. 1~4개.`;

export class GeminiProvider implements InsightProvider {
  private fallback = new RuleProvider();
  async generate(m: AggregatedMetrics, ctx: { breed?: string; ageYears?: number; conditions?: string[] }): Promise<InsightCard[]> {
    if (m.daysOfData < 3) return this.fallback.generate(m, ctx);
    try {
      const vertex = new VertexAI({ project: process.env.GOOGLE_CLOUD_PROJECT!, location: process.env.VERTEX_LOCATION ?? "us-central1" });
      const model = vertex.getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction: SYSTEM });
      const prompt = `지표:\n${JSON.stringify(m, null, 2)}\n맥락:\n${JSON.stringify(ctx)}`;
      const resp = await model.generateContent(prompt);
      const text = resp.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
      const json = text.replace(/```json|```/g, "").trim();
      const cards = JSON.parse(json) as InsightCard[];
      if (Array.isArray(cards) && cards.length) return cards;
      return this.fallback.generate(m, ctx);
    } catch (e) {
      console.error("gemini insight failed, using fallback:", e);
      return this.fallback.generate(m, ctx);
    }
  }
}

export function getInsightProvider(): InsightProvider {
  return process.env.GOOGLE_CLOUD_PROJECT ? new GeminiProvider() : new RuleProvider();
}
```

- [ ] **Step 7: Typecheck + commit.**

```bash
git add server/ai/geminiProvider.ts
git commit -m "feat: gemini insight provider (vertex) with rule fallback"
```

### Task 4.3: Insights route

**Files:**
- Create: `server/routes/insights.routes.ts`
- Modify: `server/routes/index.ts`

- [ ] **Step 1: Write `server/routes/insights.routes.ts`**

```ts
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { dogs, weightLogs, weightGoals, dailyLogs, feedingEntries, walkEntries, poopEntries } from "@shared/schema";
import { requireAuth, type AuthedRequest } from "../auth";
import { dogOwnedBy } from "./_helpers";
import { aggregate } from "../ai/aggregate";
import { getInsightProvider } from "../ai/geminiProvider";

export const insightsRouter = Router();
insightsRouter.use(requireAuth);

insightsRouter.get("/:dogId", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const today = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);

  const [dog] = await db.select().from(dogs).where(eq(dogs.id, dogId));
  const wLogs = await db.select().from(weightLogs).where(eq(weightLogs.dogId, dogId));
  const goals = await db.select().from(weightGoals).where(eq(weightGoals.dogId, dogId));
  const logs = await db.select().from(dailyLogs).where(eq(dailyLogs.dogId, dogId));
  const logIds = logs.map((l) => l.id);
  const dateById = new Map(logs.map((l) => [l.id, l.date]));

  const feedings = logIds.length ? await db.select().from(feedingEntries) : [];
  const walks = logIds.length ? await db.select().from(walkEntries) : [];
  const poops = logIds.length ? await db.select().from(poopEntries) : [];
  const withDate = (rows: any[]) => rows.filter((r) => dateById.has(r.dailyLogId)).map((r) => ({ ...r, dailyDate: dateById.get(r.dailyLogId) }));

  const metrics = aggregate({
    dogName: dog.name,
    weightLogs: wLogs,
    goals,
    feedings: withDate(feedings),
    walks: withDate(walks),
    poops: withDate(poops),
  } as any, today);

  const ageYears = dog.birthDate ? Math.floor((Date.now() - Date.parse(dog.birthDate)) / (365.25 * 86400000)) : undefined;
  const cards = await getInsightProvider().generate(metrics, { breed: dog.breed ?? undefined, ageYears });
  res.json({ metrics, cards });
});
```

- [ ] **Step 2: Mount `app.use("/api/insights", insightsRouter)`; typecheck; commit.**

```bash
git add server/routes/
git commit -m "feat: insights route (aggregate + provider)"
```

---

## Phase 5: Frontend — shell, auth, data hooks

### Task 5.1: API client + query client + auth/dog context

**Files:**
- Create: `client/src/lib/api.ts`, `client/src/lib/queryClient.ts`, `client/src/lib/auth.tsx`

- [ ] **Step 1: Write `client/src/lib/api.ts`**

```ts
export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `HTTP ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
```

- [ ] **Step 2: Write `client/src/lib/queryClient.ts`**

```ts
import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
```

- [ ] **Step 3: Write `client/src/lib/auth.tsx`** (auth + selected-dog context)

```tsx
import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

interface User { id: number; email: string; name: string; }
interface AuthCtx { user: User | null; loading: boolean; refetch: () => void; }
const AuthContext = createContext<AuthCtx>({ user: null, loading: true, refetch: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/api/auth/me").catch(() => null),
  });
  return <AuthContext.Provider value={{ user: data ?? null, loading: isLoading, refetch }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);

interface DogCtx { dogId: number | null; setDogId: (id: number) => void; }
const DogContext = createContext<DogCtx>({ dogId: null, setDogId: () => {} });
export function DogProvider({ children }: { children: ReactNode }) {
  const [dogId, setDogId] = useState<number | null>(null);
  return <DogContext.Provider value={{ dogId, setDogId }}>{children}</DogContext.Provider>;
}
export const useDog = () => useContext(DogContext);
```

- [ ] **Step 4: Typecheck (tsc via `npm run check`) + commit.**

```bash
git add client/src/lib/
git commit -m "feat: client api/query/auth+dog context"
```

### Task 5.2: UI primitives + TabBar + DogSwitcher + InsightCard

**Files:**
- Create: `client/src/components/ui/index.tsx`, `client/src/components/TabBar.tsx`, `client/src/components/DogSwitcher.tsx`, `client/src/components/InsightCard.tsx`

- [ ] **Step 1: Write `client/src/components/ui/index.tsx`** (tiny Tailwind primitives)

```tsx
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Button({ children, className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`rounded-xl px-4 py-2 font-medium bg-slate-900 text-white active:scale-95 disabled:opacity-50 ${className}`} {...p}>{children}</button>;
}
export function Input({ className = "", ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`w-full rounded-xl border border-slate-300 px-3 py-2 ${className}`} {...p} />;
}
export function Select({ className = "", children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return <select className={`w-full rounded-xl border border-slate-300 px-3 py-2 ${className}`} {...p}>{children}</select>;
}
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}
```

- [ ] **Step 2: Write `client/src/components/TabBar.tsx`**

```tsx
import { Link, useLocation } from "wouter";
const tabs = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/today", label: "오늘", icon: "📝" },
  { href: "/weight", label: "체중", icon: "📊" },
  { href: "/expenses", label: "비용", icon: "💰" },
];
export function TabBar() {
  const [loc] = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 grid grid-cols-4 border-t border-slate-200 bg-white">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`flex flex-col items-center py-2 text-xs ${loc === t.href ? "text-slate-900 font-semibold" : "text-slate-400"}`}>
          <span className="text-lg">{t.icon}</span>{t.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Write `client/src/components/DogSwitcher.tsx`**

```tsx
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useDog } from "@/lib/auth";
import type { Dog } from "@shared/schema";

export function DogSwitcher() {
  const { dogId, setDogId } = useDog();
  const { data: dogs } = useQuery({ queryKey: ["dogs"], queryFn: () => api<Dog[]>("/api/dogs") });
  useEffect(() => { if (dogs?.length && dogId === null) setDogId(dogs[0].id); }, [dogs, dogId, setDogId]);
  return (
    <header className="flex items-center justify-between p-4">
      <div className="flex gap-2">
        {dogs?.map((d) => (
          <button key={d.id} onClick={() => setDogId(d.id)} className={`rounded-full px-3 py-1 text-sm ${d.id === dogId ? "bg-slate-900 text-white" : "bg-slate-200"}`}>{d.name}</button>
        ))}
      </div>
      <Link href="/settings" className="text-xl">⚙️</Link>
    </header>
  );
}
```

- [ ] **Step 4: Write `client/src/components/InsightCard.tsx`**

```tsx
import type { InsightCard as Card } from "@shared/types";
const tone = { red: "bg-red-50 border-red-200", yellow: "bg-amber-50 border-amber-200", green: "bg-emerald-50 border-emerald-200" };
const dot = { red: "🔴", yellow: "🟡", green: "🟢" };
export function InsightCardView({ card }: { card: Card }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone[card.severity]}`}>
      <div className="font-semibold">{dot[card.severity]} {card.title}</div>
      <div className="mt-1 text-sm text-slate-600">{card.evidence}</div>
      <div className="mt-2 text-sm font-medium">→ {card.recommendedAction}</div>
      {card.disclaimer && <div className="mt-2 text-xs text-slate-400">{card.disclaimer}</div>}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + commit.**

```bash
git add client/src/components/
git commit -m "feat: ui primitives, tabbar, dog switcher, insight card"
```

---

## Phase 6: Frontend pages

### Task 6.1: App shell + routing + auth gate

**Files:**
- Modify: `client/src/main.tsx`, `client/src/App.tsx`

- [ ] **Step 1: Rewrite `client/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, DogProvider } from "./lib/auth";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DogProvider>
          <App />
        </DogProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
```

- [ ] **Step 2: Rewrite `client/src/App.tsx`**

```tsx
import { Route, Switch } from "wouter";
import { useAuth } from "./lib/auth";
import { TabBar } from "./components/TabBar";
import { DogSwitcher } from "./components/DogSwitcher";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Today from "./pages/Today";
import Weight from "./pages/Weight";
import Expenses from "./pages/Expenses";
import Settings from "./pages/Settings";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">불러오는 중…</div>;
  if (!user) return <Login />;
  return (
    <div className="mx-auto max-w-md pb-20">
      <DogSwitcher />
      <main className="px-4">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/today" component={Today} />
          <Route path="/weight" component={Weight} />
          <Route path="/expenses" component={Expenses} />
          <Route path="/settings" component={Settings} />
        </Switch>
      </main>
      <TabBar />
    </div>
  );
}
```

- [ ] **Step 3: Create stub pages so it compiles** — create each of `client/src/pages/{Login,Home,Today,Weight,Expenses,Settings}.tsx` with `export default function X(){ return <div>X</div>; }` (replaced in later tasks). Then `npm run check` → PASS.

- [ ] **Step 4: Commit.**

```bash
git add client/src/main.tsx client/src/App.tsx client/src/pages/
git commit -m "feat: app shell, routing, auth gate, page stubs"
```

### Task 6.2: Login page

**Files:** Modify `client/src/pages/Login.tsx`

- [ ] **Step 1: Write `client/src/pages/Login.tsx`**

```tsx
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Input, Card } from "@/components/ui";

export default function Login() {
  const { refetch } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    try {
      await api(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify({ email, password }) });
      refetch();
    } catch (e: any) {
      setError("로그인에 실패했어요. 이메일/비밀번호를 확인하세요.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-center text-3xl font-bold">오래오래 🐾</h1>
      <Card className="flex flex-col gap-3">
        <Input placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" placeholder="비밀번호 (6자 이상)" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="text-sm text-red-500">{error}</div>}
        <Button onClick={submit}>{mode === "login" ? "로그인" : "회원가입"}</Button>
        <button className="text-sm text-slate-500" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
        </button>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit.**

```bash
git add client/src/pages/Login.tsx
git commit -m "feat: login/register page"
```

### Task 6.3: Today page (daily log drawer)

**Files:** Modify `client/src/pages/Today.tsx`

- [ ] **Step 1: Write `client/src/pages/Today.tsx`**

```tsx
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useDog } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Select, Card } from "@/components/ui";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function Today() {
  const { dogId } = useDog();
  const [date, setDate] = useState(todayStr());
  const key = ["daily", dogId, date];
  const { data } = useQuery({ queryKey: key, queryFn: () => api(`/api/daily/${dogId}/${date}`), enabled: !!dogId });

  const addWeight = useMutation({
    mutationFn: (weightKg: string) => api(`/api/weights/${dogId}`, { method: "POST", body: JSON.stringify({ date, weightKg }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["weights", dogId] }),
  });
  const addFeeding = useMutation({
    mutationFn: (b: any) => api(`/api/daily/${dogId}/${date}/feeding`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const addWalk = useMutation({
    mutationFn: (b: any) => api(`/api/daily/${dogId}/${date}/walk`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const addPoop = useMutation({
    mutationFn: (b: any) => api(`/api/daily/${dogId}/${date}/poop`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  if (!dogId) return <div>강아지를 먼저 등록하세요.</div>;

  return (
    <div className="flex flex-col gap-4">
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      <Card>
        <h3 className="mb-2 font-semibold">⚖️ 체중</h3>
        <WeightForm onAdd={(kg) => addWeight.mutate(kg)} />
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">🍚 사료/간식</h3>
        <FeedingForm onAdd={(b) => addFeeding.mutate(b)} />
        <ul className="mt-2 text-sm">{data?.feedings?.map((f: any) => <li key={f.id}>{f.kind === "food" ? "사료" : "간식"} {f.name ?? ""} {f.amountG ?? "?"}g</li>)}</ul>
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">🚶 산책</h3>
        <WalkForm onAdd={(b) => addWalk.mutate(b)} />
        <ul className="mt-2 text-sm">{data?.walks?.map((w: any) => <li key={w.id}>{w.slot ?? ""} {w.durationMin ?? "?"}분</li>)}</ul>
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">💩 배변</h3>
        <PoopForm onAdd={(b) => addPoop.mutate(b)} />
        <ul className="mt-2 text-sm">{data?.poops?.map((p: any) => <li key={p.id}>{p.status ?? ""}</li>)}</ul>
      </Card>
    </div>
  );
}

function WeightForm({ onAdd }: { onAdd: (kg: string) => void }) {
  const [kg, setKg] = useState("");
  return <div className="flex gap-2"><Input type="number" step="0.01" placeholder="kg" value={kg} onChange={(e) => setKg(e.target.value)} /><Button onClick={() => { if (kg) { onAdd(kg); setKg(""); } }}>저장</Button></div>;
}
function FeedingForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [kind, setKind] = useState("food");
  const [name, setName] = useState("");
  const [amountG, setAmountG] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={kind} onChange={(e) => setKind(e.target.value)}><option value="food">사료</option><option value="treat">간식</option></Select>
      <Input placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
      <Input type="number" placeholder="g" value={amountG} onChange={(e) => setAmountG(e.target.value)} />
      <Button onClick={() => { onAdd({ kind, name, amountG }); setName(""); setAmountG(""); }}>추가</Button>
    </div>
  );
}
function WalkForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [slot, setSlot] = useState("morning");
  const [durationMin, setDurationMin] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={slot} onChange={(e) => setSlot(e.target.value)}><option value="morning">오전</option><option value="afternoon">오후</option><option value="evening">저녁</option></Select>
      <Input type="number" placeholder="분" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
      <Button onClick={() => { onAdd({ slot, durationMin: Number(durationMin) }); setDurationMin(""); }}>추가</Button>
    </div>
  );
}
function PoopForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [status, setStatus] = useState("normal");
  return (
    <div className="flex gap-2">
      <Select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="normal">정상</option><option value="soft">무름</option><option value="constipation">변비</option><option value="diarrhea">설사</option>
      </Select>
      <Button onClick={() => onAdd({ status })}>추가</Button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit.**

```bash
git add client/src/pages/Today.tsx
git commit -m "feat: today (daily log) page"
```

### Task 6.4: Weight page (timeline chart + goals)

**Files:** Modify `client/src/pages/Weight.tsx`

- [ ] **Step 1: Write `client/src/pages/Weight.tsx`**

```tsx
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import { useDog } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Card } from "@/components/ui";
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

  if (!dogId) return <div>강아지를 먼저 등록하세요.</div>;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mb-2 font-semibold">📊 체중 추이</h3>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <XAxis dataKey="date" fontSize={11} />
              <YAxis domain={["auto", "auto"]} fontSize={11} width={32} />
              <Tooltip />
              {activeGoal && <ReferenceLine y={Number(activeGoal.targetKg)} stroke="#10b981" strokeDasharray="4 4" label="목표" />}
              <Line type="monotone" dataKey="kg" stroke="#0f172a" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">🎯 목표 체중</h3>
        <div className="text-sm text-slate-600">현재 목표: {activeGoal ? `${activeGoal.targetKg}kg` : "미설정"}</div>
        <GoalForm onAdd={(b) => setGoal.mutate(b)} />
      </Card>
    </div>
  );
}

function GoalForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [targetKg, setTargetKg] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="mt-2 flex gap-2">
      <Input type="number" step="0.01" placeholder="목표 kg" value={targetKg} onChange={(e) => setTargetKg(e.target.value)} />
      <Button onClick={() => { if (targetKg) { onAdd({ targetKg, effectiveFrom: today }); setTargetKg(""); } }}>설정</Button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit.**

```bash
git add client/src/pages/Weight.tsx
git commit -m "feat: weight timeline page with goal line"
```

### Task 6.5: Home page (insights + summary)

**Files:** Modify `client/src/pages/Home.tsx`

- [ ] **Step 1: Write `client/src/pages/Home.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useDog } from "@/lib/auth";
import { InsightCardView } from "@/components/InsightCard";
import { Card } from "@/components/ui";
import type { InsightCard } from "@shared/types";

export default function Home() {
  const { dogId } = useDog();
  const { data, isLoading } = useQuery({
    queryKey: ["insights", dogId],
    queryFn: () => api<{ metrics: any; cards: InsightCard[] }>(`/api/insights/${dogId}`),
    enabled: !!dogId,
  });

  if (!dogId) return <Card>강아지를 등록하면 분석을 시작할게요. ⚙️ 설정에서 추가하세요.</Card>;
  if (isLoading) return <div>분석 중…</div>;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="text-sm text-slate-500">오늘 체중</div>
        <div className="text-2xl font-bold">{data?.metrics?.todayWeightKg ?? "—"} kg</div>
        <div className="text-sm text-slate-500">목표 대비 {data?.metrics?.gapKg !== null && data?.metrics?.gapKg !== undefined ? `${data.metrics.gapKg > 0 ? "+" : ""}${data.metrics.gapKg}kg` : "—"}</div>
      </Card>
      {data?.cards?.map((c, i) => <InsightCardView key={i} card={c} />)}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit.**

```bash
git add client/src/pages/Home.tsx
git commit -m "feat: home page (insights + today summary)"
```

### Task 6.6: Expenses page

**Files:** Modify `client/src/pages/Expenses.tsx`

- [ ] **Step 1: Write `client/src/pages/Expenses.tsx`**

```tsx
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
```

- [ ] **Step 2: Typecheck + commit.**

```bash
git add client/src/pages/Expenses.tsx
git commit -m "feat: expenses page (pie + list + add)"
```

### Task 6.7: Settings page (profile, add dog, logout)

**Files:** Modify `client/src/pages/Settings.tsx`

- [ ] **Step 1: Write `client/src/pages/Settings.tsx`**

```tsx
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Select, Card } from "@/components/ui";
import type { Dog } from "@shared/schema";

export default function Settings() {
  const { user, refetch } = useAuth();
  const { data: dogs } = useQuery({ queryKey: ["dogs"], queryFn: () => api<Dog[]>("/api/dogs") });
  const addDog = useMutation({
    mutationFn: (b: any) => api("/api/dogs", { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dogs"] }),
  });
  async function logout() { await api("/api/auth/logout", { method: "POST" }); queryClient.clear(); refetch(); }

  return (
    <div className="flex flex-col gap-4">
      <Card><div className="text-sm text-slate-500">보호자</div><div className="font-semibold">{user?.name} ({user?.email})</div></Card>
      <Card>
        <h3 className="mb-2 font-semibold">🐕 우리 아이들</h3>
        <ul className="mb-2 text-sm">{dogs?.map((d) => <li key={d.id}>{d.name} · {d.breed ?? "견종 미입력"}</li>)}</ul>
        <DogForm onAdd={(b) => addDog.mutate(b)} />
      </Card>
      <Button className="bg-red-500" onClick={logout}>로그아웃</Button>
    </div>
  );
}

function DogForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("포메라니안");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("female");
  return (
    <div className="flex flex-col gap-2">
      <Input placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="견종" value={breed} onChange={(e) => setBreed(e.target.value)} />
      <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
      <Select value={sex} onChange={(e) => setSex(e.target.value)}><option value="female">여아</option><option value="male">남아</option></Select>
      <Button onClick={() => { if (name) { onAdd({ name, breed, birthDate: birthDate || null, sex }); setName(""); } }}>강아지 추가</Button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + final frontend build check + commit.**

Run: `npm run check` → PASS
Run: `npm run build` → builds client + server bundle.

```bash
git add client/src/pages/Settings.tsx
git commit -m "feat: settings page (profile, add dog, logout)"
```

---

## Phase 7: Deploy (Cloud Run)

### Task 7.1: Dockerfile + cloudbuild + README

**Files:** Create `Dockerfile`, `cloudbuild.yaml`, `.dockerignore`; update `README.md`

- [ ] **Step 1: Write `Dockerfile`**

```dockerfile
# Stage 1: build
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: run
FROM node:22-slim AS runner
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle.config.ts ./
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.mjs"]
```

- [ ] **Step 2: Write `.dockerignore`**

```
node_modules
dist
.git
.env
.remember
```

- [ ] **Step 3: Write `cloudbuild.yaml`**

```yaml
steps:
  - name: gcr.io/cloud-builders/docker
    args: ["build", "-t", "${_REGION}-docker.pkg.dev/$PROJECT_ID/oraeorae/app:$SHORT_SHA", "."]
  - name: gcr.io/cloud-builders/docker
    args: ["push", "${_REGION}-docker.pkg.dev/$PROJECT_ID/oraeorae/app:$SHORT_SHA"]
  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    entrypoint: gcloud
    args:
      - run
      - deploy
      - oraeorae
      - --image=${_REGION}-docker.pkg.dev/$PROJECT_ID/oraeorae/app:$SHORT_SHA
      - --region=${_REGION}
      - --platform=managed
      - --allow-unauthenticated
substitutions:
  _REGION: us-central1
options:
  logging: CLOUD_LOGGING_ONLY
images:
  - "${_REGION}-docker.pkg.dev/$PROJECT_ID/oraeorae/app:$SHORT_SHA"
```

- [ ] **Step 4: Update `README.md`**

```markdown
# OraeOrae 🐾

포메라니안 두 마리(레오·아이)를 위한 개인 케어 앱. 매일 체중/사료/산책/배변을 기록하고,
체중 타임라인과 AI 인사이트로 actionable insight를 제공합니다.

## 개발

```bash
npm install
cp .env.example .env   # DATABASE_URL 등 채우기
npm run db:push        # 스키마 적용 (Postgres 필요)
npm run dev            # http://localhost:5000
```

## 스택
React + Vite · Express · Drizzle + PostgreSQL · Vertex AI (Gemini) · Cloud Run

설계 문서: `docs/superpowers/specs/2026-06-16-oraeorae-mvp.md`
```

- [ ] **Step 5: Verify local Docker build compiles app (skip if Docker unavailable; build app instead).**

Run: `npm run build`
Expected: PASS (already verified in 6.7). Docker build is optional locally.

- [ ] **Step 6: Commit.**

```bash
git add Dockerfile .dockerignore cloudbuild.yaml README.md
git commit -m "feat: dockerfile + cloudbuild + readme"
```

---

## Self-Review

**Spec coverage:**
- Profile (1) → dogs table (1.1), dogs routes (3.2), Settings page DogForm (6.7) ✅
- Weight (2) + goals → weight_logs/weight_goals (1.1), weights routes (3.3), Weight page (6.4), Today weight form (6.3) ✅
- Daily log (3) sub-divided into numbers → daily routes (3.4), Today page (6.3) ✅
- Cost (6) → expenses (1.1, 3.5), Expenses page (6.6) ✅
- Actionable AI insight (code-aggregates, AI-interprets, fallback, disclaimers, silence<3d) → aggregate (4.1), providers (4.2), insights route (4.3), Home (6.5) ✅
- Overlay timeline → Weight page chart + goal ReferenceLine (6.4); diet/activity markers are a **known partial** (chart shows weight + goal line; per-day food/walk markers under the axis is a polish item deferred — noted below) ⚠️
- Multi-device + cloud sync + future public → auth + user_id isolation (2.x, 3.x), Cloud Run (7.1) ✅
- Stack (React/Express/Drizzle/Cloud SQL/Vertex/Cloud Run) ✅

**Known deferrals (intentional, post-MVP):** per-day food/walk/poop markers rendered *under* the weight chart axis (the spec's full "overlay" visualization) is simplified to weight-line + goal-line for MVP; the aggregation already computes the data, so adding markers is a later visual task. Skin photos (5) and medical/meds (4) are explicitly post-MVP per spec §2.

**Placeholder scan:** No TBD/TODO; every code step contains full code. ✅

**Type consistency:** `InsightCard`/`AggregatedMetrics` in `shared/types.ts` used identically in aggregate, providers, route, Home. Table/type names (`weightLogs`, `dailyLogs`, etc.) consistent between schema and all routes. `dogOwnedBy` name consistent. `api()` signature consistent across pages. ✅

---

## Execution Notes for Autonomous Loop

- DB-dependent steps (curl health, route smoke) require a running Postgres + `DATABASE_URL`. If unavailable in the loop environment, rely on `npm run check` (tsc) and `npm test` (vitest, which test pure logic without a DB) as the per-task gate, and defer live DB verification.
- Per-task gate: `npm run check` must pass; if the task added/changed a tested module, `npm test` must pass.
- Commit after every task. Keep commits small.
- If a dependency version in package.json fails to resolve, pick the nearest existing version and note it in the commit message.
