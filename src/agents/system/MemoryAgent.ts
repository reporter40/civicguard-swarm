import { Agent } from "agents"
import type { Env } from "../../types/State"

export class MemoryAgent extends Agent<Env> {
  async onStart() {
    this.sql`CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT,
      message TEXT,
      category TEXT,
      response TEXT,
      status TEXT,
      score REAL,
      timestamp TEXT
    )`

    this.sql`CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      title TEXT,
      category TEXT,
      description TEXT,
      status TEXT DEFAULT 'open',
      assigned_to TEXT,
      deadline TEXT,
      documents TEXT,
      created_at TEXT,
      updated_at TEXT
    )`

    this.sql`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      case_id TEXT,
      title TEXT,
      assigned_to TEXT,
      status TEXT DEFAULT 'pending',
      due_date TEXT,
      notes TEXT,
      created_at TEXT
    )`

    this.sql`CREATE TABLE IF NOT EXISTS experience (
      id TEXT PRIMARY KEY,
      agent TEXT,
      query TEXT,
      response TEXT,
      score REAL,
      timestamp TEXT
    )`
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/save" && request.method === "POST") {
      const d = await request.json() as Record<string, unknown>
      this.sql`INSERT OR REPLACE INTO sessions VALUES (
        ${d.session_id as string}, ${d.user_id as string}, ${d.message as string},
        ${d.category as string}, ${d.response as string}, ${d.status as string},
        ${d.score as number}, ${new Date().toISOString()}
      )`
      if ((d.score as number) >= 0.75) {
        this.sql`INSERT INTO experience VALUES (
          ${"exp_" + Date.now()}, ${d.agent as string}, ${d.message as string},
          ${d.response as string}, ${d.score as number}, ${new Date().toISOString()}
        )`
      }
      return Response.json({ ok: true })
    }

    if (url.pathname === "/case" && request.method === "POST") {
      const d = await request.json() as Record<string, unknown>
      const id = `case_${Date.now()}`
      this.sql`INSERT INTO cases VALUES (
        ${id}, ${d.title as string}, ${d.category as string}, ${d.description as string},
        'open', ${d.assigned_to as string || ""}, ${d.deadline as string || ""},
        ${d.documents as string || ""}, ${new Date().toISOString()}, ${new Date().toISOString()}
      )`
      return Response.json({ ok: true, id })
    }

    if (url.pathname === "/cases") {
      const cases = this.sql<Record<string, unknown>>`
        SELECT * FROM cases ORDER BY created_at DESC LIMIT 50
      `.toArray()
      return Response.json(cases)
    }

    if (url.pathname === "/stats") {
      const total = this.sql<{ c: number }>`SELECT COUNT(*) c FROM sessions`.toArray()[0]?.c || 0
      const resolved = this.sql<{ c: number }>`SELECT COUNT(*) c FROM sessions WHERE status='resolved'`.toArray()[0]?.c || 0
      const open_cases = this.sql<{ c: number }>`SELECT COUNT(*) c FROM cases WHERE status='open'`.toArray()[0]?.c || 0
      return Response.json({ total, resolved, open_cases, automation_rate: total > 0 ? resolved / total : 0 })
    }

    return Response.json({ error: "not found" }, { status: 404 })
  }
}
