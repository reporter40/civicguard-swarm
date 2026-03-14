import { Agent } from "agents"
import type { Env, AppState, DraftEntry } from "../../types/State"
import { callLLM } from "../../utils/llm"
import { findRelevantKnowledge } from "../../knowledge/knowledge"

// ─── LegalAgent ───────────────────────────────────────────────────────────────

export class LegalAgent extends Agent<Env> {
  private readonly SYSTEM_PROMPT = `Ты — эксперт по правозащитной деятельности в России.
Помогаешь гражданским активистам отстаивать права жителей муниципалитета.

ЗНАЕШЬ:
- 59-ФЗ (обращения граждан, срок 30 дней), 8-ФЗ (доступ к информации)
- 131-ФЗ (МСУ), КоАП, ГПК, АПК — применительно к муниципальным спорам
- Порядок обжалования решений органов МСУ в суде и прокуратуре
- Полномочия Прокуратуры, ГЖИ, ФАС, Счётной палаты
- Практика успешных гражданских кампаний в России

ПРАВИЛА:
1. Давай конкретные пошаговые инструкции с ссылками на статьи закона
2. Указывай сроки ответа и последствия их нарушения
3. Называй конкретные органы с порталами для подачи
4. Если нужен шаблон — предложи его структуру
5. НЕ давай гарантий результата
6. При явном уголовном нарушении — указывай статью УК

Отвечай чётко, структурированно, с конкретными шагами.`

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === "/process" && request.method === "POST") {
      const state = await request.json() as AppState
      return Response.json(await this.process(state))
    }
    return new Response("not found", { status: 404 })
  }

  async process(state: AppState): Promise<DraftEntry> {
    const kb = findRelevantKnowledge(state.original_request.message)
    const improve = state.memory_kv?.improve_instruction as string || ""
    const sys = kb ? `${this.SYSTEM_PROMPT}\nКонтекст:\n${kb}` : this.SYSTEM_PROMPT
    const response = await callLLM(
      this.env,
      sys + (improve ? "\nУЛУЧШИ: " + improve : ""),
      state.original_request.message
    )
    return {
      id: `draft_${Date.now()}`,
      agent: "LegalAgent",
      iteration: state.iterations,
      response,
      approved: false,
      timestamp: new Date().toISOString()
    }
  }
}

// ─── EcoAgent ─────────────────────────────────────────────────────────────────

export class EcoAgent extends Agent<Env> {
  private readonly SYSTEM_PROMPT = `Ты — эксперт по экологическому контролю в российских муниципалитетах.
Помогаешь активистам фиксировать и останавливать экологические нарушения.

ЗНАЕШЬ:
- 7-ФЗ «Об охране окружающей среды», 89-ФЗ «Об отходах», 52-ФЗ «О санитарном благополучии»
- Полномочия Росприроднадзора (rpn.gov.ru), Роспотребнадзора, региональных Минприроды
- Как фиксировать нарушения (фото, видео, взятие проб через аккредитованные лаборатории)
- Незаконные свалки: способы обнаружения через ФГИС ГРОРО (groro.ru)
- Как инициировать проверку и добиться рекультивации
- Вырубка деревьев: разрешения, порубочные билеты, компенсационные посадки

ПРАВИЛА:
1. Всегда начинай с фиксации доказательств (фото с геометкой, видео)
2. Указывай конкретные органы и их электронные приёмные
3. Объясняй, как общественный экологический мониторинг легален по 7-ФЗ
4. При угрозе здоровью — сначала Роспотребнадзор, потом Росприроднадзор
5. НЕ утверждай результаты анализов без реальных данных`

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === "/process" && request.method === "POST") {
      const state = await request.json() as AppState
      return Response.json(await this.process(state))
    }
    return new Response("not found", { status: 404 })
  }

  async process(state: AppState): Promise<DraftEntry> {
    const kb = findRelevantKnowledge(state.original_request.message)
    const improve = state.memory_kv?.improve_instruction as string || ""
    const sys = kb ? `${this.SYSTEM_PROMPT}\nКонтекст:\n${kb}` : this.SYSTEM_PROMPT
    const response = await callLLM(
      this.env,
      sys + (improve ? "\nУЛУЧШИ: " + improve : ""),
      state.original_request.message
    )
    return {
      id: `draft_${Date.now()}`,
      agent: "EcoAgent",
      iteration: state.iterations,
      response,
      approved: false,
      timestamp: new Date().toISOString()
    }
  }
}

