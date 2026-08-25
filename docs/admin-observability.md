# Admin observability and workers

## What is monitored

The admin dashboards are available only to authenticated administrators:

- `/admin/ai-usage` — durable MongoDB AI request telemetry, provider/model health, feature usage, latency, token counts, failures, provider quota events, and recent activity.
- `/admin/health` — MongoDB, Redis, study-generation queue/worker, PDF-ingestion queue/worker, AI provider telemetry, Telegram bot/webhook, process uptime, and memory.
- `/admin/activity` — searchable audit history with actor role, category, outcome, reason, IP/request context, and CSV export.
- `/admin/security` — grouped failed-login, refresh-token reuse, rate-limit, and sensitive administrator signals.
- `/admin/content` — uploaded-context inventory, quarantine/restore, processing detail, queued-job cancellation, retry, AI usage, extracted-text preview, and cascaded deletion.
- `/admin/users/[id]` — account detail, session revocation, AI-provider access, and per-user daily request/token limits.
- `/admin/settings` — upload and AI kill switches, upload policy, provider pricing, and previewable retention controls.
- `/student/ai-usage` — the signed-in student's own seven-day usage, daily totals, feature breakdown, quota remaining, and recent activity.

No prompt text, response text, API key, email address, or document content is stored in AI telemetry. Input/output token counts and the pricing-based estimated cost are retained.

Audit metadata is recursively redacted for password, token, authorization, cookie, secret, and API-key fields. High-impact operations require an administrator-supplied reason. Audit entries are append-only during normal operation and are removed only by the configured retention policy.

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

AI spend remains `$0.00` until provider pricing is configured under `/admin/settings`. Token and request counts are already durable. Pricing values are estimates in USD per one million input/output tokens and should be reviewed when a provider changes its rates.

## Operational safeguards

- Quarantined content is hidden from student note reads while remaining available to administrators for investigation and restoration.
- A waiting or delayed generation job can be cancelled; BullMQ active jobs are deliberately not force-killed because doing so can leave partial writes.
- Retention is previewed before manual execution. Content retention at `0` is disabled; audit retention is constrained to 30–3,650 days.
- The last administrator cannot be demoted or deleted. Administrators cannot ban themselves, delete themselves through the admin route, or revoke their own sessions through another user's control flow.
- Original upload files remain temporary. After ingestion, the administrator detail screen displays the retained extracted context, not a downloadable original.
