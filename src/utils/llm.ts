import type { Env } from "../types/State"

export async function callLLM(
  env: Env,
  systemPrompt: string,
  userMessage: string,
  temperature = 0.3,
  maxTokens = 800
): Promise<string> {
  try {
    const response = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature,
      max_tokens: maxTokens
    }) as { response?: string }
    return response?.response || "Запрос обработан"
  } catch {
    return "Сервис временно недоступен. Повторите позже."
  }
}
