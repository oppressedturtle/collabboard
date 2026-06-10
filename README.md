# CollabBoard

> Production-grade realtime collaborative Kanban board — MERN + Socket.io

![CI](https://github.com/oppressedturtle/collabboard/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

---

> **Screenshot / GIF** — replace this placeholder with a screen recording of the live app

---

## Features

- **Real-time collaboration** via Socket.io — live card updates, presence avatars showing who is currently viewing a board
- **Kanban boards with drag-and-drop** (dnd-kit) — move cards across lists with optimistic updates and rollback
- **JWT authentication** — httpOnly cookies, access + refresh token rotation, silent refresh on 401
- **Role-based access control** — owner / editor / viewer per board; non-members see 404 (no existence leak)
- **Card details** — labels, assignees, due dates, and rich descriptions, all editable in a modal
- **Comments with @mention email notifications** — `@email@domain` patterns in comments trigger member notifications
- **Search and filter** — filter cards by title, label, and due-soon (within 3 days), client-side, no round-trips
- **Email notifications** via Nodemailer — board invites and @mention alerts; Mailhog captures all mail in dev
- **OpenAPI / Swagger docs** at `/api-docs`
- **GitHub Actions CI** — lint → typecheck → test → build on every push and PR

## Tech Stack

| Layer            | Technology                                              |
|------------------|---------------------------------------------------------|
| Frontend         | React 18 + TypeScript, Vite 5, Tailwind CSS 3, dnd-kit |
| Backend          | Node.js 20, Express 4 + TypeScript (ESM, strict)       |
| Database         | MongoDB 7, Mongoose ODM                                 |
| Realtime         | Socket.io — JWT-authenticated, room-per-board          |
| Auth             | JWT access (15m) + refresh (7d) tokens, httpOnly cookies, bcryptjs |
| Email            | Nodemailer + Mailhog (dev), SMTP in production         |
| Containerization | Docker (multi-stage builds), Docker Compose            |
| Testing          | Vitest + Supertest (server), Vitest + Testing Library (client), Playwright (E2E) |
| CI               | GitHub Actions                                         |

## Architecture

```
Browser
  │
  ├─ React (Vite SPA)
  │       │  REST /api/*
  │       │  WebSocket /socket.io
  │       ▼
  │     nginx  ──────────────────────────────────────────────┐
  │       │                                                   │
  │       │  reverse-proxy                                    │
  │       ▼                                                   │
  │   Express API  ◄──── Socket.io rooms (board:${id}) ─────►│
  │       │                                                   │
  │       ▼                                                   │
  │    MongoDB                                                │
  │                                                           │
  └───────────────── Mailhog (dev SMTP) ◄────────────────────┘
```

Sockets are authenticated via the same JWT stored in the httpOnly cookie; the
server parses the `Cookie` header on the WebSocket upgrade handshake. Each board
has its own Socket.io room; the API emits events to the room after every
successful card/list mutation.

## Repo Layout

```
collabboard/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── components/      # Shared UI components (CardItem, BoardColumn, CardModal, …)
│       ├── lib/             # API client, socket singleton, board DnD logic
│       ├── pages/           # Route-level page components
│       └── test/            # Test setup / helpers
├── server/                  # Express + Socket.io API
│   └── src/
│       ├── config/          # Zod-validated env config (env.ts)
│       ├── lib/             # DB, socket, tokens, mail, OpenAPI spec
│       ├── middleware/       # requireAuth, requireBoardRole, validateBody, error handler
│       ├── models/          # Mongoose models (User, Board, List, Card, Comment)
│       ├── routes/          # auth, boards, lists, cards, comments, health
│       └── schemas/         # Zod request schemas
├── docker-compose.yml       # Full local stack (mongo + server + client + mailhog)
├── package.json             # npm workspaces root
├── ROADMAP.md               # Feature roadmap with phase tracking
└── PROGRESS.md              # Daily build log
```

## Quick Start — Docker (recommended)

Runs the complete stack (MongoDB, server, client, Mailhog) in containers.

```bash
# 1. Clone the repository
git clone https://github.com/oppressedturtle/collabboard.git
cd collabboard

# 2. Copy the env template and fill in secrets
cp server/.env.example server/.env

# 3. Build and start all services
docker compose up --build
```

Open [http://localhost:5173](http://localhost:5173).
Inspect outbound emails at [http://localhost:8025](http://localhost:8025) (Mailhog UI).

> **NOTE:** The `docker-compose.yml` passes `NODE_ENV=production` to the server
> container. You must set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to strong
> random values in `server/.env` before starting — the server refuses to boot in
> production with the default dev secrets.

## Quick Start — Local Dev

Requires Node.js 20 and a running MongoDB instance (or `docker compose up mongo`
to start only the database).

```bash
# Install all workspace dependencies
npm install

# Copy and configure environment
cp server/.env.example server/.env
# Edit server/.env — set MONGODB_URI, JWT secrets, and SMTP settings

# Start client + server in watch mode
npm run dev
```

Client runs at [http://localhost:5173](http://localhost:5173); server at
[http://localhost:4000](http://localhost:4000). The Vite dev proxy forwards `/api`
and `/socket.io` to the server, mirroring the nginx production setup.

### Root Scripts

| Command                                       | What it does                        |
|-----------------------------------------------|-------------------------------------|
| `npm run dev`                                 | Run client + server in dev mode     |
| `npm run build`                               | Production build of all workspaces  |
| `npm run lint`                                | Lint all workspaces                 |
| `npm run typecheck`                           | Type-check all workspaces           |
| `npm test`                                    | Run all workspace test suites       |

## Running Tests

```bash
# Run all tests across all workspaces
npm test

# Server tests with coverage
npm run test --workspace=@collabboard/server -- --coverage

# Client tests
npm run test --workspace=@collabboard/client
```

The server suite uses Vitest + Supertest. The client suite uses Vitest + Testing
Library. Playwright E2E tests cover the login → create board → add card →
move card happy path.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full guide covering multi-stage
Docker production builds, environment variable reference, MongoDB Atlas setup,
and hosting options (Render / Railway / Fly.io for the API, Vercel for the
client).

## Live Demo

Live demo: _coming soon_

## License

[MIT](./LICENSE) © 2026 Yanis
