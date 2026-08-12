#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "❌ Не найден .env. Скопируйте .env.example в .env и заполните настройки."
  exit 1
fi

echo "🔄 1. Git pull..."
git pull --ff-only

echo "🏗 2. Build..."
docker compose build

echo "🚀 3. Restart..."
docker compose up -d --remove-orphans

echo "⏳ Waiting for the application to start..."

echo "🛠 4. Database and health check..."
# D1 migrations run automatically in docker-entrypoint.sh before the server starts.
attempt=1
while ! docker compose exec -T food-preorder node -e \
  "fetch('http://127.0.0.1:3000/').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))" >/dev/null 2>&1; do
  if [[ $attempt -ge 12 ]]; then
    echo "❌ Application did not become ready. Recent logs:"
    docker compose logs --tail=100 food-preorder
    exit 1
  fi
  sleep 5
  attempt=$((attempt + 1))
done
echo "HTTP 200 — application is ready."

echo "🧹 5. Cleanup old dangling images..."
docker image prune -f

echo "✅ Done!"
docker compose ps
