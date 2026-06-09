# CollabBoard — Build Log

Daily increments by the autonomous build pipeline. Newest first.

## 2026-06-09 — Phase 0: Server skeleton

**Done:**
- Built the `@collabboard/server` workspace: Express 4 + TypeScript (ESM,
  strict, `noUncheckedIndexedAccess`), `tsx` dev runner, `tsc` build.
- Zod-validated env config (`src/config/env.ts`) that fails fast on bad/missing
  vars; `.env.example` documents every key. `.env` stays gitignored.
- Structured logging with pino (`pino-pretty` in dev, JSON in prod) +
  per-request logging via `pino-http`.
- App factory (`createApp`) wired with helmet, CORS (credentialed, origin
  allow-list), JSON/urlencoded body limits, a `/health` route (status, uptime,
  version), 404 handler, and a centralized error handler (`HttpError`,
  sanitized messages in prod).
- Graceful shutdown (SIGTERM/SIGINT) + unhandled-rejection/exception guards in
  `server.ts`.
- ESLint + vitest/supertest tests for `/health` and the 404 path.

**Verified:** `npm run lint`, `typecheck`, `build`, `test` all pass; ran the
built server and confirmed `/health` → `{status:"ok"}` and unknown routes → 404.

**Roadmap:** Phase 0 item 2/5 ✓

**Next:** Client scaffold — React + TypeScript (Vite), Tailwind, base
layout/router, ESLint + Prettier.

## 2026-06-08 — Phase 0: Foundation (monorepo scaffold)

**Done:**
- Initialized the monorepo: npm workspaces root (`package.json`) tying together
  `/client` and `/server`, with root scripts (`dev`/`build`/`lint`/`typecheck`/`test`)
  that fan out across workspaces.
- Added project meta: root `README.md` (overview, stack table, layout, scripts),
  `LICENSE` (MIT), `.gitignore` (node/build/env/coverage/docker), `.editorconfig`,
  `.nvmrc` (Node 20).
- Renamed default branch to `main`. Placeholder READMEs in `client/` and `server/`.

**Roadmap:** Phase 0 item 1/5 ✓

**Next:** Server skeleton — Express + TypeScript, dotenv env config, `/health`
endpoint, pino structured logging.

## 2026-06-09 — Phase 0: MongoDB + Docker (manual coder session)

**Done:**
- Mongoose connection layer (`server/src/lib/db.ts`): explicit connect-before-listen
  with retry/backoff, connection event logging, fast buffer timeouts, graceful
  `disconnectDb()`.
- Wired DB into startup/shutdown (`server.ts`): async start connects first; SIGTERM/
  SIGINT now drain HTTP then close Mongo, with a forced-exit safety timer.
- Health: `/health` now reports `db` state; added `/health/ready` readiness probe
  (503 until Mongo is connected) + test.
- Docker: multi-stage `server/Dockerfile` (non-root, healthcheck), `.dockerignore`,
  and root `docker-compose.yml` (mongo:7 + server, healthcheck-gated dependency).
- Verified: typecheck ✓, eslint ✓, vitest 3/3 ✓, `tsc` build ✓, `docker compose config` ✓.

**Roadmap:** Phase 0 — 4/5 items done (client scaffold remains).

**Next:** Client — React + TypeScript (Vite) + Tailwind, base layout/router, then add
client Dockerfile + client service to compose to complete Phase 0.

## 2026-06-09 — Phase 0 COMPLETE: React client + full Docker stack

**Done:**
- Scaffolded the client: React 18 + TypeScript + Vite 5 + Tailwind 3, ESLint.
- App shell: `Layout` (nav + footer), routing (react-router v6) with Home (hero +
  feature cards), Login + Boards placeholders, and a 404 page.
- Dev proxy: `/api` (prefix-stripped) + `/socket.io` → server, mirroring nginx.
- Client Docker image: multi-stage build → nginx serving the SPA with reverse-proxy
  for `/api` + websocket upgrade for `/socket.io`, SPA fallback, gzip, healthcheck.
- Completed `docker-compose.yml`: mongo + server + client (open localhost:5173).
- Verified: typecheck ✓, eslint ✓, vitest 2/2 ✓, vite build ✓, `docker compose config` ✓.

**Roadmap:** Phase 0 — 5/5 ✓ (foundation, server, client, DB, Docker all done).

**Next:** Phase 1 — Auth & Users: User model, register/login (bcrypt), JWT access +
refresh tokens in httpOnly cookies, auth middleware, `/me`.

## 2026-06-09 — Phase 1: Auth & Users (server-side)

**Done:**
- User model (Mongoose): unique email, `select:false` passwordHash, `toJSON`
  strips hash + maps `_id`→`id`.
- Password: bcryptjs hash/verify (configurable cost). Tokens: JWT access (15m) +
  refresh (7d) with separate secrets; sign/verify helpers.
- Auth routes: `POST /auth/register`, `/login`, `/refresh` (rotates both tokens),
  `/logout`, `GET /auth/me` (protected). Tokens delivered as httpOnly cookies
  (secure+sameSite configurable); also accepts `Authorization: Bearer`.
- Security: zod validation on register/login, express-rate-limit (30/15min) on
  credential routes, generic "invalid credentials" (no user enumeration),
  production guard that refuses to boot with default JWT secrets.
- `requireAuth` middleware + `req.user` typing; cookie-parser wired.
- Tests: 20/20 (tokens, password, schemas, no-DB route paths incl. 400/401/logout).
  typecheck ✓, eslint ✓, build ✓.

**Roadmap:** Phase 1 — 3/4 (server auth done; client auth UI remains).

**Next:** Client auth — register/login forms, auth context/provider, protected
route guards, silent token refresh on 401, wired to `/api/auth/*`.
