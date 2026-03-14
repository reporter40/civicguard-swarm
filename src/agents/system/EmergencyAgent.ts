import { Agent } from "agents"
import type { Env } from "../../types/State"

export class EmergencyAgent extends Agent<Env> {
  private readonly KEYWORDS = [
    "угроза", "угрожают", "опасность", "преследование", "слежка",
    "давление", "арест", "задержали", "незаконный снос", "захват",
    "поджог", "избили", "насилие", "срочно помогите"
  ]

  async fetch(request: Request): Promise<Response> {
    const { message, userId } = await request.json() as {
      message: string
      userId: string
    }

    const isEmergency = this.KEYWORDS.some(kw =>
      message.toLowerCase().includes(kw)
    )
    if (!isEmergency) return Response.json({ is_emergency: false })

    await this.notifyAdmin(message, userId)

    return Response.json({
      is_emergency: true,
      response: `🚨 <b>ЭКСТРЕННОЕ ОБРАЩЕНИЕ ПРИНЯТО</b>

Ваш сигнал зарегистрирован. Председатель совета уведомлён.

<b>Немедленные действия:</b>
• Если угроза жизни — звоните 112
• Для юридической помощи: правозащитная горячая линия ОВД-Инфо: 8-800-707-05-28 (бесплатно)
• Мемориал (ликвидирован, но дело продолжает «Мемориал» неформально): поищите местных правозащитников
• Зафиксируйте всё на видео, пришлите координатору

<b>ID обращения:</b> ${userId}-${Date.now()}`,
      priority: "critical"
    })
  }

  private async notifyAdmin(message: string, userId: string) {
    const { ADMIN_TELEGRAM_ID: aid, TELEGRAM_BOT_TOKEN: tok } = this.env
    if (!aid || !tok) return
    await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: aid,
        text: `🚨 <b>ЭКСТРЕННОЕ</b>\nАктивист: ${userId}\n${message.substring(0, 300)}`,
        parse_mode: "HTML"
      })
    })
  }
}
