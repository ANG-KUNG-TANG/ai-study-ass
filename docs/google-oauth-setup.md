# Google OAuth setup

The application uses one Google OAuth flow for both registration and login.
New Google users are created automatically; returning users receive the same
application refresh-token session used by password login.

## 1. Create the Google OAuth client

1. Open Google Cloud Console.
2. Configure the OAuth consent screen for the project.
3. Go to **APIs & Services > Credentials**.
4. Create an **OAuth client ID** with application type **Web application**.
5. While the consent screen is in testing mode, add the Google accounts that
   will test the application as test users.

For local development, add:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI:
  `http://localhost:3000/api/auth/google/callback`

For a Cloudflare tunnel, also add the current HTTPS origin and exact callback,
for example:

- Authorized JavaScript origin: `https://your-tunnel.trycloudflare.com`
- Authorized redirect URI:
  `https://your-tunnel.trycloudflare.com/api/auth/google/callback`

Google requires the redirect URI to match exactly, including the scheme, host,
path, and trailing-slash choice. A Cloudflare quick-tunnel hostname changes when
the tunnel restarts, so both Google Cloud and `.env.docker` must be updated each
time. A stable domain is recommended for production.

## 2. Configure the application

Add the credentials to `.env.docker` without quotes or extra spaces:

```dotenv
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

For the Cloudflare URL, replace `http://localhost:3000` in
`GOOGLE_REDIRECT_URI` with the current HTTPS tunnel origin.

Never commit the client secret. All three Google variables must be configured
together; otherwise the application will keep password login available and show
that Google sign-in is not configured.

## 3. Rebuild and test

```bash
docker compose build app
docker compose up -d --force-recreate app
docker compose logs --tail=100 app
```

Open `/auth/login` or `/auth/register` and select the Google button. Verify both
cases:

1. A new Google account creates a normal active student account and opens the
   student dashboard.
2. A returning Google account signs in without creating a duplicate user.

The server stores the immutable Google account identifier (`sub`), not Google
access or refresh tokens. Existing Gmail and Google Workspace accounts can be
linked by their verified provider-controlled email. Other existing email domains
continue to use password login; automatic email-based linking is blocked to
prevent account takeover.
