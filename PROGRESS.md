# CollabBoard — Build Log

Daily increments by the autonomous build pipeline. Newest first.

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
