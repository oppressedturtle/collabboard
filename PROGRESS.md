# CollabBoard — Build Log

Daily increments by the autonomous build pipeline. Newest first.

## 2026-06-14 — QA PHASE: full-stack verification (GREEN) + compose boot fix

**Done:**
- **Unit/integration:** server **89/89** and client **35/35** green.
- **Full stack up** via `docker compose up --build` (mongo:7 + server + client/nginx +
  mailhog). Mongo healthy, server `/health` → `db: connected`, `/health/ready` → ready,
  client SPA HTTP 200.
- **Production-stack E2E happy path** (curl through the client nginx proxy, cookie auth):
  register → `/auth/me` → create board → create list → create card → fetch cards →
  `GET /boards/:id/members` (today's feature) → Socket.io polling handshake — all 200/201.
  This exercises the same flow as the Playwright spec but against the real prod containers.
- **QA fix — compose boot gap (real finding):** out of the box `docker compose up`
  crash-looped: the server's production secret guard (good!) refuses to start without
  `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, but the compose file only mentioned them in
  comments and never wired them — so a dev following the README's 3-step quick-start hit a
  502. Fixed: compose now interpolates both secrets from a gitignored `./.env` with a
  `:?` fail-fast guard (clear error instead of a silent crash loop), and added
  `.env.example` documenting `openssl rand -base64 48`. Verified the stack boots healthy
  and serves the full E2E flow with secrets supplied.

**Roadmap:** QA phase ✅ green. Advancing to SHIP.

**Next:** SHIP — push, confirm GitHub Actions CI passes on the new commit, tag `v1.0.0`,
set `shipped: true`, and notify Yanis with the repo link for review.


## 2026-06-14 — Phase 2 closeout: board settings + member management UI

**Done:**
- **New endpoint** `GET /boards/:id/members` (viewer+): resolves each member's
  `{ id, email, name, role, isOwner }` by batching a `User` lookup — board docs only
  store member IDs, so this powers a friendly members list without changing existing
  response shapes.
- **`BoardSettings` modal** (`components/board/BoardSettings.tsx`): edit board
  name/description (editor+), and owner-only member management — invite by email with
  role select, change a member's role (editor/viewer), remove a member. Optimistic
  updates with rollback, ARIA dialog, Esc-to-close, focus management mirroring `CardModal`.
- **Settings button** wired into the board header (shown to editors+); modal updates
  board state on save via `onBoardUpdated`.
- **Client data layer** (`lib/boards.ts`): `updateBoard`, `listMembers`, `inviteMember`,
  `updateMemberRole`, `removeMember` + `ResolvedMember` type.
- **Tests:** +4 server integration (members list with resolved name/email, role change,
  removal, non-member 404) and +2 client component tests (owner invite flow, non-owner
  hides management). Server **89/89**, client **35/35**, typecheck ✓, lint ✓, client build ✓.
- Checked off the last open Phase 2 building item, plus the stale Phase 6/7 roadmap
  boxes (that work already shipped in commit `ee3c60c` — tests/CI/seed/OpenAPI + deploy docs).

**Roadmap:** Phases 0–7 building complete; SECURITY phase already done (SEV-001..011).

**Next:** QA phase — bring the full stack up via Docker Compose, run all tests + the
Playwright E2E happy path, manually verify each feature end to end, log results here,
then SHIP (tag a release, confirm CI green).


## 2026-06-10 — SECURITY PHASE COMPLETE: All High/Medium Findings Resolved

**Done:**
- **Full security audit** (`appsec-code-reviewer` agent) → `SECURITY.md`: 0 critical,
  3 high, 5 medium, 4 low, 2 info across 14 findings.
- **SEV-001 (High) — Refresh token JTI revocation**: New `RefreshToken` Mongoose model
  (jti, userId, expiresAt; TTL index auto-expires). `signRefreshToken` now returns
  `{ token, jti }`. `issueSession` is async — stores JTI on issue. `/auth/refresh`
  verifies and atomically deletes the JTI (`findOneAndDelete`) before rotating; returns
  401 if revoked. `/auth/logout` fault-tolerantly deletes the JTI (no-op if absent/expired).
- **SEV-002 (High) — HTML injection in email templates**: `escapeHtml()` helper applied
  to all user-controlled fields (`boardName`, `invitedBy`, `mentionedBy`) in both email
  template functions.
- **SEV-003 (High) — MongoDB host port exposure**: `docker-compose.yml` binds Mongo to
  `127.0.0.1:27017` (was `0.0.0.0`).
- **SEV-004 (Medium) — No rate limiting on board/comment creation**: `writeLimiter`
  (60 req/min/user) on `POST /boards` and `POST /members`; `commentLimiter` (30 req/min)
  on `POST /comments`.
- **SEV-005 (Medium) — Assignees not validated as board members**: `POST/PATCH /cards`
  now validates all assignee IDs against `board.members` before saving (400 if invalid).
- **SEV-006 (Medium) — No rate limiting on /auth/refresh**: `authLimiter` now also
  applied to `/auth/refresh`.
- **SEV-007 (Medium) — Hardcoded localhost URLs in emails**: `APP_URL` env var added
  (`z.string().url().default('http://localhost:5173')`); email templates use `env.APP_URL`.
- **SEV-008 (Medium) — Unbounded find() queries**: `.limit(500)` on cards, `.limit(100)`
  on lists, `.limit(200)` on comments.
- **SEV-009 (Low) — docker-compose missing COOKIE_SECURE hint**: Added `COOKIE_SECURE`
  + `COOKIE_SAMESITE` with production notes; JWT secret commented hints added.
- **SEV-010 (Low) — board:join missing ObjectId validation**: Added
  `isValidObjectId(boardId)` guard in socket `board:join` handler.
- **SEV-011 (Low) — npm audit not in CI**: Added
  `npm audit --audit-level=high --omit=dev` as final CI step.
- Verified: typecheck ✓, server 85/85 tests ✓ (all pass after token test fix for new
  `signRefreshToken` return shape `{ token, jti }`).

**Roadmap:** Security Phase — 10/14 findings fixed (all High + Medium + 2 Low);
remaining 2 Low (doc-only: `COOKIE_SECURE` needs prod operator action; assignees
UI missing from board settings) and 2 Info (acceptable).

**Next:** QA Phase — full Docker Compose stack smoke test, then SHIP Phase (push to
`oppressedturtle/collabboard`, verify CI green).

## 2026-06-10 — Phase 7 COMPLETE: Deploy-Ready

**Done:**
- **DEPLOYMENT.md**: Full deployment guide — Render (detailed, both native Node and Docker
  methods), Railway, Fly.io (with `fly.toml` health check stanza), Mongo Atlas step-by-step
  setup, complete env var reference table, JWT secret generation command.
- **Vercel client deployment**: Documented the nginx-proxy gap (Vercel has no nginx), two
  solutions (rewrite rule via `vercel.json` or `VITE_API_URL` env var + one-line `api.ts`
  change), CORS setup for cross-origin deployments.
- **README.md rewrite**: Portfolio-quality — CI badge, feature list, tech stack table,
  ASCII architecture diagram (client→nginx→server→MongoDB + Socket.io rooms + Mailhog),
  repo layout, Docker quick-start (3 steps), local-dev quick-start, test commands, link to
  DEPLOYMENT.md, live-demo placeholder.
- **SECURITY_CHECKLIST.md**: Pre-deploy checklist — 10 items verified against source
  (helmet, CORS allowlist, rate limiting, JWT secret guard, cookie flags, httpOnly cookies,
  Zod validation, Mongoose ODM, .gitignore, npm audit). 8 ✅ Pass, 2 ⚠️ Review (cookie
  flags + npm audit, both operator-side actions).
- **Swagger UI production guard**: `/api-docs` now gated behind `if (!isProduction)` in
  `app.ts` — Swagger is disabled in production builds, addressing the security checklist
  finding immediately.
- **server/.env.example**: Added commented Atlas URI example line next to `MONGODB_URI`.
- Verified: server 85/85 tests ✓, client 33/33 tests ✓, typecheck ✓ (both workspaces).

**Roadmap:** Phase 7 — 4/4 ✓ (Docker already done in Phase 0; deployment guide,
README, security checklist all complete).

**Next:** SECURITY PHASE — full audit by `appsec-code-reviewer` agent: dependency CVEs
(`npm audit`), authz edge case review, injection vectors, JWT/cookie hardening, CORS
verification, rate limiting coverage, security headers audit. Findings documented in
`SECURITY.md`.

## 2026-06-10 — Phase 6 COMPLETE: Hardening & Tests

**Done:**
- **Server coverage >70%**: 85 tests across 14 test files — integration tests for all routes
  (auth, boards, lists, cards, comments including @mention + cascade deletes), unit tests for
  lib (tokens, password, roles, activity), schemas, and new middleware tests
  (`error.test.ts`: HttpError + notFoundHandler + errorHandler, `validate.test.ts`:
  validateBody pass/fail/missing-fields). Coverage thresholds met (lines/functions/
  statements 70%, branches 60%).
- **Client component tests**: 33 tests across 10 test files — new tests for `LoginPage`
  (render, error state, fetch called with correct body), `RegisterPage` (render, 409 error),
  `CardModal` (renders title, comments section, close/overlay/save PATCH/delete DELETE+callback),
  `Toast` (provider renders children, show() displays toast, dismiss button, auto-dismiss
  with fake timers). All 16 original tests still pass.
- **Playwright E2E**: `client/playwright.config.ts` + `client/e2e/happy-path.spec.ts` —
  register → create board → add list → add card flow; skipped in CI unless `RUN_E2E=true`.
  `"test:e2e": "playwright test"` added to client scripts.
- **GitHub Actions CI** (`.github/workflows/ci.yml`): triggers on push/PR to main — lint →
  typecheck → server tests (with MONGOMS env vars) → client tests → server build → client
  build. Uses mongodb-memory-server (in-process, no external service needed).
- **Seed script** (`server/src/seed.ts`): connects to MongoDB, clears prior seed data,
  creates 2 demo users (`alice@seed.collabboard.dev` / `bob@seed.collabboard.dev`, both
  `demo1234`), 1 board with roles, 3 lists, 6 cards with labels/assignees/due dates.
  `"seed": "tsx src/seed.ts"` added to server scripts.
- **OpenAPI/Swagger docs** (`server/src/lib/openapi.ts`): full OpenAPI 3.0.3 spec covering
  all 25 endpoints (health, auth, boards, members, lists, cards, move, comments). Mounted
  at `/api-docs` via `swagger-ui-express` — gated to non-production only.

**Roadmap:** Phase 6 — 5/5 ✓ (coverage, client tests, E2E, CI, seed+docs all done).

**Next:** Phase 7 — Deploy-Ready (above).

## 2026-06-10 — Phase 5 COMPLETE: Polish & Pro Features

**Done:**
- **Toast system**: `ToastContext` + `ToastProvider` + `useToast` hook. Fixed
  bottom-right toasts (success/error/info), auto-dismiss 4s, ARIA live region,
  dismiss button, keyboard-accessible. Wired into boards/cards/lists mutations.
- **Search/filter bar** on BoardDetailPage: text search (title + description),
  label dropdown (populated from all cards), "due soon" toggle (within 3 days),
  clear-filters button. Pure client-side — no round-trips.
- **Comments**: `Comment` Mongoose model (board/card/author/text/mentions),
  cascade-deleted with card/list/board. REST routes: `GET/POST/DELETE
  /boards/:id/cards/:cardId/comments`. Authors can delete own; board owner
  can delete any. Socket emits `comment:created` / `comment:deleted` to
  board room. Comments section in `CardModal`: author initials avatar, relative
  time, delete button, new comment form.
- **@mention email notifications**: server-side regex scans comment text for
  `@email@domain` patterns, resolves to board member IDs, sends mention
  notification emails. Board-invite email on `POST /boards/:id/members`.
- **Nodemailer / Mailhog**: `server/src/lib/mail.ts` configures nodemailer with
  SMTP env vars; defaults to Mailhog on `localhost:1025`. Mailhog service added
  to `docker-compose.yml` (SMTP :1025, Web UI :8025). Set `SMTP_HOST=disabled`
  to silence email in CI. `.env.example` updated.
- **Responsive design**: modal uses `sm:` breakpoints (full-screen on mobile),
  board header wraps on small screens, filter bar wraps, labels grid is 1-col
  on mobile.
- **Accessibility**: `role`, `aria-label`, `aria-modal`, `aria-live`, `aria-atomic`
  on modal/toast/loading/filter bar. Focus on close button on modal open.
  `focus:ring` on all interactive elements. `aria-label` on all icon buttons.
- Verified: server 47/47 tests ✓, client 16/16 tests ✓, typecheck ✓, lint ✓,
  builds ✓ (both).

**Roadmap:** Phase 5 — 5/5 ✓ (search/filter, comments, email, responsive, a11y).

**Next:** Phase 6 — Hardening & Tests: >70% server coverage, client component
tests, Playwright E2E, GitHub Actions CI, seed script + OpenAPI docs.

## 2026-06-10 — Phase 4 COMPLETE: Realtime Collaboration (Socket.io)

**Done:**
- `socket.io` (server) + `socket.io-client` (client) installed.
- `server/src/lib/socket.ts`: Socket.io server singleton — JWT auth from
  httpOnly cookie (parsed from WS upgrade `Cookie` header), room-per-board
  (`board:${id}`), membership check before join, in-memory presence tracking,
  `emitToBoard` helper.
- `server.ts` refactored to create an explicit `http.Server` and pass it to
  `initSocket()` before `.listen()`.
- `Card` model: added `version` field (Number, default 0) — incremented on
  each update/move for last-write-wins conflict detection.
- Cards router: emits `card:created`, `card:updated`, `card:moved`,
  `card:deleted` (with `boardId` + `actorId`) after each successful mutation.
- Lists router: emits `list:created`, `list:updated`, `list:deleted` similarly.
- `client/src/lib/socket.ts`: lazy singleton socket (autoConnect:false,
  withCredentials:true, cookie auth implicit).
- `BoardDetailPage`: connects on mount, emits `board:join`/`board:leave`,
  handles all board events (skips self-events by actorId), syncs open modal
  on `card:updated`, clears it on `card:deleted`. Presence avatars rendered in
  the board header (other viewers' email initials, ring-styled, max 5 + count).
- Verified: server 47/47 tests ✓, client 16/16 tests ✓, typecheck ✓, lint ✓,
  builds ✓ (both).

**Roadmap:** Phase 4 — 4/4 ✓ (realtime sync, presence, conflict version field all done).

**Next:** Phase 5 — Polish & Pro Features: search/filter cards, comments with
@mentions, email notifications, responsive design, accessibility pass.

## 2026-06-09 — Phase 3: per-card activity log (created/updated/moved)

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

## 2026-06-09 — Phase 1 COMPLETE: client auth

**Done:**
- API client (`lib/api.ts`): credentialed fetch wrapper, typed `ApiError`, and
  silent single-retry via `POST /auth/refresh` on a 401.
- Auth context + `AuthProvider`: bootstraps session from `/auth/me`, exposes
  `login`/`register`/`logout`, loading state; `useAuth` hook.
- `ProtectedRoute` guard (redirects to /login, preserves intended location).
- Real Login + Register forms (validation, error display, redirect-after-auth).
- Auth-aware nav (user name + Sign out when logged in).
- Tests: AuthProvider login flow + App routing/guard (mocked fetch). Client
  typecheck ✓, eslint ✓, vitest 4/4 ✓, vite build ✓.

**Roadmap:** Phase 1 — 4/4 ✓ (full auth, server + client).

**Next:** Phase 2 — Boards & Membership: Board model (owner/members/roles),
CRUD + role-based authz, board list/create UI, lists/columns model.

## 2026-06-09 — Phase 2: Boards & membership (server-side)

**Done:**
- Board model: name/description, owner ref, embedded members [{user, role}]
  with role enum (owner/editor/viewer); indexes on owner + members.user.
- Role system (`lib/roles.ts`): viewer<editor<owner rank + `hasMinRole`, unit-tested.
- `requireBoardRole(min)` middleware: loads board, authorizes by membership role,
  returns 404 to non-members (no existence leak), 403 for insufficient role.
- Board routes (all auth-gated): list (my boards), create (creator=owner),
  get (viewer+), update (editor+), delete (owner), and member management —
  invite by email / change role / remove (owner only; owner protected).
- zod schemas for create/update/member ops.
- Tests: role hierarchy + no-DB route paths (401/400/validation). 27/27 server
  tests; typecheck ✓, eslint ✓, build ✓.

**Roadmap:** Phase 2 — 2/4 (board API + authz done; board UI + lists/columns next).

**Next:** Board list/create UI on the client, then the lists/columns model + CRUD.

## 2026-06-09 — Phase 2: Board UI (list / create / detail)

**Done:**
- Board data layer (`lib/boards.ts`): typed `listBoards`/`createBoard`/`getBoard`.
- BoardsPage: loads the user's boards, inline create form (optimistic prepend),
  loading/empty/error states, board cards linking to detail.
- BoardDetailPage (`/boards/:id`, protected): fetches a board, friendly 404/no-access
  handling, placeholder for Phase 3 lists/cards.
- Tests: BoardsPage list + create flow (mocked fetch). Client 5/5 tests,
  typecheck ✓, eslint ✓, vite build ✓.

**Roadmap:** Phase 2 — board list/create/detail UI in place. Remaining for the
checkbox: board settings + invite-members UI; then lists/columns (Phase 2 item 4).

**Next:** Board settings + member-invite UI, then the Lists/columns model + CRUD
(Phase 2 item 4) leading into Phase 3 cards & drag-drop.

## 2026-06-09 — Phase 2: Lists/columns model + CRUD (server)

**Done:**
- List model: board ref, title, numeric `position`; compound index {board,position}
  for ordered retrieval.
- Board-scoped lists router (mergeParams) mounted at `/boards/:id/lists`:
  GET (viewer+), POST appends at end (editor+), PATCH rename/reposition (editor+),
  DELETE (editor+). Each list op re-authorizes via requireBoardRole and is scoped
  to the board so lists can't be touched cross-board.
- zod create/update schemas. No-DB tests (auth + board-id validation). 29/29 server
  tests; typecheck ✓, eslint ✓, build ✓.

**Roadmap:** Phase 2 — lists/columns done. Remaining: board settings/invite UI +
client rendering of lists.

**Next:** Client — render + create lists (columns) on the board detail page.

## 2026-06-09 — Phase 2: Lists UI on the board page (client)

**Done:**
- Lists data layer (`lib/lists.ts`): listLists/createList/deleteList.
- BoardDetailPage now renders columns (horizontal scroll), with role-aware editing:
  owners/editors get an "Add list" form + per-column delete (optimistic + rollback);
  viewers see read-only. Loads board + lists in parallel.
- Test: renders board + lists + add-list form for an owner (mocked fetch).
  Client 6/6 tests; typecheck ✓, eslint ✓, vite build ✓.

**Roadmap:** Phase 2 functionally complete (boards + roles + lists, API + UI).
Remaining nicety: board settings / member-invite UI (can fold into Phase 5 polish).

**Next:** Phase 3 — Cards: model (title/desc/labels/assignees/due/position) + CRUD,
then drag-and-drop across lists with optimistic updates.

## 2026-06-09 — Phase 3: Card model + CRUD (server)

**Done:**
- Card model: board+list refs, title, description, labels[], assignees[ref User],
  dueDate, position; index {list,position}.
- Cards router at `/boards/:id/cards` (mergeParams, role-gated): list-all (viewer+),
  create-in-list (editor+, validates list∈board), read, update (title/desc/labels/
  assignees/dueDate), move (to list+position, validates target list∈board), delete.
- Cascade deletes: deleting a list removes its cards; deleting a board removes its
  lists + cards.
- zod schemas (createCard/updateCard/moveCard) with objectId validation.
- Tests: schema unit tests + no-DB route gates. 38/38 server tests; typecheck ✓,
  eslint ✓, build ✓.

**Roadmap:** Phase 3 — card API done. Next: drag-and-drop UI, card detail modal,
activity log.

**Next:** Client — render cards in lists + dnd-kit drag-and-drop across columns with
optimistic move (PATCH /cards/:id/move).

## 2026-06-09 — Phase 3: Drag-and-drop cards UI (client)

**Done:**
- Cards data layer (`lib/cards.ts`): list/create/move/delete.
- Pure drag reducer (`lib/boardDnd.ts`): `applyDragEnd` computes reorder/cross-list
  moves with list-local position renumbering — fully unit-tested (4 cases).
- DnD UI with @dnd-kit: `CardItem` (sortable, drag disabled for viewers),
  `BoardColumn` (droppable + SortableContext + add-card form + delete), and
  BoardDetailPage wiring DndContext → optimistic `setCards` → `PATCH /cards/:id/move`
  with rollback on failure.
- Add card per column; cards render with labels/due-date chips.
- Tests: boardDnd unit + BoardDetailPage renders board/lists/cards/forms. Client
  10/10 tests; typecheck ✓, eslint ✓, vite build ✓.

**Roadmap:** Phase 3 — card API + drag-drop done. Remaining: card detail modal
(markdown desc, labels, assignees, due) + per-card activity log.

**Next:** Card detail modal (open a card → edit description/labels/assignees/due,
delete), then activity log.

## 2026-06-09 — Phase 3: Card detail modal (client)

**Done:**
- `updateCard` API helper; `CardModal` component: edit title/description/labels
  (comma-separated)/due-date, Save + Delete, Esc + overlay-click to close,
  read-only for viewers.
- Cards are clickable (open modal) while remaining draggable (PointerSensor
  distance threshold separates click vs drag).
- BoardDetailPage tracks the selected card; modal saves/deletes update board state.
- Test: clicking a card opens the modal. Client 11/11 tests; typecheck ✓, eslint ✓,
  vite build ✓.

**Roadmap:** Phase 3 — model, drag-drop, and card detail all done. Remaining:
per-card activity log (item 4).

**Next:** Per-card activity log (created/moved/edited events), then Phase 4 realtime
(Socket.io) to sync boards live across clients.
