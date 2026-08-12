# ─────────────────────────────────────────────────────────────────────────────
# Base
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-bookworm-slim AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1


# ─────────────────────────────────────────────────────────────────────────────
# Dependencies
# ─────────────────────────────────────────────────────────────────────────────

FROM base AS deps

COPY package.json package-lock.json ./

RUN npm ci


# pdf-parse v2 uses @napi-rs/canvas for DOMMatrix/CanvasFactory.
# Lockfiles created on macOS can omit the Linux platform-specific package.

ARG TARGETARCH

RUN set -eux; \
    if [ ! -f node_modules/@napi-rs/canvas/package.json ]; then \
      npm install --no-save --no-package-lock @napi-rs/canvas@0.1.80; \
    fi; \
    CANVAS_VERSION="$(node -p "require('./node_modules/@napi-rs/canvas/package.json').version")"; \
    case "${TARGETARCH}" in \
      arm64) CANVAS_NATIVE="@napi-rs/canvas-linux-arm64-gnu@${CANVAS_VERSION}" ;; \
      amd64) CANVAS_NATIVE="@napi-rs/canvas-linux-x64-gnu@${CANVAS_VERSION}" ;; \
      *) echo "Unsupported Docker architecture: ${TARGETARCH}"; exit 1 ;; \
    esac; \
    echo "Installing ${CANVAS_NATIVE}"; \
    npm install --no-save --no-package-lock "${CANVAS_NATIVE}"; \
    node -e "const c=require('@napi-rs/canvas'); if(typeof c.DOMMatrix!=='function') process.exit(1); console.log('Canvas native binding OK:', process.platform, process.arch, typeof c.DOMMatrix)"


# ─────────────────────────────────────────────────────────────────────────────
# Builder
# ─────────────────────────────────────────────────────────────────────────────

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN mkdir -p public


# Harmless build-time placeholders.
# Runtime values come from compose/.env.docker.

ENV MONGODB_URI=mongodb://127.0.0.1:27017/ai_study_build
ENV JWT_ACCESS_SECRET=docker-build-access-secret-placeholder-000000000000
ENV JWT_REFRESH_SECRET=docker-build-refresh-secret-placeholder-0000000000
ENV APP_URL=http://localhost:3000

RUN npm run build


# ─────────────────────────────────────────────────────────────────────────────
# Background Worker Image
#
# Used by BOTH:
#
# - study-generation worker
# - pdf-ingestion worker
#
# Compose overrides the command for pdf-worker.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-bookworm-slim AS worker

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1


# Create non-root application user.

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs


# Worker requires full node_modules because it executes TypeScript via tsx.

COPY --from=deps --chown=nextjs:nodejs \
    /app/node_modules \
    ./node_modules

COPY --from=builder --chown=nextjs:nodejs \
    /app/package.json \
    ./package.json

COPY --from=builder --chown=nextjs:nodejs \
    /app/package-lock.json \
    ./package-lock.json

COPY --from=builder --chown=nextjs:nodejs \
    /app/tsconfig.json \
    ./tsconfig.json

COPY --from=builder --chown=nextjs:nodejs \
    /app/src \
    ./src


# IMPORTANT:
# Create upload directory BEFORE switching to nextjs.
#
# Both the app and pdf-worker will mount upload_data here.

RUN install -d \
    -o nextjs \
    -g nodejs \
    /app/storage/uploads


USER nextjs


# Default worker.
#
# pdf-worker overrides this command in compose.yaml.

CMD ["./node_modules/.bin/tsx", "src/server/workers/study-generation.worker.ts"]


# ─────────────────────────────────────────────────────────────────────────────
# Next.js Runtime
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000


# Create non-root Next.js user.

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs


# Next standalone build.

COPY --from=builder --chown=nextjs:nodejs \
    /app/public \
    ./public

COPY --from=builder --chown=nextjs:nodejs \
    /app/.next/standalone \
    ./

COPY --from=builder --chown=nextjs:nodejs \
    /app/.next/static \
    ./.next/static


# pdf-parse runtime native dependencies.
#
# Keep both JS wrapper and platform-specific binary.

COPY --from=deps --chown=nextjs:nodejs \
    /app/node_modules/@napi-rs \
    ./node_modules/@napi-rs


# Runtime Prolog rules loaded through process.cwd()-based paths.

COPY --from=builder --chown=nextjs:nodejs \
    /app/src/server/intelligence/prolog/cs.rules.pl \
    ./src/server/intelligence/prolog/cs.rules.pl


# IMPORTANT:
# Create shared-upload mount point while still root.

RUN install -d \
    -o nextjs \
    -g nodejs \
    /app/storage/uploads


# Only switch user AFTER all filesystem preparation.

USER nextjs


EXPOSE 3000


HEALTHCHECK \
  --interval=30s \
  --timeout=5s \
  --start-period=20s \
  --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"


CMD ["node", "server.js"]