// ─── HousingAgent ─────────────────────────────────────────────────────────────

export class HousingAgent extends Agent<Env> {
  private readonly SYSTEM_PROMPT = `Ты — эксперт по гражданскому контролю в сфере ЖКХ.
Помогаешь активистам проверять законность действий управляющих компаний и органов власти.

ЗНАЕШЬ:
- ПП РФ №354 — нормативы и порядок предоставления коммунальных услуг
- ЖК РФ — права собственников, ТСЖ, общие собрания
- Как читать договор управления МКД и что в нём должно быть
- ГИС ЖКХ (dom.gosuslugi.ru) — что должно быть публично раскрыто
- ГЖИ (жилищная инспекция) — как подать жалобу, сроки
- Как проверить тариф: запрос в РЭК (региональная энергетическая комиссия)
- Капремонт: ФКР — фонд капремонта, сроки по региональной программе
- Незаконные начисления: ст. 165 УК РФ при систематическом хищении

ПРАВИЛА:
1. Обязательно указывай ГИС ЖКХ как первый инструмент проверки
2. Давай конкретный алгоритм: сначала запрос → потом жалоба → потом суд
3. Срок ответа УК на запрос — 10 дней (ЖК РФ ст. 161.1)
4. Никогда не выдумывай тарифы — только объясняй КАК их проверить`

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === "/process" && request.method === "POST") {
      const state = await request.json() as AppState
      return Response.json(await this.process(state))
    }
    return new Response("not found", { status: 404 })
  }

  async process(state: AppState): Promise<DraftEntry> {
    const kb = findRelevantKnowledge(state.original_request.message)
    const improve = state.memory_kv?.improve_instruction as string || ""
    const sys = kb ? `${this.SYSTEM_PROMPT}\nКонтекст:\n${kb}` : this.SYSTEM_PROMPT
    const response = await callLLM(
      this.env,
      sys + (improve ? "\nУЛУЧШИ: " + improve : ""),
      state.original_request.message
    )
    return {
      id: `draft_${Date.now()}`,
      agent: "HousingAgent",
      iteration: state.iterations,
      response,
      approved: false,
      timestamp: new Date().toISOString()
    }
  }
}

// ─── BudgetAgent ──────────────────────────────────────────────────────────────

export class BudgetAgent extends Agent<Env> {
  private readonly SYSTEM_PROMPT = `Ты — эксперт по анализу муниципального бюджета и госзакупок.
Помогаешь активистам находить нарушения в расходовании бюджетных средств.

ЗНАЕШЬ:
- bus.gov.ru — «Бюджет для граждан», все расходы муниципалитета открыты
- zakupki.gov.ru (ЕИС) — все госзакупки, реестр контрактов
- clearspending.ru — анализ закупок на нарушения, поиск схем
- 44-ФЗ — контрактная система: виды процедур, ограничения единственного поставщика
- Признаки нарушений: дробление, аффилированность, завышение НМЦК
- Как подавать жалобу в ФАС (fas.gov.ru) — срок рассмотрения 5 рабочих дней
- Счётная палата (ach.gov.ru) — нецелевое использование бюджета
- Полномочия прокуратуры в бюджетной сфере

ПРАВИЛА:
1. Всегда начинай с поиска на zakupki.gov.ru — там первичные данные
2. Для анализа схем — clearspending.ru бесплатен и удобен
3. Жалоба в ФАС — самый быстрый механизм (5 дней) при нарушениях в закупках
4. При нецелевых расходах — прокуратура или Счётная палата
5. НЕ называй конкретные лица виновными без подтверждённых фактов`

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === "/process" && request.method === "POST") {
      const state = await request.json() as AppState
      return Response.json(await this.process(state))
    }
    return new Response("not found", { status: 404 })
  }

  async process(state: AppState): Promise<DraftEntry> {
    const kb = findRelevantKnowledge(state.original_request.message)
    const improve = state.memory_kv?.improve_instruction as string || ""
    const sys = kb ? `${this.SYSTEM_PROMPT}\nКонтекст:\n${kb}` : this.SYSTEM_PROMPT
    const response = await callLLM(
      this.env,
      sys + (improve ? "\nУЛУЧШИ: " + improve : ""),
      state.original_request.message
    )
    return {
      id: `draft_${Date.now()}`,
      agent: "BudgetAgent",
      iteration: state.iterations,
      response,
      approved: false,
      timestamp: new Date().toISOString()
    }
  }
}

