# AI Study Assistant Incident Response

## Detect

```bash
date -u
docker compose ps
docker compose logs --since=30m app worker mongo redis > /tmp/ai-study-incident.log
curl -fsS http://127.0.0.1:3000/api/health
```

With an admin token:

```bash
curl -fsS -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://127.0.0.1:3000/api/admin/security?window=60'

curl -fsS -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://127.0.0.1:3000/api/admin/health
```

## Preserve evidence

Do not run `docker compose down -v`, `redis-cli FLUSHALL`, or delete volumes.

Create an incident backup outside the repository:

```bash
mkdir -p ~/ai-study-backups
STAMP=$(date +"%Y%m%d-%H%M%S")
BACKUP="$HOME/ai-study-backups/incident-${STAMP}.archive.gz"

docker compose exec -T mongo \
  mongodump --db ai_study_assistant --archive --gzip > "$BACKUP"

shasum -a 256 "$BACKUP" | tee "${BACKUP}.sha256"
```

Capture Redis state:

```bash
docker compose exec -T redis redis-cli INFO persistence
docker compose exec -T redis redis-cli --scan --pattern 'bull:*' | sort
```

## Contain

- Use the admin ban flow for a compromised user; bans revoke active sessions.
- Role changes also revoke the target user's sessions.
- Rotate compromised provider/server secrets at the provider, update deployment environment values, then restart only affected services.
- Rotating JWT signing secrets is a deliberate global logout.
- Never paste real secrets into Git, tickets, chat logs, or screenshots.

## Recover

- Prove MongoDB restores into a separate database before any live restore.
- Redis uses AOF persistence and `noeviction`.
- BullMQ `*:stalled-check` keys are transient coordination keys.
- Durable queue/job keys must survive restart.
- Workers can retry stalled work, so job handling must remain idempotent.

## Verify

```bash
./scripts/security-production-check.sh
```

Authenticated verification:

```bash
ADMIN_TOKEN="$ADMIN_TOKEN" ./scripts/security-production-check.sh
```

## Post-incident

Record detection time, scope, evidence, containment, rotated secrets, backup/restore actions, root cause, preventive changes, and final verification.

Never delete audit records to make an incident appear clean.
