import { Router } from "express";
import multer from "multer";
import { Storage } from "@google-cloud/storage";
import { requireAuth, type AuthedRequest } from "../auth";

export const uploadRouter = Router();
uploadRouter.use(requireAuth);

const BUCKET = process.env.GCS_BUCKET ?? "";
const storage = new Storage();

// 5MB cap, images only, kept in memory (no disk write on Cloud Run).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("이미지 파일만 업로드할 수 있어요."));
  },
});

// POST /api/upload  (multipart field "photo") -> { url }
uploadRouter.post("/", (req: AuthedRequest, res) => {
  upload.single("photo")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "파일이 없어요." });
    if (!BUCKET) return res.status(500).json({ error: "스토리지 버킷이 설정되지 않았어요." });

    try {
      const ext = (req.file.originalname.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const objectName = `dogs/${req.userId}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext || "jpg"}`;
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
