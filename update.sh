#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "❌ Не найден .env. Скопируйте .env.example в .env и заполните настройки."
  exit 1
fi

echo "🔄 1. Git pull..."
git pull --ff-only

echo "🏗 2. Build production image..."
docker compose build

echo "🚀 3. Restart production service..."
docker compose up -d --remove-orphans

echo "⏳ Waiting for the application to start..."

echo "🛠 4. Database and health check..."
# D1 migrations run automatically in docker-entrypoint.sh before vinext starts.
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
echo "HTTP 200 — application and persisted database are ready."

echo "🔎 5. Verify production runtime..."
runtime_command="$(docker compose exec -T food-preorder node -e \
  'const fs=require("node:fs"); process.stdout.write(fs.readFileSync("/proc/1/cmdline").toString().replace(/\0/g," ").trim())')"
echo "PID 1: ${runtime_command}"
if [[ "$runtime_command" == *"wrangler"* && "$runtime_command" == *" dev"* ]]; then
  echo "❌ Production container is still running wrangler dev."
  exit 1
fi
if [[ "$runtime_command" != *"vinext/dist/cli.js start"* ]]; then
  echo "❌ Unexpected production runtime. Expected vinext start."
  exit 1
fi

echo "🧹 6. Cleanup old dangling images..."
docker image prune -f

echo "✅ Done! Production runtime is healthy."
docker compose ps
