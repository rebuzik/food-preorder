FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS builder

COPY . .
RUN node node_modules/vinext/dist/cli.js build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    WRANGLER_PERSIST_ROOT=/data/wrangler \
    WRANGLER_SEND_METRICS=false

WORKDIR /app

COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/drizzle ./drizzle
COPY --chown=node:node --from=builder /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
COPY --chown=node:node --from=builder /app/scripts/register-cloudflare-loader.mjs ./scripts/register-cloudflare-loader.mjs
COPY --chown=node:node --from=builder /app/scripts/cloudflare-loader.mjs ./scripts/cloudflare-loader.mjs
COPY --chown=node:node --from=builder /app/scripts/cloudflare-workers-node.mjs ./scripts/cloudflare-workers-node.mjs
COPY --chown=node:node --from=builder /app/wrangler.runtime.jsonc ./wrangler.runtime.jsonc

RUN mkdir -p /app/.wrangler /data/wrangler /data/runtime && \
    chmod +x ./scripts/docker-entrypoint.sh && \
    chown -R node:node /app/.wrangler /data

USER node

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
