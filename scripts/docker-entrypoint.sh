#!/bin/sh
set -eu

required_vars="ADMIN_USERNAME ADMIN_PASSWORD ADMIN_SESSION_SECRET"
for variable_name in $required_vars; do
  eval "variable_value=\${$variable_name:-}"
  if [ -z "$variable_value" ]; then
    echo "Required environment variable $variable_name is not set." >&2
    exit 64
  fi
done

mkdir -p /data/wrangler /data/runtime/xdg /data/runtime/logs
export XDG_CONFIG_HOME=/data/runtime/xdg
export WRANGLER_LOG_PATH=/data/runtime/logs

node --input-type=module -e '
  import { writeFile } from "node:fs/promises";
  const names = ["ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"];
  const lines = names.map((name) => `${name}=${JSON.stringify(process.env[name])}`);
  await writeFile("/data/runtime/admin.env", `${lines.join("\n")}\n`, { mode: 0o600 });
'

echo "Applying pending local D1 migrations..."
node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB \
  --local \
  --config wrangler.server.jsonc \
  --persist-to /data/wrangler

echo "Starting Food Preorder on 0.0.0.0:${PORT:-3000}..."
exec node node_modules/wrangler/bin/wrangler.js dev \
  --local \
  --config wrangler.server.jsonc \
  --env-file /data/runtime/admin.env \
  --persist-to /data/wrangler \
  --ip 0.0.0.0 \
  --port "${PORT:-3000}"
