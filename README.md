# CollabBoard

> Production-grade realtime collaborative Kanban board — MERN + Socket.io.

CollabBoard is a Trello-style board where teams organize work into lists and cards
and collaborate **live**: drag a card and everyone watching the board sees it move
instantly. Built as a portfolio-quality, tested, containerized, CI'd application.

## Status

🚧 **Early development.** Foundation phase. See [`ROADMAP.md`](./ROADMAP.md) for the
full plan and [`PROGRESS.md`](./PROGRESS.md) for the daily build log.

## Tech Stack

| Layer      | Tech                                              |
| ---------- | ------------------------------------------------- |
| Frontend   | React + TypeScript (Vite), Tailwind CSS           |
| Backend    | Node.js + Express + TypeScript                    |
| Realtime   | Socket.io (room-per-board, JWT-authed sockets)    |
| Database   | MongoDB + Mongoose                                 |
| Auth       | JWT access/refresh tokens, httpOnly cookies       |
| Tooling    | ESLint, Prettier, Vitest, Playwright, Docker      |
| CI/CD      | GitHub Actions                                    |

## Monorepo Layout

```
collabboard/
├── client/          # React + Vite frontend
├── server/          # Express + Socket.io API
├── docker-compose.yml
├── package.json     # npm workspaces root
└── ROADMAP.md
```

## Getting Started

> Detailed setup lands as the foundation phase completes. Quick version:

```bash
# install all workspace dependencies
npm install

# copy env templates and fill in values
cp server/.env.example server/.env

# bring up the full stack (Mongo + server + client)
docker compose up
```

## Scripts (root)

| Command             | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Run client + server in dev mode                |
| `npm run build`     | Production build of all workspaces             |
| `npm run lint`      | Lint all workspaces                            |
| `npm run typecheck` | Type-check all workspaces                      |
| `npm test`          | Run all workspace test suites                  |

## License

[MIT](./LICENSE) © 2026 Yanis
