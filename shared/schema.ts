import { pgTable, serial, integer, text, date, time, numeric, boolean, timestamp, unique } from "drizzle-orm/pg-core";
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
