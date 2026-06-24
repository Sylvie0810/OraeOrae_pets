import { pgTable, serial, integer, text, date, time, numeric, boolean, timestamp, unique, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // null for Google-only accounts
  name: text("name").notNull(),
  googleId: text("google_id").unique(), // null for email/password accounts
  photoUrl: text("photo_url"),
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
  amountG: numeric("amount_g"), // weight in grams (optional)
  qty: numeric("qty"), // count, e.g. 1 chew (optional)
  kcal: numeric("kcal"), // calories (optional)
  fedAt: time("fed_at"), // serving time (defaults to "now" in the UI)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supplementEntries = pgTable("supplement_entries", {
  id: serial("id").primaryKey(),
  dailyLogId: integer("daily_log_id").notNull().references(() => dailyLogs.id, { onDelete: "cascade" }),
  medicationId: integer("medication_id"), // links a daily tick to a registered prescription (nullable)
  name: text("name").notNull(), // e.g. 갑상선약, 오메가3
  dose: text("dose"), // free text, e.g. "1정", "0.5ml"
  givenAt: time("given_at"),
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
  receiptUrl: text("receipt_url"), // optional scanned receipt image (GCS)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Hospital visits, vaccines, dewormer — one-off medical events.
export const medicalRecords = pgTable("medical_records", {
  id: serial("id").primaryKey(),
  dogId: integer("dog_id").notNull().references(() => dogs.id),
  date: date("date").notNull(),
  kind: text("kind").notNull(), // 'visit' | 'vaccine' | 'dewormer' | 'other'
  title: text("title").notNull(), // 이유/항목, e.g. "갑상선 정기검진", "종합백신 3차"
  hospital: text("hospital"),
  cost: numeric("cost"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Ongoing medications AND supplements (one table). One row per course/prescription.
// Daily "did you give it today?" ticks are recorded in supplementEntries.
export const medications = pgTable("medications", {
  id: serial("id").primaryKey(),
  dogId: integer("dog_id").notNull().references(() => dogs.id),
  name: text("name").notNull(), // e.g. 씬지로이드, 오메가3
  dose: text("dose"), // e.g. "0.1mg 1정"
  frequency: text("frequency"), // e.g. "1일 2회"
  isSupplement: boolean("is_supplement").default(false), // false = 약, true = 영양제
  startDate: date("start_date"),
  endDate: date("end_date"), // null = ongoing
  active: boolean("active").default(true),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Annual health checkups — uploaded result sheet + AI-extracted metrics for year-over-year compare.
export const checkups = pgTable("checkups", {
  id: serial("id").primaryKey(),
  dogId: integer("dog_id").notNull().references(() => dogs.id),
  date: date("date").notNull(),
  hospital: text("hospital"),
  reportUrl: text("report_url"), // uploaded result sheet (GCS)
  summary: text("summary"), // AI one-paragraph summary
  // AI-extracted metrics: [{ name, value, unit, refLow, refHigh, flag }]
  metrics: jsonb("metrics").$type<CheckupMetric[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export interface CheckupMetric {
  name: string;       // e.g. "T4", "BUN", "ALT"
  value: number | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  flag: "low" | "normal" | "high" | null; // vs reference range
}

// Skin/alopecia photo tracking — one row per photo, grouped by body part.
export const skinPhotos = pgTable("skin_photos", {
  id: serial("id").primaryKey(),
  dogId: integer("dog_id").notNull().references(() => dogs.id),
  date: date("date").notNull(),
  bodyPart: text("body_part").notNull(), // e.g. 등, 배, 앞다리
  photoUrl: text("photo_url").notNull(),
  comment: text("comment"),
  source: text("source").notNull().default("owner"), // 'owner' | 'shop'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cached "오늘의 코치" insight cards — one row per (dog, day).
// The LLM is expensive and its inputs only change when the day's records change,
// so we generate once per KST day and reuse the result on every page load.
export const coachCards = pgTable("coach_cards", {
  id: serial("id").primaryKey(),
  dogId: integer("dog_id").notNull().references(() => dogs.id),
  date: date("date").notNull(), // KST day the cards were generated for
  cards: jsonb("cards").notNull(), // InsightCard[]
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({ dogDate: unique().on(t.dogId, t.date) }));

// Cached AI year-over-year checkup comparison — one row per dog.
// The LLM comment only changes when the underlying checkup set changes, so we
// key the cache on a fingerprint of the checkups (ids/dates/count) and reuse the
// stored text until that fingerprint changes (new upload, re-analyze, or delete).
export const checkupCompares = pgTable("checkup_compares", {
  dogId: integer("dog_id").primaryKey().references(() => dogs.id),
  fingerprint: text("fingerprint").notNull(), // hash of the checkup set it was built from
  comparison: text("comparison").notNull(),
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
export const insertSupplementSchema = createInsertSchema(supplementEntries).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export const insertMedicalSchema = createInsertSchema(medicalRecords).omit({ id: true, createdAt: true });
export const insertMedicationSchema = createInsertSchema(medications).omit({ id: true, createdAt: true });
export const insertCheckupSchema = createInsertSchema(checkups).omit({ id: true, createdAt: true });
export const insertSkinPhotoSchema = createInsertSchema(skinPhotos).omit({ id: true, createdAt: true });

export type Dog = typeof dogs.$inferSelect;
export type WeightLog = typeof weightLogs.$inferSelect;
export type WeightGoal = typeof weightGoals.$inferSelect;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type FeedingEntry = typeof feedingEntries.$inferSelect;
export type WalkEntry = typeof walkEntries.$inferSelect;
export type PoopEntry = typeof poopEntries.$inferSelect;
export type SupplementEntry = typeof supplementEntries.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type MedicalRecord = typeof medicalRecords.$inferSelect;
export type Medication = typeof medications.$inferSelect;
export type Checkup = typeof checkups.$inferSelect;
export type SkinPhoto = typeof skinPhotos.$inferSelect;
export type CoachCards = typeof coachCards.$inferSelect;
export type CheckupCompare = typeof checkupCompares.$inferSelect;
