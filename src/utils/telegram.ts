export async function sendTelegramMessage(
  botToken: string,
  chatId: string | number,
  text: string
): Promise<boolean> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" })
    })
    return r.ok
  } catch {
    return false
  }
}

export function parseTelegramWebhook(body: Record<string, unknown>): {
  chatId: number
  userId: number
  text: string
} | null {
  const msg = body?.message as Record<string, unknown> | undefined
  if (!msg) return null
  const from = msg.from as Record<string, unknown> | undefined
  const chat = msg.chat as Record<string, unknown> | undefined
  return {
    chatId: chat?.id as number,
    userId: from?.id as number,
    text: (msg.text as string) || ""
  }
}
