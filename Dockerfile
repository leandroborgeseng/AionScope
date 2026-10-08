# Produção Next.js (standalone). Tokens PBI_* entram só em runtime — nunca como ARG/COPY.
# Railway: criar Volume em Settings → Volumes com mount /data + DATABASE_PATH=/data/aionscope.sqlite
# (não use VOLUME no Dockerfile — Railway não suporta essa instrução)
# better-sqlite3: toolchain nativo (python3 make g++) no stage deps (Alpine).

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build \
  && mkdir -p .next/standalone/node_modules \
  && cp -R node_modules/better-sqlite3 .next/standalone/node_modules/

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_PATH=/data/aionscope.sqlite
ENV DATA_ROOT=/data

# su-exec: entrypoint ajusta dono do volume /data (Railway monta como root) e desce para nextjs
RUN apk add --no-cache su-exec \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /data/ordens-compra-anexos /data/treinamentos-evidencias \
  && chown -R nextjs:nodejs /data

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# JSON legado para seed na 1ª abertura (tabelas vazias)
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
COPY --chmod=755 scripts/docker-entrypoint.sh /app/docker-entrypoint.sh

# Entra como root só para chown do volume; o entrypoint faz exec como nextjs
USER root
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
