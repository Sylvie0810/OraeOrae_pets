import { Router } from "express";
import multer from "multer";
import { Storage } from "@google-cloud/storage";
import { requireAuth, type AuthedRequest } from "../auth";

export const uploadRouter = Router();
uploadRouter.use(requireAuth);

const BUCKET = process.env.GCS_BUCKET ?? "";
const storage = new Storage();

// Allowlist of safe raster image types only. NOT svg — SVGs can carry script
// and would be a stored-XSS vector when served from the public bucket.
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

// 5MB cap, kept in memory (no disk write on Cloud Run).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error("JPG·PNG·WEBP·GIF 이미지만 업로드할 수 있어요."));
  },
});

// POST /api/upload  (multipart field "photo") -> { url }
uploadRouter.post("/", (req: AuthedRequest, res) => {
  upload.single("photo")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "파일이 없어요." });
    if (!BUCKET) return res.status(500).json({ error: "스토리지 버킷이 설정되지 않았어요." });

    try {
      // ext + contentType come from the trusted allowlist key, never from client input.
      const ext = ALLOWED.get(req.file.mimetype)!;
      const objectName = `dogs/${req.userId}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
      const file = storage.bucket(BUCKET).file(objectName);
      await file.save(req.file.buffer, {
        contentType: req.file.mimetype,
        metadata: { cacheControl: "public, max-age=31536000" },
      });
      const url = `https://storage.googleapis.com/${BUCKET}/${objectName}`;
      res.json({ url });
    } catch (e) {
      console.error("upload failed:", e);
      res.status(500).json({ error: "업로드에 실패했어요." });
    }
  });
});