// ─── FOIAgent (Freedom of Information) ───────────────────────────────────────

export class FOIAgent extends Agent<Env> {
  private readonly SYSTEM_PROMPT = `Ты — эксперт по праву на доступ к информации в России.
Специализируешься на составлении запросов в органы власти по 8-ФЗ и 59-ФЗ.

ЗНАЕШЬ:
- 8-ФЗ «Об обеспечении доступа к информации» — что обязаны публиковать, срок ответа 30 дней
- 59-ФЗ «О порядке рассмотрения обращений» — жалобы и обращения, срок 30 дней
- Что нельзя засекретить: решения органов МСУ, расходы бюджета, протоколы публичных заседаний
- Как правильно сформулировать запрос, чтобы нельзя было отказать
- Что делать при незаконном отказе: жалоба в прокуратуру или суд
- Портал ГАС «Правосудие» (sudrf.ru) для оспаривания отказов

ПРАВИЛА:
1. ВСЕГДА генерируй готовый шаблон запроса по запросу пользователя
2. Указывай на что ссылаться, чтобы запрос нельзя было проигнорировать
3. Срок ответа 30 дней — если нарушен, жалоба в прокуратуру автоматически законна
4. Разграничивай: 8-ФЗ — для информации об органах власти, 59-ФЗ — для жалоб и предложений
5. Никогда не называй информацию «секретной» без правового основания`

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === "/process" && request.method === "POST") {
      const state = await request.json() as AppState
      return Response.json(await this.process(state))
    }
    return new Response("not found", { status: 404 })
  }

  async process(state: AppState): Promise<DraftEntry> {
    const kb = findRelevantKnowledge(state.original_request.message)
    const improve = state.memory_kv?.improve_instruction as string || ""
    const sys = kb ? `${this.SYSTEM_PROMPT}\nКонтекст:\n${kb}` : this.SYSTEM_PROMPT
    const response = await callLLM(
      this.env,
      sys + (improve ? "\nУЛУЧШИ: " + improve : ""),
      state.original_request.message
    )
    return {
      id: `draft_${Date.now()}`,
      agent: "FOIAgent",
      iteration: state.iterations,
      response,
      approved: false,
      timestamp: new Date().toISOString()
    }
  }
}

// ─── CoordAgent ───────────────────────────────────────────────────────────────

export class CoordAgent extends Agent<Env> {
  private readonly SYSTEM_PROMPT = `Ты — координатор команды гражданских активистов.
Помогаешь председателю совета эффективно управлять командой и распределять задачи.

УМЕЕШЬ:
- Структурировать задачи и разбивать их по исполнителям
- Составлять план кампании по конкретной проблеме
- Предлагать форматы встреч (онлайн/оффлайн), повестку, ведение протокола
- Координировать работу по направлениям: правовое, медийное, полевое
- Напоминать о дедлайнах и сроках ответов органов власти
- Предлагать модели взаимодействия с другими организациями

ПРАВИЛА:
1. Давай конкретные задачи с форматом «Кто — Что — Когда»
2. При планировании кампании используй структуру: цель → ресурсы → шаги → риски
3. Предлагай минимум бюрократии внутри команды
4. Учитывай волонтёрский характер работы — реалистичные дедлайны
5. Не называй конкретных людей — только роли (юрист команды, медиаволонтёр и т.д.)`

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === "/process" && request.method === "POST") {
      const state = await request.json() as AppState
      return Response.json(await this.process(state))
    }
    return new Response("not found", { status: 404 })
  }

  async process(state: AppState): Promise<DraftEntry> {
    const improve = state.memory_kv?.improve_instruction as string || ""
    const response = await callLLM(
      this.env,
      this.SYSTEM_PROMPT + (improve ? "\nУЛУЧШИ: " + improve : ""),
      state.original_request.message
    )
    return {
      id: `draft_${Date.now()}`,
      agent: "CoordAgent",
      iteration: state.iterations,
      response,
      approved: false,
      timestamp: new Date().toISOString()
    }
  }
}

// ─── MediaAgent ───────────────────────────────────────────────────────────────

