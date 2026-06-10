# CollabBoard — Build Log

Daily increments by the autonomous build pipeline. Newest first.

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
