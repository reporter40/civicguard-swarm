import { Agent } from "agents"
import type { Env, ActivistRequest, AppState } from "../../types/State"

const AGENT_MAP: Record<string, string> = {
    legal: "LegalAgent",
    eco: "EcoAgent",
    housing: "HousingAgent",
    budget: "BudgetAgent",
    foi: "FOIAgent",
    coord: "CoordAgent",
    media: "MediaAgent",
    monitor: "MonitorAgent"
}

const JUDGE_THRESHOLD = 0.75
const MAX_ITERATIONS = 3

export class MainOrchestrator extends Agent<Env> {
    private tableReady = false

  private ensureTable() {
        if (this.tableReady) return
        this.sql`CREATE TABLE IF NOT EXISTS sessions (
              session_id TEXT PRIMARY KEY,
                    user_id TEXT,
                          message TEXT,
                                channel TEXT,
                                      category TEXT,
                                            response TEXT,
                                                  status TEXT DEFAULT 'pending',
                                                        iterations INTEGER DEFAULT 0,
                                                              score REAL,
                                                                    created_at TEXT,
                                                                          resolved_at TEXT
                                                                              )`
        this.tableReady = true
  }

  async onStart() {
        this.ensureTable()
  }

  async fetch(request: Request): Promise<Response> {
        this.ensureTable()
        const url = new URL(request.url)
        if (url.pathname === "/handle" && request.method === "POST") {
                const req = await request.json() as ActivistRequest
                return Response.json(await this.handleRequest(req))
        }
        if (url.pathname === "/stats") {
                return Response.json(await this.getStats())
        }
        return Response.json({ error: "not found" }, { status: 404 })
  }

  async handleRequest(req: ActivistRequest): Promise<AppState> {
        this.ensureTable()
        // 1. Сохранить сессию
      this.sql`INSERT OR REPLACE INTO sessions (session_id, user_id, message, channel, status, created_at)
            VALUES (${req.session_id}, ${req.user_id}, ${req.message}, ${req.channel}, 'processing', ${new Date().toISOString()})`

      let state: AppState = {
              session_id: req.session_id,
              user_id: req.user_id,
              original_request: req,
              routing_target: "route",
              iterations: 0,
              drafts_history: [],
              memory_kv: {},
              status: "processing"
      }

      // 2. EmergencyAgent check (без LLM, мгновенно)
      try {
              const emergencyStub = this.env.EmergencyAgent.get(
                        this.env.EmergencyAgent.idFromName("emergency")
                      )
              const eResp = await emergencyStub.fetch(
                        new Request("https://worker/handle", {
                                    method: "POST",
                                    body: JSON.stringify({ message: req.message, userId: req.user_id })
                        })
                      )
              const eData = await eResp.json() as { is_emergency: boolean; response?: string }
              if (eData.is_emergency) {
                        state.status = "emergency"
                        state.final_response = eData.response
                        this.sql`UPDATE sessions SET status='emergency', response=${state.final_response || ""}, resolved_at=${new Date().toISOString()} WHERE session_id=${state.session_id}`
                        return state
              }
      } catch { /* продолжаем */ }

      // 3. RouterAgent classify
      let category = "legal"
        try {
                const routerStub = this.env.RouterAgent.get(
                          this.env.RouterAgent.idFromName("router")
                        )
                const rResp = await routerStub.fetch(
                          new Request("https://worker/classify", {
                                      method: "POST",
                                      body: JSON.stringify({ message: req.message })
                          })
                        )
                const rData = await rResp.json() as { target: string }
                category = rData.target
        } catch { category = "legal" }

      state.category = category
        state.routing_target = category

      // 4. Основной цикл: Department → Judge → retry
      while (state.iterations < MAX_ITERATIONS) {
              state.iterations++
              const agentClass = AGENT_MAP[state.routing_target]
              if (!agentClass) {
                        state.status = "escalated"
                        state.final_response = "Запрос передан координатору. Ответ поступит в ближайшее время."
                        break
              }

          // Вызов профильного агента
          let draft = null
              try {
                        const binding = this.env[agentClass as keyof Env] as DurableObjectNamespace
                        const stub = binding.get(binding.idFromName(state.routing_target))
                        const dResp = await stub.fetch(
                                    new Request("https://worker/process", {
                                                  method: "POST",
                                                  body: JSON.stringify(state)
                                    })
                                  )
                        draft = await dResp.json()
              } catch (e) {
                        state.status = "escalated"
                        state.final_response = "Временная ошибка. Обратитесь к координатору напрямую."
                        break
              }

          if (!draft) break
              state.drafts_history.push(draft)

          // JudgeAgent оценка
          let score = 0.8
              try {
                        const judgeStub = this.env.JudgeAgent.get(
                                    this.env.JudgeAgent.idFromName("judge")
                                  )
                        const jResp = await judgeStub.fetch(
                                    new Request("https://worker/evaluate", {
                                                  method: "POST",
                                                  body: JSON.stringify({ draft, originalRequest: req.message })
                                    })
                                  )
                        const jData = await jResp.json() as { final_score: number }
                        score = jData.final_score
              } catch { score = 0.8 }

          if (score >= JUDGE_THRESHOLD) {
                    state.status = "resolved"
                    state.final_response = (draft as { response: string }).response
                    break
          } else {
                    state.memory_kv.improve_instruction = `Оценка ${score.toFixed(2)} — недостаточно конкретно. Добавь: конкретные порталы и ссылки, пошаговый алгоритм действий, сроки и статьи законов.`
          }
      }

      // 5. Stop-loss
      if (!state.final_response) {
              state.status = "escalated"
              const best = state.drafts_history.sort((a, b) => (b.score || 0) - (a.score || 0))[0]
              state.final_response = best
                ? (best as { response: string }).response
                        : "Запрос требует внимания координатора. Свяжитесь напрямую."
      }

      // 6. Сохранить результат
      this.sql`UPDATE sessions SET status=${state.status}, category=${state.category || "unknown"}, response=${state.final_response || ""}, iterations=${state.iterations}, resolved_at=${new Date().toISOString()} WHERE session_id=${state.session_id}`

      return state
  }

  async getStats(): Promise<unknown> {
        this.ensureTable()
        const total = this.sql<{ c: number }>`SELECT COUNT(*) c FROM sessions`.toArray()[0]?.c || 0
        const resolved = this.sql<{ c: number }>`SELECT COUNT(*) c FROM sessions WHERE status='resolved'`.toArray()[0]?.c || 0
        const emergency= this.sql<{ c: number }>`SELECT COUNT(*) c FROM sessions WHERE status='emergency'`.toArray()[0]?.c || 0
        const cats = this.sql<{ category: string; c: number }>`
              SELECT category, COUNT(*) c FROM sessions GROUP BY category ORDER BY c DESC
                  `.toArray()
        return {
                total,
                resolved,
                emergency,
                pending: total - resolved - emergency,
                automation_rate: total > 0 ? (resolved / total).toFixed(2) : 0,
                by_category: cats
        }
  }
}
