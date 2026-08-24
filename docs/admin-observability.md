# Admin observability and workers

## What is monitored

The admin dashboards are available only to authenticated administrators:

- `/admin/ai-usage` — durable MongoDB AI request telemetry, provider/model health, feature usage, latency, token counts, failures, provider quota events, and recent activity.
- `/admin/health` — MongoDB, Redis, study-generation queue/worker, PDF-ingestion queue/worker, AI provider telemetry, Telegram bot/webhook, process uptime, and memory.
- `/student/ai-usage` — the signed-in student's own seven-day usage, daily totals, feature breakdown, quota remaining, and recent activity.

No prompt text, response text, API key, email address, or document content is stored in AI telemetry.

## Environment

Add these values to `.env.docker` when you want per-user limits. Zero means unlimited:

```dotenv
AI_USER_DAILY_REQUEST_LIMIT=0
AI_USER_DAILY_TOKEN_LIMIT=0
```

Compose configures these worker-only values automatically:

```dotenv
REDIS_URL=redis://redis:6379
GENERATION_WORKER_CONCURRENCY=1
PDF_WORKER_CONCURRENCY=1
```

When using `compose.prod.yaml` with managed infrastructure, set `REDIS_URL` in
`.env.docker` to the managed Redis endpoint; the example local hostname works
only with the full `compose.yaml` stack.

For Telegram health, configure `APP_PUBLIC_URL`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_WEBHOOK_SECRET`. A Cloudflare quick-tunnel URL is acceptable for testing, but the expected webhook changes whenever the temporary URL changes.

## Start and verify

```bash
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 app worker pdf-worker redis
./scripts/security-production-check.sh
```

After both workers have been ready for up to 30 seconds, `/admin/health` should show fresh heartbeats for **Generation worker** and **PDF worker**. A heartbeat older than 90 seconds is offline.

Upload a PDF to confirm the complete path:

1. The app validates and stores the file in the private `upload_data` volume.
2. `pdf-worker` extracts the PDF text and queues study-material generation.
3. `worker` generates the study material.
4. Both queue counts and worker heartbeats appear on `/admin/health`.
5. Any real provider calls appear on both the admin and owning student's AI-usage pages.

Useful checks:

```bash
docker compose exec redis redis-cli GET health:worker:study-generation
docker compose exec redis redis-cli GET health:worker:pdf-ingestion
docker compose exec redis redis-cli LLEN bull:pdf-ingestion:wait
docker compose exec redis redis-cli LLEN bull:study-generation:wait
```

## Status interpretation

- **Healthy** — MongoDB and Redis are connected; both queues and workers are available; configured integrations are available.
- **Degraded** — a worker, queue, Telegram webhook, or AI provider is unavailable/quota-exhausted while core storage is still reachable.
- **Unhealthy** — MongoDB or Redis is unavailable.

AI spend remains `$0.00` until explicit per-model pricing is configured. Token and request counts are already durable.
