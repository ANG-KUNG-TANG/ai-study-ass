# Transactional email setup

The application sends account-verification and password-reset messages through
Resend. Authentication continues to own token generation, hashing, expiration,
and atomic consumption; the email integration only transports the one-time link.

## Configuration

Never prefix the Resend key with `NEXT_PUBLIC_` or place it in the Dockerfile.
Configure it only in the runtime environment:

```dotenv
APP_URL=https://your-current-url.trycloudflare.com
EMAIL_ENABLED=true
RESEND_API_KEY=re_replace_with_your_private_key
EMAIL_FROM="AI Study Assistant <onboarding@resend.dev>"
EMAIL_REPLY_TO=
```

`APP_URL` is the trusted origin used to create `/auth/verify-email` and
`/auth/reset-password` links. It is not a Resend API URL. The Resend SDK already
uses the provider API endpoint internally.

## Development without a domain

1. Start the application on port 3000.
2. Run `cloudflared tunnel --url http://localhost:3000`.
3. Copy the generated HTTPS URL into `APP_URL` in `.env.docker`.
4. Set `EMAIL_ENABLED=true` and add the Resend API key.
5. Keep the tunnel process running and restart the application containers.
6. Register with the email address belonging to the Resend account.

With `onboarding@resend.dev`, Resend permits real delivery only to the address
associated with the Resend account. A verified sender domain is required before
sending to other recipients.

Quick Tunnel addresses change after the tunnel is restarted. When that happens,
update `APP_URL`, restart the app, and request a new verification/reset message.
Previously sent messages still point to the old tunnel.

## Local Docker commands

```bash
cp docker.env.example .env.docker
docker compose build --no-cache
docker compose up -d
docker compose ps
```

Confirm configuration without printing the key:

```bash
docker compose exec app node -e '
console.log({
  appUrl: process.env.APP_URL,
  emailEnabled: process.env.EMAIL_ENABLED,
  emailFrom: process.env.EMAIL_FROM,
  hasResendKey: Boolean(process.env.RESEND_API_KEY)
})
'
```

## Application flows

- Registration stores a SHA-256 hash of the verification token and sends the raw
  token only in the email link.
- Verification atomically consumes a valid, unexpired token.
- Resend verification invalidates the previous token before sending a new one.
- Forgot password returns the same public response for known and unknown emails.
- Password reset atomically consumes the token, changes the password, and revokes
  active sessions.
- Delivery failures are logged without email bodies, API keys, or raw tokens.
- Provider retries use idempotency keys derived from token hashes.

## Verification checklist

```bash
npm run typecheck
npm test -- --runInBand
npm run lint
npm run build
npm audit --audit-level=high
docker compose --progress=plain build --no-cache
```

Manually verify registration, resend verification, expired/reused token rejection,
forgot password, reset password, and login with the new password.

## Production domain migration

1. Add a dedicated sending subdomain such as `mail.example.com` to Resend.
2. Add the exact DKIM, SPF, return-path, and DMARC records shown by Resend.
3. Wait for domain verification.
4. Create a separate production API key.
5. Set `EMAIL_FROM="AI Study Assistant <noreply@mail.example.com>"`.
6. Set `APP_URL` to the permanent HTTPS application origin.
7. Test delivery to Gmail and Outlook before enabling public registration.

Delivery-event webhooks are optional and should be added after the basic account
flows work. Any webhook endpoint must verify Resend's signature before accepting
the event.
