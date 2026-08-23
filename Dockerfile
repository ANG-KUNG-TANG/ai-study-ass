FROM node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# pdf-parse v2 uses @napi-rs/canvas for DOMMatrix/CanvasFactory.
# npm lockfiles created on another OS can omit the Linux platform package,
# so install the exact native binding required by the Docker target.
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

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public

# Harmless placeholders satisfy build-time validation. Real values are injected
# only when the container starts and are never stored as Docker ARG/ENV secrets.
RUN MONGODB_URI=mongodb://127.0.0.1:27017/ai_study_build \
    JWT_ACCESS_SECRET=docker-build-access-secret-placeholder-000000000000 \
    JWT_REFRESH_SECRET=docker-build-refresh-secret-placeholder-0000000000 \
    APP_URL=http://localhost:3000 \
    EMAIL_ENABLED=false \
    npm run build

FROM node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS worker
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs \
    && mkdir -p /app/data/uploads \
    && chown -R nextjs:nodejs /app/data

COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/src ./src

USER nextjs

CMD ["./node_modules/.bin/tsx", "src/server/workers/study-generation.worker.ts"]

FROM node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs \
    && mkdir -p /app/data/uploads \
    && chown -R nextjs:nodejs /app/data

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Keep both the JS wrapper and the platform-specific native binary.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/@napi-rs ./node_modules/@napi-rs

# Runtime Prolog rules are loaded by process.cwd()-based paths.
COPY --from=builder --chown=nextjs:nodejs \
  /app/src/server/intelligence/prolog/cs.rules.pl \
  ./src/server/intelligence/prolog/cs.rules.pl

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
