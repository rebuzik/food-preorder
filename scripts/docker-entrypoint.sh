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

export WRANGLER_PERSIST_ROOT="${WRANGLER_PERSIST_ROOT:-/data/wrangler}"
mkdir -p "$WRANGLER_PERSIST_ROOT" /data/runtime/xdg /data/runtime/logs
export XDG_CONFIG_HOME=/data/runtime/xdg
export WRANGLER_LOG_PATH=/data/runtime/logs

echo "Applying pending local D1 migrations..."
node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB \
  --local \
  --config wrangler.runtime.jsonc \
  --persist-to "$WRANGLER_PERSIST_ROOT"

echo "Starting Food Preorder production server on 0.0.0.0:${PORT:-3000}..."
exec node \
  --import ./scripts/register-cloudflare-loader.mjs \
  node_modules/vinext/dist/cli.js start \
  --hostname 0.0.0.0 \
  --port "${PORT:-3000}"
