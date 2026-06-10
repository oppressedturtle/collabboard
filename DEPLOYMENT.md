# Deployment

This document covers deployment options for CollabBoard.

---

## Deploying the Client (Vercel)

Vercel deploys the client as a static site built by Vite. It does **not** use the `client/Dockerfile` or nginx — Vercel runs `npm run build`, serves the `dist/` output from its CDN, and never executes the nginx reverse-proxy that normally forwards `/api/*` to the server.

### 1. Connect the repo

1. Go to [vercel.com](https://vercel.com) → **New Project** → import your GitHub repository.
2. Set the **Root Directory** to `client/`.
3. Vercel will auto-detect Vite — confirm the preset or set it manually.

### 2. Build settings

| Setting | Value |
|---|---|
| Framework Preset | **Vite** |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` (default) |

### 3. Environment variables — VITE_API_URL (required)

The client's `src/lib/api.ts` hardcodes `BASE_URL = '/api'` — a relative path that works in Docker because nginx proxies `/api/*` to the server container. On Vercel there is no nginx, so every fetch call (`/api/...`) will hit the Vercel CDN and return a 404.

You must tell the client where the real server lives. There are two ways to do this:

#### Option A — Vercel rewrite rule (no code change needed)

Add a `vercel.json` at the root of the `client/` directory:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-server.onrender.com/:path*"
    }
  ]
}
```

Replace `https://your-server.onrender.com` with your actual server URL (Render, Railway, Fly.io, etc.). This mirrors the nginx proxy behaviour and requires **no changes to `api.ts`**.

> Note: Vercel rewrites cannot forward `credentials: 'include'` cookies cross-origin as transparently as nginx can. If you run into auth/cookie issues with this approach, use Option B.

#### Option B — VITE_API_URL environment variable (requires a small code change)

1. In the Vercel dashboard go to **Settings → Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `VITE_API_URL` | `https://your-server.onrender.com` |

2. Update `client/src/lib/api.ts` to read the variable:

   ```ts
   const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api`;
   ```

   With `VITE_API_URL` unset (or empty string) the behaviour is identical to today, so Docker and local dev are unaffected.

3. Redeploy after adding the environment variable — Vite bakes `import.meta.env.*` values into the bundle at build time, so the variable must be present when Vercel runs `npm run build`.

### 4. CORS

Your server's `CORS_ORIGIN` must include the Vercel deployment URL, otherwise the browser will block all API responses.

Add the Vercel URL to the server's environment variables wherever it is deployed:

```
CORS_ORIGIN=https://your-app.vercel.app
```

If you use a custom domain (see below) add that instead, or add both separated by a comma if your server supports multiple origins.

### 5. Custom domain

In the Vercel dashboard go to **Settings → Domains**, add your domain, and follow the DNS instructions. Once the domain is active, update `CORS_ORIGIN` on the server to match the new URL.

---

## Deploying the Server

The sections below cover deploying the **Node.js/Express API** (`server/`) to cloud platforms and connecting it to MongoDB Atlas.

### Table of Contents

- [Prerequisites](#prerequisites)
- [Mongo Atlas Setup](#mongo-atlas-setup)
- [Render (Recommended)](#render-recommended)
- [Railway](#railway)
- [Fly.io](#flyio)
- [Health Checks](#health-checks)
- [Environment Variables Reference](#environment-variables-reference)

---

### Prerequisites

- **Node.js 20** — the server targets Node 20 (matches the Docker image base `node:20-alpine`)
- **Docker** (optional) — only needed to build and test the image locally before pushing
- A free **MongoDB Atlas** account — see the next section
- The repo pushed to GitHub (all three platforms deploy from a connected repository)

---

### Mongo Atlas Setup

1. Sign up or log in at [cloud.mongodb.com](https://cloud.mongodb.com).
2. Create a new **free-tier cluster** (M0, any region close to your deployment).
3. Under **Database Access**, create a database user:
   - Authentication method: Password
   - Username: e.g. `collabboard`
   - Password: generate a strong random password (save it — you will need it in the connection string)
   - Built-in role: **Read and write to any database**
4. Under **Network Access**, add an IP address entry:
   - Click **Add IP Address** → **Allow Access from Anywhere** → `0.0.0.0/0`
   - This is required because cloud deployment platforms use dynamic egress IPs. If your platform provides a static IP/NAT gateway you can restrict this later.
5. Under **Database**, click **Connect** on your cluster → **Drivers** → copy the connection string. It will look like:
   ```
   mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<user>` and `<pass>` with your database username and password, and append the database name:
   ```
   mongodb+srv://collabboard:yourpassword@cluster0.xxxxx.mongodb.net/collabboard?retryWrites=true&w=majority
   ```
   This full string is the value for `MONGODB_URI`.

---

### Render (Recommended)

Render is the primary deployment target. Two methods are supported: **native Node** (simpler) or **Docker**.

#### Method A — Native Node (no Docker)

1. In the Render dashboard, click **New → Web Service**.
2. Connect your GitHub repository.
3. Configure the service:
   - **Name**: `collabboard-server` (or your preference)
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/server.js`
   - **Instance Type**: Free (or Starter for always-on)
4. Set environment variables (see table below and the section after it).
5. Click **Create Web Service**.

#### Method B — Docker

1. Follow steps 1–3 above, but select **Environment: Docker**.
2. Set **Dockerfile Path** to `server/Dockerfile` (path relative to the repo root).
3. Set environment variables as described below.
4. Render will build the multi-stage image and run the `CMD` (`node dist/server.js`). The image exposes port `4000`; Render automatically routes HTTPS traffic to it.

#### Environment Variables on Render

In the **Environment** tab of your Web Service, add each variable listed in the [reference table](#environment-variables-reference). Critical production values:

| Variable | Production Value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Your Atlas connection string |
| `JWT_ACCESS_SECRET` | Output of `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | Output of `openssl rand -base64 48` (run separately — must differ) |
| `CORS_ORIGIN` | Your Vercel client URL, e.g. `https://collabboard.vercel.app` |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `none` |

**Note on cookies**: Because the API and client are on different domains (Render vs. Vercel), cross-site cookies require `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true`. Render terminates TLS, so the server always runs behind HTTPS in production.

**Note on CORS**: `CORS_ORIGIN` accepts a comma-separated list if you need to allow multiple origins (e.g. `https://collabboard.vercel.app,https://staging.collabboard.vercel.app`). It must match the exact origin the browser sends — no trailing slash.

**Generating JWT secrets** (run each command once in your local terminal):
```bash
openssl rand -base64 48   # paste output as JWT_ACCESS_SECRET
openssl rand -base64 48   # paste output as JWT_REFRESH_SECRET
```

#### Health Check on Render

In the **Health & Alerts** section of the Web Service settings, set **Health Check Path** to `/health/ready`. Render will send a `GET` to this path and restart the container if it returns a non-2xx status.

---

### Railway

1. In the Railway dashboard, click **New Project → Deploy from GitHub repo**.
2. Select your repository.
3. Railway auto-detects Node.js. In the service settings:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/server.js`
   - Alternatively, check **Use Dockerfile** and point to `server/Dockerfile`.
4. Under **Variables**, add all required environment variables from the [reference table](#environment-variables-reference) using the same production values listed in the Render section above.
5. Railway assigns a public HTTPS URL automatically. Set `CORS_ORIGIN` to your Vercel client URL after the client is deployed.
6. For the health check, go to **Settings → Health Check** and set the path to `/health/ready`.

---

### Fly.io

1. Install the Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Log in: `fly auth login`
3. From the repo root, launch the app (uses the server's Dockerfile):
   ```bash
   fly launch --dockerfile server/Dockerfile --name collabboard-server
   ```
   Accept the generated `fly.toml` or adjust the region. The app listens on port `4000` — confirm that the `[[services]]` block in `fly.toml` sets `internal_port = 4000`.
4. Set all required secrets (Fly stores these as encrypted environment variables):
   ```bash
   fly secrets set \
     NODE_ENV=production \
     MONGODB_URI="mongodb+srv://collabboard:yourpassword@cluster0.xxxxx.mongodb.net/collabboard?retryWrites=true&w=majority" \
     JWT_ACCESS_SECRET="$(openssl rand -base64 48)" \
     JWT_REFRESH_SECRET="$(openssl rand -base64 48)" \
     CORS_ORIGIN="https://collabboard.vercel.app" \
     COOKIE_SECURE=true \
     COOKIE_SAMESITE=none
   ```
   Set remaining optional vars (SMTP, etc.) with additional `fly secrets set KEY=val` calls.
5. Deploy:
   ```bash
   fly deploy
   ```
6. Add a health check to `fly.toml`:
   ```toml
   [[services.http_checks]]
     interval    = "10s"
     timeout     = "2s"
     grace_period = "20s"
     method      = "get"
     path        = "/health/ready"
   ```

---

### Health Checks

The server exposes two unauthenticated health endpoints. Use these for platform health probes and uptime monitoring.

#### `GET /health` — Liveness

Returns `200 OK` as long as the process is running. Response body:

```json
{
  "status": "ok",
  "uptime": 3721,
  "timestamp": "2026-06-10T12:00:00.000Z",
  "version": "1.0.0",
  "db": "connected"
}
```

Use this as a **liveness** probe — confirms the process is alive but does not guarantee the database is reachable.

#### `GET /health/ready` — Readiness

Returns `200 OK` when the database is connected, or `503 Service Unavailable` when it is not. Response body:

```json
{
  "status": "ready",
  "db": "connected",
  "timestamp": "2026-06-10T12:00:00.000Z"
}
```

Use this as a **readiness** probe on all platforms so that traffic is only routed to the instance after it has a live database connection. Platforms will stop sending traffic (and optionally restart the container) when this returns `503`.

---

### Environment Variables Reference

All variables are validated by Zod at startup (`server/src/config/env.ts`). The server exits immediately with a clear error message if any required variable is invalid. In development, defaults from `.env.example` apply; in production, every variable should be set explicitly.

| Name | Default | Required in Prod | Description |
|---|---|---|---|
| `NODE_ENV` | `development` | Yes — set to `production` | Runtime mode. Enables production JWT secret check and other guards. |
| `PORT` | `4000` | No | Port the HTTP server listens on. Most platforms inject this automatically; the Dockerfile exposes `4000`. |
| `CORS_ORIGIN` | `http://localhost:5173` | Yes | Comma-separated list of allowed CORS origins. Must exactly match the client URL(s) the browser sends (no trailing slash). |
| `LOG_LEVEL` | `info` | No | Pino log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`. |
| `MONGODB_URI` | `mongodb://localhost:27017/collabboard` | Yes | MongoDB connection string. Use a MongoDB Atlas `mongodb+srv://` URI in production. |
| `JWT_ACCESS_SECRET` | *(dev placeholder)* | Yes | Secret used to sign short-lived access tokens. Minimum 32 characters. The server refuses to boot in production if this contains `change-me`. Generate with `openssl rand -base64 48`. |
| `JWT_REFRESH_SECRET` | *(dev placeholder)* | Yes | Secret used to sign long-lived refresh tokens. Must be different from `JWT_ACCESS_SECRET`. Same generation method. |
| `ACCESS_TOKEN_TTL` | `15m` | No | Access token lifetime in [vercel/ms](https://github.com/vercel/ms) format (e.g. `15m`, `1h`). |
| `REFRESH_TOKEN_TTL` | `7d` | No | Refresh token lifetime (e.g. `7d`, `30d`). |
| `BCRYPT_ROUNDS` | `12` | No | bcrypt cost factor for password hashing. Valid range: 8–15. Higher is slower but more secure; 12 is a reasonable production default. |
| `COOKIE_SECURE` | `false` | Yes — set to `true` | When `true`, cookies are only sent over HTTPS. Must be `true` behind any TLS-terminating proxy (all platforms listed here). |
| `COOKIE_SAMESITE` | `lax` | Yes — set to `none` | Cookie `SameSite` attribute. Set to `none` when the API and client are on different domains (cross-site). Requires `COOKIE_SECURE=true`. |
| `SMTP_HOST` | `localhost` | No | SMTP server hostname. Set to `disabled` to silence all email sending (useful in CI). |
| `SMTP_PORT` | `1025` | No | SMTP server port. |
| `SMTP_SECURE` | `false` | No | Use TLS for the SMTP connection (`true` for port 465, `false` for 587/STARTTLS). |
| `SMTP_USER` | *(empty)* | No | SMTP authentication username. Leave empty if the provider does not require auth. |
| `SMTP_PASS` | *(empty)* | No | SMTP authentication password. |
| `SMTP_FROM` | `"CollabBoard" <noreply@collabboard.local>` | No | The `From` address used for outbound email. Should be a verified sender address on your SMTP provider. |
