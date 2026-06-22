// Thin client for the Gemini API (AI Studio) via an API key.
// We use this instead of the Vertex SDK because the GCP project isn't
// provisioned for Vertex publisher models (every model path 404s), whereas
// the generativelanguage API works with a simple key.

const KEY = process.env.GEMINI_API_KEY ?? "";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiConfigured(): boolean {
  return !!KEY;
}

interface Part {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

// Returns the model's text output, or throws on error.
export async function geminiGenerate(parts: Part[]): Promise<string> {
  if (!KEY) throw new Error("GEMINI_API_KEY not set");
  const res = await fetch(`${BASE}/${MODEL}:generateContent?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`gemini ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as any;
  return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
}

// Strip ```json fences and parse.
export function parseJsonLoose<T>(text: string): T {
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as T;
}
