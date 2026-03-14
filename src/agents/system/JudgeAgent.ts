import { Agent } from "agents"
import type { Env, DraftEntry, QualityMetrics } from "../../types/State"

export class JudgeAgent extends Agent<Env> {
  async fetch(request: Request): Promise<Response> {
    const { draft, originalRequest } = await request.json() as {
      draft: DraftEntry
      originalRequest: string
    }
    return Response.json(await this.evaluate(draft, originalRequest))
  }

  async evaluate(draft: DraftEntry, originalRequest: string): Promise<QualityMetrics> {
    try {
      const response = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          {
            role: "system",
            content: `Оцени ответ для системы гражданского контроля. Верни ТОЛЬКО JSON:
{"completeness":0.0,"actionability":0.0,"accuracy":0.0,"hallucination_risk":0.0}

Критерии (0–1):
- completeness: полнота ответа на вопрос активиста
- actionability: конкретные следующие шаги, ссылки на порталы, шаблоны документов
- accuracy: соответствие реальным законам и процедурам РФ
- hallucination_risk: риск выдуманных фактов, несуществующих статей`
          },
          {
            role: "user",
            content: `Вопрос: ${originalRequest}\nОтвет: ${draft.response}`
          }
        ],
        temperature: 0.0,
        max_tokens: 60
      }) as { response: string }

      const m = JSON.parse(
        (response?.response || "{}").match(/\{[^}]+\}/)?.[0] || "{}"
      )
      const final_score =
        (m.completeness || 0) * 0.4 +
        (m.actionability || 0) * 0.35 +
        (m.accuracy || 0) * 0.15 -
        (m.hallucination_risk || 0) * 0.1

      return {
        completeness: m.completeness || 0.5,
        actionability: m.actionability || 0.5,
        accuracy: m.accuracy || 0.5,
        hallucination_risk: m.hallucination_risk || 0.2,
        final_score: Math.max(0, Math.min(1, final_score))
      }
    } catch {
      return {
        completeness: 0.5,
        actionability: 0.5,
        accuracy: 0.5,
        hallucination_risk: 0.2,
        final_score: 0.565
      }
    }
  }
}
