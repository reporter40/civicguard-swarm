// Типы: CivicGuard — система гражданского контроля

export type ActivistRequest = {
  user_id: string
  session_id: string
  message: string
  channel: "telegram" | "web" | "api"
  timestamp: string
  metadata?: Record<string, unknown>
}

export type AppState = {
  session_id: string
  user_id: string
  original_request: ActivistRequest
  routing_target: string
  iterations: number
  drafts_history: DraftEntry[]
  memory_kv: Record<string, unknown>
  final_response?: string
  status: "pending" | "processing" | "resolved" | "escalated" | "emergency"
  category?: string
}

export type DraftEntry = {
  id: string
  agent: string
  iteration: number
  response: string
  approved: boolean
  score?: number
  timestamp: string
}

export type QualityMetrics = {
  completeness: number
  actionability: number
  accuracy: number
  hallucination_risk: number
  final_score: number
}

export type RouteCategory =
  | "legal"
  | "eco"
  | "housing"
  | "budget"
  | "foi"
  | "coord"
  | "media"
  | "monitor"
  | "emergency"

export interface Env {
  AI: Ai
  TELEGRAM_BOT_TOKEN: string
  ADMIN_TELEGRAM_ID: string
  MainOrchestrator: DurableObjectNamespace
  RouterAgent: DurableObjectNamespace
  JudgeAgent: DurableObjectNamespace
  EmergencyAgent: DurableObjectNamespace
  MemoryAgent: DurableObjectNamespace
  LegalAgent: DurableObjectNamespace
  EcoAgent: DurableObjectNamespace
  HousingAgent: DurableObjectNamespace
  BudgetAgent: DurableObjectNamespace
  FOIAgent: DurableObjectNamespace
  CoordAgent: DurableObjectNamespace
  MediaAgent: DurableObjectNamespace
  MonitorAgent: DurableObjectNamespace
}
