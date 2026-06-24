import { Router } from "express";
import { randomBytes } from "crypto";
import multer from "multer";
import { eq, and, asc, desc } from "drizzle-orm";
import { Storage } from "@google-cloud/storage";
import { db } from "../db";
import {
  medicalRecords, medications, checkups, dailyLogs, supplementEntries,
  insertMedicalSchema, insertMedicationSchema,
  type CheckupMetric,
} from "@shared/schema";
import { requireAuth, type AuthedRequest } from "../auth";
import { dogOwnedBy } from "./_helpers";
import { todayKST } from "@shared/date";
import { geminiGenerate, geminiConfigured, parseJsonLoose } from "../ai/geminiApi";

export const medicalRouter = Router();
medicalRouter.use(requireAuth);

const BUCKET = process.env.GCS_BUCKET ?? "";
const storage = new Storage();

const REPORT_ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (REPORT_ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error("JPG·PNG·WEBP·PDF만 올릴 수 있어요."));
  },
});

/* ---------------- medical records (visits/vaccines/dewormer) ---------------- */
medicalRouter.get("/records/:dogId", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const rows = await db.select().from(medicalRecords).where(eq(medicalRecords.dogId, dogId)).orderBy(desc(medicalRecords.date));
  res.json(rows);
});

medicalRouter.post("/records/:dogId", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const parsed = insertMedicalSchema.safeParse({ ...req.body, dogId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.insert(medicalRecords).values(parsed.data).returning();
  res.json(row);
});

medicalRouter.patch("/records/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(medicalRecords).where(eq(medicalRecords.id, id));
  if (!row || !(await dogOwnedBy(req.userId!, row.dogId))) return res.status(404).json({ error: "not found" });
  const parsed = insertMedicalSchema.partial().omit({ dogId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [updated] = await db.update(medicalRecords).set(parsed.data).where(eq(medicalRecords.id, id)).returning();
  res.json(updated);
});

medicalRouter.delete("/records/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(medicalRecords).where(eq(medicalRecords.id, id));
  if (!row || !(await dogOwnedBy(req.userId!, row.dogId))) return res.status(404).json({ error: "not found" });
  await db.delete(medicalRecords).where(eq(medicalRecords.id, id));
  res.json({ ok: true });
});

/* ---------------- medications (chronic) ---------------- */
medicalRouter.get("/medications/:dogId", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const rows = await db.select().from(medications).where(eq(medications.dogId, dogId)).orderBy(desc(medications.active), desc(medications.startDate));
  res.json(rows);
});

medicalRouter.post("/medications/:dogId", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const parsed = insertMedicationSchema.safeParse({ ...req.body, dogId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.insert(medications).values(parsed.data).returning();
  res.json(row);
});

medicalRouter.patch("/medications/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(medications).where(eq(medications.id, id));
  if (!row || !(await dogOwnedBy(req.userId!, row.dogId))) return res.status(404).json({ error: "not found" });
  const parsed = insertMedicationSchema.partial().omit({ dogId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [updated] = await db.update(medications).set(parsed.data).where(eq(medications.id, id)).returning();
  res.json(updated);
});

medicalRouter.delete("/medications/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(medications).where(eq(medications.id, id));
  if (!row || !(await dogOwnedBy(req.userId!, row.dogId))) return res.status(404).json({ error: "not found" });
  await db.delete(medications).where(eq(medications.id, id));
  res.json({ ok: true });
});

/* ---------- daily med/supplement check (for the 오늘 tab) ---------- */

async function getOrCreateDailyLog(dogId: number, date: string) {
  const [existing] = await db.select().from(dailyLogs).where(and(eq(dailyLogs.dogId, dogId), eq(dailyLogs.date, date)));
  if (existing) return existing;
  const [created] = await db.insert(dailyLogs).values({ dogId, date }).returning();
  return created;
}

// GET /api/medical/today/:dogId/:date -> active prescriptions + whether each was given that day
medicalRouter.get("/today/:dogId/:date", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  const date = req.params.date;
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });

  // active on this date = active flag on, started on/before date, not ended before date
  const meds = await db.select().from(medications).where(and(eq(medications.dogId, dogId), eq(medications.active, true)));
  const activeToday = meds.filter((m) =>
    (!m.startDate || m.startDate <= date) && (!m.endDate || m.endDate >= date)
  );

  // which of them are already ticked for this day?
  const [log] = await db.select().from(dailyLogs).where(and(eq(dailyLogs.dogId, dogId), eq(dailyLogs.date, date)));
  let givenByMed = new Map<number, number>(); // medicationId -> entryId
  if (log) {
    const entries = await db.select().from(supplementEntries).where(eq(supplementEntries.dailyLogId, log.id));
    for (const e of entries) if (e.medicationId != null) givenByMed.set(e.medicationId, e.id);
  }

  res.json(activeToday.map((m) => ({
    medication: m,
    given: givenByMed.has(m.id),
    entryId: givenByMed.get(m.id) ?? null,
  })));
});