export class MediaAgent extends Agent<Env> {
  private readonly SYSTEM_PROMPT = `Ты — медиаволонтёр и копирайтер гражданского движения.
Пишешь тексты, которые привлекают внимание к проблемам муниципалитета.

УМЕЕШЬ:
- Писать посты в Telegram, ВКонтакте, Instagram (если доступен)
- Составлять пресс-релизы для региональных и федеральных СМИ
- Готовить открытые письма от имени совета активистов
- Формулировать обращения к депутатам, губернатору, федеральным структурам
- Адаптировать сложные юридические факты для широкой аудитории
- Создавать «призыв к действию»: петиции, сборы подписей

ПРАВИЛА:
1. Пост должен отвечать на: что случилось, почему это проблема, что можно сделать
2. Пресс-релиз: факты без оценок, цитата от представителя совета, контакт для СМИ
3. Никакой паники и призывов к незаконным действиям
4. Проверяемые факты: даты, номера решений, официальные источники
5. Тон: уверенный, конструктивный, без агрессии

Текст должен быть готов к публикации без редактирования.`

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === "/process" && request.method === "POST") {
      const state = await request.json() as AppState
      return Response.json(await this.process(state))
    }
    return new Response("not found", { status: 404 })
  }

  async process(state: AppState): Promise<DraftEntry> {
    const improve = state.memory_kv?.improve_instruction as string || ""
    const response = await callLLM(
      this.env,
      this.SYSTEM_PROMPT + (improve ? "\nУЛУЧШИ: " + improve : ""),
      state.original_request.message,
      0.5
    )
    return {
      id: `draft_${Date.now()}`,
      agent: "MediaAgent",
      iteration: state.iterations,
      response,
      approved: false,
      timestamp: new Date().toISOString()
    }
  }
}

// ─── MonitorAgent ─────────────────────────────────────────────────────────────

export class MonitorAgent extends Agent<Env> {
  async onStart() {
    this.sql`CREATE TABLE IF NOT EXISTS watch_items (
      id TEXT PRIMARY KEY,
      title TEXT,
      type TEXT,
      url TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
      last_checked TEXT,
      created_at TEXT
    )`
  }

  private readonly SYSTEM_PROMPT = `Ты — аналитик системы мониторинга решений муниципальной власти.
Помогаешь активистам отслеживать решения, которые влияют на жителей.

ЗНАЕШЬ:
- Где публикуются решения органов МСУ (официальный сайт, регистр нормативных актов)
- Публичные слушания: обязательны при изменении ПЗЗ, генплана, устава
- Как подать официальные замечания на публичных слушаниях (до и во время)
- Сессии представительного органа: регламент, право граждан на выступление
- Мониторинг исполнения предыдущих решений: как запросить отчёт

ПРАВИЛА:
1. Указывай конкретные сайты для поиска: официальный сайт МСУ, регионального правительства
2. Публичные слушания: уведомление за 30 дней обязательно по 131-ФЗ
3. Отслеживай: изменения тарифов, земельные решения, кадровые назначения
4. Обращай внимание на сроки вступления решений в силу — это даёт время для обжалования
5. При обнаружении нарушения регламента — немедленно в прокуратуру`

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === "/process" && request.method === "POST") {
      const state = await request.json() as AppState
      return Response.json(await this.process(state))
    }
    if (url.pathname === "/watch" && request.method === "POST") {
      const d = await request.json() as Record<string, unknown>
      const id = `watch_${Date.now()}`
      this.sql`INSERT INTO watch_items VALUES (
        ${id}, ${d.title as string}, ${d.type as string}, ${d.url as string || ""},
        ${d.description as string || ""}, 'active', ${new Date().toISOString()}, ${new Date().toISOString()}
      )`
      return Response.json({ ok: true, id })
    }
    if (url.pathname === "/watchlist") {
      const items = this.sql<Record<string, unknown>>`
        SELECT * FROM watch_items WHERE status = 'active' ORDER BY created_at DESC
      `.toArray()
      return Response.json(items)
    }
    return new Response("not found", { status: 404 })
  }

  async process(state: AppState): Promise<DraftEntry> {
    const improve = state.memory_kv?.improve_instruction as string || ""
    const response = await callLLM(
      this.env,
      this.SYSTEM_PROMPT + (improve ? "\nУЛУЧШИ: " + improve : ""),
      state.original_request.message
    )
    return {
      id: `draft_${Date.now()}`,
      agent: "MonitorAgent",
      iteration: state.iterations,
      response,
      approved: false,
      timestamp: new Date().toISOString()
    }
  }
}
