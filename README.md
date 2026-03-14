# 🛡️ CivicGuard — AI-рой для гражданского контроля

> Система поддержки совета активистов муниципалитета.
> Основана на архитектуре «Умный Дмитров» (задеплоен 12.03.2026).

---

## Что умеет система

**13 агентов** обрабатывают запросы активистов по 8 направлениям:

| Агент | Направление | Что делает |
|-------|-------------|------------|
| `LegalAgent` | ⚖️ Правозащита | Жалобы, обращения в прокуратуру, суды, нарушения прав |
| `EcoAgent` | 🌿 Экология | Свалки, загрязнение воды/воздуха, вырубки, Росприроднадзор |
| `HousingAgent` | 🏠 ЖКХ-контроль | Тарифы, управляющие компании, капремонт, ГЖИ |
| `BudgetAgent` | 💰 Бюджет/закупки | Госзакупки, нецелевые расходы, ФАС, Счётная палата |
| `FOIAgent` | 📄 Запросы по 8-ФЗ | Шаблоны запросов информации, 59-ФЗ обращения |
| `CoordAgent` | 👥 Координация | Задачи команды, планы кампаний, распределение работ |
| `MediaAgent` | 📢 Медиа | Посты, пресс-релизы, открытые письма, обращения к СМИ |
| `MonitorAgent` | 🔍 Мониторинг | Решения власти, публичные слушания, изменения нормативов |
| `EmergencyAgent` | 🚨 Экстренный | Угрозы активистам — bypass без LLM, мгновенный ответ |

**Системные агенты:** RouterAgent, JudgeAgent (порог 0.75), MemoryAgent (дела + задачи)

---

## Граф обработки запроса

```
Запрос активиста
  → EmergencyAgent (keyword-bypass, без LLM)
  → RouterAgent (классификация, temp 0.0)
  → Department Agent (нишевый промпт + база знаний)
  → JudgeAgent (score >= 0.75 → approved)
  ↑_______________________________________↓ retry (max 3)
  → MemoryAgent.save() → ответ
```

---

## Деплой

```bash
chmod +x setup.sh && ./setup.sh
```

**Требования:**
- Аккаунт Cloudflare (бесплатный tier работает)
- Hiddify на порту 12334 (обязателен для wrangler deploy из РФ)
- Node.js 18+

**Ручной деплой:**
```bash
export HTTPS_PROXY=http://127.0.0.1:12334
npm install
npm run deploy
echo "YOUR_TOKEN" | npx wrangler secret put TELEGRAM_BOT_TOKEN
echo "YOUR_CHAT_ID" | npx wrangler secret put ADMIN_TELEGRAM_ID
curl "https://api.telegram.org/bot$TOKEN/setWebhook?url=https://civicguard-swarm.workers.dev/api/request"
```

---

## API

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/health` | Статус системы |
| `POST` | `/api/request` | Запрос активиста + Telegram webhook |
| `GET` | `/api/stats` | Статистика: всего, решено, по категориям |
| `GET` | `/api/cases` | Список открытых дел |
| `POST` | `/api/cases` | Создать новое дело |
| `GET` | `/api/watchlist` | Список объектов мониторинга |

**Пример запроса:**
```bash
curl -X POST https://civicguard-swarm.workers.dev/api/request \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "activist-1",
    "message": "Как запросить у администрации договор управления нашим домом?"
  }'
```

---

## База знаний

Предзагружена в `src/knowledge/knowledge.ts`:
- Ключевые законы: 59-ФЗ, 8-ФЗ, 131-ФЗ, 44-ФЗ, 7-ФЗ и другие
- Порталы: zakupki.gov.ru, bus.gov.ru, dom.gosuslugi.ru, rpn.gov.ru
- Шаблоны запросов и жалоб
- Признаки нарушений в госзакупках
- Органы контроля с полномочиями

**Для добавления знаний** — отредактируйте `src/knowledge/knowledge.ts` и передеплойте.

---

## ROI

| Метрика | До | После |
|---------|-----|-------|
| Время подготовки запроса | 1–3 часа | < 30 секунд |
| Доступность | только рабочие часы | 24/7 |
| Стоимость ответа | 0 (волонтёры) | ~0 (Workers AI бесплатен) |
| Пропускная способность | 5–10 запросов/день | неограниченно |
| Серверы | не нужны | Cloudflare Workers |

---

## Критические уроки деплоя

| # | Проблема | Решение |
|---|---------|---------|
| 1 | `EPIPE` при `wrangler deploy` | `export HTTPS_PROXY=http://127.0.0.1:12334` |
| 2 | Конфликт secret/vars | Убрать из `vars` в wrangler.jsonc, потом `secret put` |
| 3 | SQLite в DO | Инициализация только в `onStart()` |
| 4 | Workers AI timeout | `max_tokens: 800` максимум |
| 5 | TypeScript ошибки `@types/node` | Уже добавлен в devDependencies |