// POST /api/medical/today/:dogId/:date/check  { medicationId } -> tick (records a supplementEntry)
medicalRouter.post("/today/:dogId/:date/check", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  const date = req.params.date;
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const medicationId = Number(req.body?.medicationId);
  const [med] = await db.select().from(medications).where(and(eq(medications.id, medicationId), eq(medications.dogId, dogId)));
  if (!med) return res.status(404).json({ error: "medication not found" });

  const log = await getOrCreateDailyLog(dogId, date);
  // avoid duplicate tick
  const existing = await db.select().from(supplementEntries).where(and(eq(supplementEntries.dailyLogId, log.id), eq(supplementEntries.medicationId, medicationId)));
  if (existing.length) return res.json(existing[0]);
  const [row] = await db.insert(supplementEntries).values({ dailyLogId: log.id, medicationId, name: med.name, dose: med.dose ?? null }).returning();
  res.json(row);
});

// DELETE /api/medical/today/check/:entryId -> untick
medicalRouter.delete("/today/check/:entryId", async (req: AuthedRequest, res) => {
  const entryId = Number(req.params.entryId);
  const [entry] = await db.select().from(supplementEntries).where(eq(supplementEntries.id, entryId));
  if (!entry) return res.status(404).json({ error: "not found" });
  const [log] = await db.select().from(dailyLogs).where(eq(dailyLogs.id, entry.dailyLogId));
  if (!log || !(await dogOwnedBy(req.userId!, log.dogId))) return res.status(404).json({ error: "not found" });
  await db.delete(supplementEntries).where(eq(supplementEntries.id, entryId));
  res.json({ ok: true });
});

/* ---------------- checkups (annual health screening) ---------------- */
medicalRouter.get("/checkups/:dogId", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const rows = await db.select().from(checkups).where(eq(checkups.dogId, dogId)).orderBy(asc(checkups.date));
  res.json(rows);
});

medicalRouter.delete("/checkups/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(checkups).where(eq(checkups.id, id));
  if (!row || !(await dogOwnedBy(req.userId!, row.dogId))) return res.status(404).json({ error: "not found" });
  await db.delete(checkups).where(eq(checkups.id, id));
  res.json({ ok: true });
});

const ANALYZE_PROMPT = `이 이미지는 반려견 건강검진 결과지다. 한국어로 JSON만 출력하라(코드블록 금지).
{
  "date": "<검진 날짜 YYYY-MM-DD, 없으면 null>",
  "hospital": "<병원 이름, 없으면 null>",
  "summary": "<결과지 전체를 보호자가 이해할 수 있게 2~3문장으로 요약. 정상/주의 항목 강조>",
  "metrics": [
    {"name":"<검사 항목명, 예: T4, BUN, ALT, 콜레스테롤>", "value":<숫자만 또는 null>, "unit":"<단위 또는 null>", "refLow":<정상범위 하한 숫자 또는 null>, "refHigh":<정상범위 상한 숫자 또는 null>, "flag":"<low|normal|high 또는 null>"}
  ]
}
주요 수치는 가능한 많이 추출하되, 숫자로 읽히는 검사값 위주로. 결과지가 아니거나 못 읽으면 summary에 그 사실을 적고 metrics는 빈 배열로.`;

