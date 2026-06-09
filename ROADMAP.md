# CollabBoard — Roadmap

**Stack:** MongoDB · Express · React · Node.js · Socket.io (MERN + realtime)
**Goal:** Production-grade realtime collaborative Kanban board. Portfolio-quality: tested, containerized, CI'd, deploy-ready.
**Repo visibility:** public — https://github.com/oppressedturtle/collabboard

Each roadmap item is a self-contained increment the coder agent completes in one daily session, then commits. Check items off in order; skip ahead only if blocked.

## Phase 0 — Foundation
- [x] Monorepo layout (`/client`, `/server`), root README, LICENSE (MIT), `.gitignore`, `.editorconfig`
- [x] Server: Express + TypeScript skeleton, env config (dotenv), health endpoint, structured logging (pino)
- [x] Client: React + TypeScript (Vite), Tailwind, base layout/router, ESLint + Prettier
- [x] MongoDB connection (Mongoose), Docker Compose for local Mongo
- [x] Dockerfiles (client, server) + root `docker-compose.yml` running the full stack

## Phase 1 — Auth & Users
- [x] User model, register/login (bcrypt), JWT access + refresh tokens, httpOnly cookies
- [x] Auth middleware, protected routes, `/me` endpoint
- [x] Client auth: register/login forms, auth context, route guards, token refresh
- [x] Input validation (zod) on all auth endpoints, rate limiting on auth routes

## Phase 2 — Boards & Membership
- [x] Board model (owner, members, roles: owner/editor/viewer), CRUD endpoints
- [x] Role-based authorization middleware
- [ ] Board list + create UI, board settings, invite members by email
- [ ] Lists/columns model + CRUD, ordering

## Phase 3 — Cards & Drag-Drop
- [ ] Card model (title, description, labels, assignees, due date, position), CRUD
- [ ] Drag-and-drop UI (dnd-kit) for cards across lists, optimistic updates
- [ ] Card detail modal: description (markdown), labels, assignees, due dates
- [ ] Activity log per card

## Phase 4 — Realtime Collaboration
- [ ] Socket.io server, room-per-board, JWT-authenticated sockets
- [ ] Broadcast card/list create/update/move/delete to board members live
- [ ] Presence: show who's viewing a board (avatars), live cursors optional
- [ ] Conflict handling for concurrent edits (last-write-wins + version field)

## Phase 5 — Polish & Pro Features
- [ ] Search/filter cards, labels filter, due-soon view
- [ ] Comments on cards with @mentions + notifications
- [ ] Email notifications (invites, mentions) via nodemailer (mailhog in dev)
- [ ] Responsive design pass, loading/empty/error states, toasts
- [ ] Accessibility pass (keyboard nav, ARIA, focus management)

## Phase 6 — Hardening & Tests
- [ ] Server unit + integration tests (Vitest + supertest), >70% coverage on core
- [ ] Client component tests (Vitest + Testing Library) for key flows
- [ ] E2E happy path (Playwright): login → create board → add card → move card
- [ ] GitHub Actions CI: lint, typecheck, test, build on every push/PR
- [ ] Seed script + demo data, OpenAPI/Swagger docs for the REST API

## Phase 7 — Deploy-Ready
- [ ] Production Docker build (multi-stage), env var documentation
- [ ] Deployment guide (Render/Railway/Fly for server+Mongo Atlas, Vercel for client)
- [ ] Polished README: screenshots/GIF, feature list, architecture diagram, setup, live-demo placeholder
- [ ] Final security checklist verified (see SECURITY phase below)

## SECURITY PHASE (runs after Phase 7, by the security agent)
Full audit + fixes: dependency CVEs (`npm audit`), authz checks on every endpoint, injection (NoSQL/XSS), JWT/secret handling, CORS, security headers (helmet), rate limiting, secrets never committed, input validation coverage, file-upload hardening. Document findings + fixes in `SECURITY.md`.

## QA PHASE (after security)
Spin up the full stack via Docker Compose, run all tests, manually verify every Phase 1–5 feature works end to end. Log results in `PROGRESS.md`. Only proceed to ship when green.

## SHIP PHASE (after QA green)
Push final commits/tags to the **public** repo under `oppressedturtle`, verify CI passes, then notify Yanis for review.
