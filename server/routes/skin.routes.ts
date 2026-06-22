import { Router } from "express";
import { randomBytes } from "crypto";
import multer from "multer";
import { eq, asc, desc } from "drizzle-orm";
import { Storage } from "@google-cloud/storage";
import { db } from "../db";
import { skinPhotos, insertSkinPhotoSchema } from "@shared/schema";
import { requireAuth, type AuthedRequest } from "../auth";
import { dogOwnedBy } from "./_helpers";

export const skinRouter = Router();
skinRouter.use(requireAuth);

const BUCKET = process.env.GCS_BUCKET ?? "";
const storage = new Storage();
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error("JPG·PNG·WEBP 이미지만 올릴 수 있어요."));
  },
});

// GET /api/skin/:dogId            -> all photos (newest first)
// GET /api/skin/:dogId?part=등    -> filtered by body part (oldest first, for comparison)
skinRouter.get("/:dogId", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const part = typeof req.query.part === "string" ? req.query.part : null;
  let rows = await db.select().from(skinPhotos).where(eq(skinPhotos.dogId, dogId)).orderBy(part ? asc(skinPhotos.date) : desc(skinPhotos.date));
  if (part) rows = rows.filter((r) => r.bodyPart === part);
  res.json(rows);
});

// GET /api/skin/:dogId/parts -> distinct body parts that have photos
skinRouter.get("/:dogId/parts", async (req: AuthedRequest, res) => {
  const dogId = Number(req.params.dogId);
  if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
  const rows = await db.select({ part: skinPhotos.bodyPart }).from(skinPhotos).where(eq(skinPhotos.dogId, dogId)).groupBy(skinPhotos.bodyPart);
  res.json(rows.map((r) => r.part));
});

// POST /api/skin/:dogId  (multipart "photo" + fields bodyPart, date, comment, source)
skinRouter.post("/:dogId", (req: AuthedRequest, res) => {
  upload.single("photo")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const dogId = Number(req.params.dogId);
    if (!(await dogOwnedBy(req.userId!, dogId))) return res.status(404).json({ error: "not found" });
    if (!req.file) return res.status(400).json({ error: "사진이 없어요." });
    if (!BUCKET) return res.status(500).json({ error: "스토리지가 설정되지 않았어요." });

    let photoUrl = "";
    try {
      const ext = ALLOWED.get(req.file.mimetype)!;
      const rand = randomBytes(16).toString("hex");
      const objectName = `skin/${req.userId}/${Date.now()}-${rand}.${ext}`;
      const file = storage.bucket(BUCKET).file(objectName);
      await file.save(req.file.buffer, { contentType: req.file.mimetype, metadata: { cacheControl: "public, max-age=31536000" } });
      photoUrl = `https://storage.googleapis.com/${BUCKET}/${objectName}`;
    } catch (e) {
      console.error("skin photo upload failed:", e);
      return res.status(500).json({ error: "사진 업로드에 실패했어요." });
    }

    const parsed = insertSkinPhotoSchema.safeParse({
      dogId,
      date: req.body.date || new Date().toISOString().slice(0, 10),
      bodyPart: req.body.bodyPart || "기타",
      photoUrl,
      comment: req.body.comment || null,
      source: req.body.source === "shop" ? "shop" : "owner",
    });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const [row] = await db.insert(skinPhotos).values(parsed.data).returning();
    res.json(row);
  });
});

// PATCH (comment/bodyPart/date/source — not the image)
skinRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(skinPhotos).where(eq(skinPhotos.id, id));
  if (!row || !(await dogOwnedBy(req.userId!, row.dogId))) return res.status(404).json({ error: "not found" });
  const parsed = insertSkinPhotoSchema.partial().omit({ dogId: true, photoUrl: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [updated] = await db.update(skinPhotos).set(parsed.data).where(eq(skinPhotos.id, id)).returning();
  res.json(updated);
});

skinRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(skinPhotos).where(eq(skinPhotos.id, id));
  if (!row || !(await dogOwnedBy(req.userId!, row.dogId))) return res.status(404).json({ error: "not found" });
  await db.delete(skinPhotos).where(eq(skinPhotos.id, id));
  res.json({ ok: true });
});