// POST /api/medical/checkups/:dogId/analyze  (multipart "report") -> saved checkup row
medicalRouter.post("/checkups/:dogId/analyze", (req: AuthedRequest, res) => {
  upload.single("report")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const dogId = Number(req.params.dogId);
    if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
    if (!req.file) return res.status(400).json({ error: "파일이 없어요." });
    if (!BUCKET) return res.status(500).json({ error: "스토리지가 설정되지 않았어요." });
    if (!geminiConfigured()) return res.status(500).json({ error: "AI 분석이 설정되지 않았어요." });

    // 1) store the report
    let reportUrl = "";
    try {
      const ext = REPORT_ALLOWED.get(req.file.mimetype)!;
      const rand = randomBytes(16).toString("hex");
      const objectName = `checkups/${req.userId}/${Date.now()}-${rand}.${ext}`;
      const file = storage.bucket(BUCKET).file(objectName);
      await file.save(req.file.buffer, { contentType: req.file.mimetype, metadata: { cacheControl: "public, max-age=31536000" } });
      reportUrl = `https://storage.googleapis.com/${BUCKET}/${objectName}`;
    } catch (e) {
      console.error("checkup upload failed:", e);
      return res.status(500).json({ error: "결과지 업로드에 실패했어요." });
    }

    // 2) extract with Gemini (PDF and images are both supported as inline_data)
    let date: string = todayKST();
    let hospital: string | null = null;
    let summary: string | null = null;
    let metrics: CheckupMetric[] = [];
    try {
      const text = await geminiGenerate([
        { text: ANALYZE_PROMPT },
        { inline_data: { mime_type: req.file.mimetype, data: req.file.buffer.toString("base64") } },
      ]);
      const parsed = parseJsonLoose<any>(text);
      if (parsed.date) date = parsed.date;
      hospital = parsed.hospital ?? null;
      summary = parsed.summary ?? null;
      if (Array.isArray(parsed.metrics)) metrics = parsed.metrics;
    } catch (e) {
      console.error("checkup OCR failed (report still saved):", e);
      summary = "AI 분석에 실패했어요. 수치는 직접 확인해주세요.";
    }

    const [row] = await db.insert(checkups).values({ dogId, date, hospital, reportUrl, summary, metrics }).returning();
    res.json(row);
  });
});

// GET /api/medical/checkups/:dogId/compare -> AI year-over-year trend comment
medicalRouter.get("/checkups/:dogId/compare", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const rows = await db.select().from(checkups).where(eq(checkups.dogId, dogId)).orderBy(asc(checkups.date));
  if (rows.length < 2) return res.json({ comparison: null });
  if (!geminiConfigured()) return res.json({ comparison: null });

  // compact series of (date, metrics) for the model
  const series = rows.map((c) => ({ date: c.date, metrics: c.metrics ?? [] }));
  try {
    const prompt = `다음은 한 반려견의 연도별 건강검진 수치다. 항목별로 연도에 따라 어떻게 변했는지(개선/악화/유지) 한국어로 2~4문장 요약하라. 특히 정상범위를 벗어난 항목과 추세를 강조. 마지막에 "참고용이며 수의사 상담을 대체하지 않습니다." 추가. JSON만: {"comparison":"<요약>"}\n\n데이터:\n${JSON.stringify(series)}`;
    const text = await geminiGenerate([{ text: prompt }]);
    const parsed = parseJsonLoose<{ comparison: string }>(text);
    res.json({ comparison: parsed.comparison ?? null });
  } catch (e) {
    console.error("checkup compare failed:", e);
    res.json({ comparison: null });
  }
});
