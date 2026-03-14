import { routeAgentRequest } from "agents"
import { parseTelegramWebhook, sendTelegramMessage } from "./utils/telegram"
import type { ActivistRequest, Env } from "./types/State"

export { MainOrchestrator } from "./agents/orchestrator/MainOrchestrator"
export { RouterAgent }      from "./agents/system/RouterAgent"
export { JudgeAgent }       from "./agents/system/JudgeAgent"
export { EmergencyAgent }   from "./agents/system/EmergencyAgent"
export { MemoryAgent }      from "./agents/system/MemoryAgent"
export {
  LegalAgent, EcoAgent, HousingAgent, BudgetAgent,
  FOIAgent, CoordAgent, MediaAgent, MonitorAgent
} from "./agents/departments/index"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
}

const WELCOME = `👋 <b>CivicGuard</b> — система поддержки гражданских активистов

Я помогаю совету активистов:
⚖️ <b>Правозащита</b> — жалобы, обращения, суды
🌿 <b>Экология</b> — свалки, загрязнение, вырубки
🏠 <b>ЖКХ-контроль</b> — тарифы, УК, капремонт
💰 <b>Бюджет</b> — госзакупки, нарушения расходов
📄 <b>Запросы по 8-ФЗ/59-ФЗ</b> — шаблоны документов
👥 <b>Координация</b> — задачи команды
📢 <b>Медиа</b> — посты, пресс-релизы
🔍 <b>Мониторинг</b> — решения власти, слушания

Просто опишите ситуацию или задайте вопрос.`

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })
    const url = new URL(request.url)

    // Health
    if (url.pathname === "/api/health") {
      return Response.json({
        status: "ok",
        service: "CivicGuard — гражданский контроль",
        agents: 13,
        timestamp: new Date().toISOString()
      }, { headers: CORS })
    }

    // Main API endpoint (also handles Telegram webhook)
    if (url.pathname === "/api/request" && request.method === "POST") {
      const body = await request.json() as Record<string, unknown>

      // Telegram webhook detection
      if (body.update_id !== undefined) {
        const tg = parseTelegramWebhook(body)
        if (!tg?.text) return new Response("ok")

        if (tg.text === "/start" || tg.text === "/help") {
          await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, tg.chatId, WELCOME)
          return new Response("ok")
        }

        const req: ActivistRequest = {
          user_id: String(tg.userId),
          session_id: `tg-${tg.userId}-${Date.now()}`,
          message: tg.text,
          channel: "telegram",
          timestamp: new Date().toISOString()
        }

        try {
          const o = env.MainOrchestrator.get(env.MainOrchestrator.idFromName("main"))
          const state = await o.fetch(new Request("https://worker/handle", {
            method: "POST",
            body: JSON.stringify(req)
          })).then(r => r.json()) as { final_response?: string; status: string }

          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            tg.chatId,
            state.final_response || "Запрос принят. Ожидайте ответа."
          )
        } catch {
          await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, tg.chatId, "⚠️ Ошибка. Попробуйте позже.")
        }
        return new Response("ok")
      }

      // Direct API call
      const req = body as unknown as ActivistRequest
      if (!req.user_id || !req.message) {
        return Response.json({ error: "user_id и message обязательны" }, { status: 400, headers: CORS })
      }
      if (!req.session_id) req.session_id = `api-${req.user_id}-${Date.now()}`
      if (!req.channel) req.channel = "api"
      if (!req.timestamp) req.timestamp = new Date().toISOString()

      const o = env.MainOrchestrator.get(env.MainOrchestrator.idFromName("main"))
      const state = await o.fetch(new Request("https://worker/handle", {
        method: "POST",
        body: JSON.stringify(req)
      })).then(r => r.json())

      return Response.json(state, { headers: CORS })
    }

    // Stats
    if (url.pathname === "/api/stats") {
      const o = env.MainOrchestrator.get(env.MainOrchestrator.idFromName("main"))
      const stats = await o.fetch(new Request("https://worker/stats")).then(r => r.json())
      return Response.json(stats, { headers: CORS })
    }

    // Cases (дела активистов)
    if (url.pathname === "/api/cases") {
      const m = env.MemoryAgent.get(env.MemoryAgent.idFromName("memory"))
      const cases = await m.fetch(new Request("https://worker/cases")).then(r => r.json())
      return Response.json(cases, { headers: CORS })
    }

    if (url.pathname === "/api/cases" && request.method === "POST") {
      const body = await request.json()
      const m = env.MemoryAgent.get(env.MemoryAgent.idFromName("memory"))
      const result = await m.fetch(new Request("https://worker/case", {
        method: "POST",
        body: JSON.stringify(body)
      })).then(r => r.json())
      return Response.json(result, { headers: CORS })
    }

    // Watchlist (мониторинг решений)
    if (url.pathname === "/api/watchlist") {
      const mon = env.MonitorAgent.get(env.MonitorAgent.idFromName("monitor"))
      const list = await mon.fetch(new Request("https://worker/watchlist")).then(r => r.json())
      return Response.json(list, { headers: CORS })
    }

    const ar = await routeAgentRequest(request, env)
    if (ar) return ar

    return Response.json({ status: "ok", service: "CivicGuard" }, { headers: CORS })
  }
}
