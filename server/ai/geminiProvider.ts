import { VertexAI } from "@google-cloud/vertexai";
import type { AggregatedMetrics, InsightCard } from "@shared/types";
import type { InsightProvider } from "./insightProvider";
import { RuleProvider } from "./ruleProvider";

const SYSTEM = `너는 반려견 건강 코치다. 주어진 '정확히 계산된' 지표만 근거로 한국어 인사이트 카드를 만든다.
- 숫자를 새로 계산하지 말고 주어진 값만 인용한다.
- 약물/질환 관련이면 disclaimer에 "참고용이며 수의사 상담을 대체하지 않습니다"를 넣는다.
- 출력은 JSON 배열. 각 항목: {severity:"red"|"yellow"|"green", title, evidence, recommendedAction, disclaimer?}. 1~4개.`;

const MODEL = process.env.VERTEX_MODEL ?? "gemini-2.0-flash";

export class GeminiProvider implements InsightProvider {
  private fallback = new RuleProvider();
  async generate(m: AggregatedMetrics, ctx: { breed?: string; ageYears?: number; conditions?: string[] }): Promise<InsightCard[]> {
    if (m.daysOfData < 3) return this.fallback.generate(m, ctx);
    try {
      const vertex = new VertexAI({ project: process.env.GOOGLE_CLOUD_PROJECT!, location: process.env.VERTEX_LOCATION ?? "us-central1" });
      const model = vertex.getGenerativeModel({ model: MODEL, systemInstruction: SYSTEM });
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
