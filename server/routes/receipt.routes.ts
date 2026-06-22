import { Router } from "express";
import { randomBytes } from "crypto";
import multer from "multer";
import { Storage } from "@google-cloud/storage";
import { requireAuth, type AuthedRequest } from "../auth";
import { geminiGenerate, geminiConfigured, parseJsonLoose } from "../ai/geminiApi";

export const receiptRouter = Router();
receiptRouter.use(requireAuth);

const BUCKET = process.env.GCS_BUCKET ?? "";
const storage = new Storage();

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error("JPG·PNG·WEBP 영수증 이미지만 올릴 수 있어요."));
  },
});

const CATEGORIES = ["food", "treat", "toy", "hospital", "clothing", "grooming", "etc"];

const PROMPT = `이 이미지는 반려동물 관련 지출 영수증이다. 다음을 한국어로 추출해 JSON만 출력하라(설명·코드블록 금지).
{
  "amount": <총 결제 금액 숫자만, 콤마/원 제거. 못 찾으면 null>,
  "vendor": "<상호/가게 이름, 없으면 null>",
  "date": "<YYYY-MM-DD, 없으면 null>",
  "category": "<food|treat|toy|hospital|clothing|grooming|etc 중 영수증 내용에 가장 맞는 하나. 동물병원이면 hospital, 미용/스파면 grooming, 사료면 food, 간식이면 treat, 그 외 etc>",
  "items": "<주요 구매 품목 요약 한 줄, 없으면 null>"
}
금액은 부가세 포함 최종 결제액 기준. 영수증이 아니거나 못 읽으면 모든 값을 null로.`;

// POST /api/receipt/scan  (multipart "photo") -> { receiptUrl, extracted: {...} }
receiptRouter.post("/scan", (req: AuthedRequest, res) => {
  upload.single("photo")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "파일이 없어요." });
    if (!BUCKET) return res.status(500).json({ error: "스토리지 버킷이 설정되지 않았어요." });
    if (!geminiConfigured()) return res.status(500).json({ error: "OCR이 설정되지 않았어요." });

    // 1) store the receipt image in GCS (CSPRNG token — receipts live in a public bucket)
    let receiptUrl = "";
    try {
      const ext = ALLOWED.get(req.file.mimetype)!;
      const rand = randomBytes(16).toString("hex");
      const objectName = `receipts/${req.userId}/${Date.now()}-${rand}.${ext}`;
      const file = storage.bucket(BUCKET).file(objectName);
      await file.save(req.file.buffer, {
        contentType: req.file.mimetype,
        metadata: { cacheControl: "public, max-age=31536000" },
      });
      receiptUrl = `https://storage.googleapis.com/${BUCKET}/${objectName}`;
    } catch (e) {
      console.error("receipt upload failed:", e);
      return res.status(500).json({ error: "영수증 업로드에 실패했어요." });
    }

    // 2) extract fields with Gemini Vision — failure here still returns the saved image
    let extracted: Record<string, unknown> = { amount: null, vendor: null, date: null, category: "etc", items: null };
    try {
      const text = await geminiGenerate([
        { text: PROMPT },
        { inline_data: { mime_type: req.file.mimetype, data: req.file.buffer.toString("base64") } },
      ]);
      const parsed = parseJsonLoose<any>(text);
      // normalize category to our allowlist
      if (!CATEGORIES.includes(parsed.category)) parsed.category = "etc";
      extracted = parsed;
    } catch (e) {
      console.error("receipt OCR failed (image still saved):", e);
      // return the image with empty fields so the user can fill manually
    }

    res.json({ receiptUrl, extracted });
  });
});
