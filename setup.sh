#!/bin/bash
set -e

echo "🛡️  CivicGuard — система гражданского контроля"
echo "================================================"
echo ""

npm install
npx wrangler types

echo ""
echo "⏳ Авторизация в Cloudflare..."
export HTTPS_PROXY=http://127.0.0.1:12334
npx wrangler login

echo ""
echo "🔑 Секреты (Enter — пропустить):"
read -p "Telegram Bot Token: " T
[ -n "$T" ] && echo "$T" | npx wrangler secret put TELEGRAM_BOT_TOKEN

read -p "Admin Telegram ID (ваш chat_id): " A
[ -n "$A" ] && echo "$A" | npx wrangler secret put ADMIN_TELEGRAM_ID

echo ""
echo "🚀 Деплой..."
npm run deploy

echo ""
echo "✅ CivicGuard задеплоен!"
echo "🌐 URL: https://civicguard-swarm.workers.dev"
echo ""
echo "Установить Telegram webhook:"
echo "  curl \"https://api.telegram.org/bot\$TELEGRAM_BOT_TOKEN/setWebhook?url=https://civicguard-swarm.workers.dev/api/request\""
echo ""
echo "Тест:"
echo "  curl https://civicguard-swarm.workers.dev/api/health"
echo ""
echo "Тест запроса:"
cat << 'EOF'
  curl -X POST https://civicguard-swarm.workers.dev/api/request \
    -H "Content-Type: application/json" \
    -d '{"user_id":"activist-1","message":"Как запросить у администрации документы по капремонту нашего дома?"}'
EOF
