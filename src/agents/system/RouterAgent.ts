import { Agent } from "agents"
import type { Env } from "../../types/State"

export class RouterAgent extends Agent<Env> {
  private readonly CATEGORIES = [
    "legal", "eco", "housing", "budget", "foi", "coord", "media", "monitor", "emergency"
  ] as const

  async fetch(request: Request): Promise<Response> {
    const { message } = await request.json() as { message: string }
    return Response.json({ target: await this.classify(message) })
  }

  async classify(message: string): Promise<string> {
    const response = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [
        {
          role: "system",
          content: `Ты роутер системы гражданского контроля. Верни ТОЛЬКО одно слово — slug категории.

Категории:
- legal: права граждан, нарушения закона, административные жалобы, судебные обращения, прокуратура
- eco: экология, свалки, загрязнение воды/воздуха, незаконные стройки, вырубка деревьев
- housing: ЖКХ, управляющие компании, тарифы, капремонт, аварийное жильё, общедомовые нужды
- budget: муниципальный бюджет, госзакупки, нецелевое расходование, завышение цен в контрактах
- foi: запрос информации по 8-ФЗ или 59-ФЗ, нужен шаблон обращения в орган власти
- coord: задачи команды активистов, распределение работы, кто что делает, дежурства, встречи
- media: написать пост, пресс-релиз, публикация в соцсетях, обращение к журналистам, открытое письмо
- monitor: отслеживание решений власти, изменение нормативов, публичные слушания, сессии совета
- emergency: угрозы активистам, давление власти, незаконные задержания, срочная юридическая помощь`
        },
        { role: "user", content: message }
      ],
      temperature: 0.0,
      max_tokens: 15
    }) as { response: string }

    const r = (response?.response || "").trim().toLowerCase()
    return this.CATEGORIES.includes(r as typeof this.CATEGORIES[number]) ? r : "legal"
  }
}
