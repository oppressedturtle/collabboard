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
