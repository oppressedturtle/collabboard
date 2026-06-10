# CollabBoard — Pre-Deploy Security Checklist

**Audience:** Operators preparing a production deployment
**Last Updated:** 2026-06-10
**Summary:** Lightweight point-in-time verification of the most critical security controls before going live.

> **Assumptions documented below were verified by reading the source at commit HEAD on 2026-06-10.**
> Re-run this checklist after any significant change to `server/src/app.ts`,
> `server/src/config/env.ts`, `server/src/routes/auth.ts`,
> `server/src/middleware/auth.ts`, or `server/src/middleware/boardAccess.ts`.

---

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Helmet security headers enabled | ✅ Pass | `app.use(helmet())` is the first middleware applied in `createApp()` (`server/src/app.ts` line 27). Enables all default Helmet headers: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, etc. |
| 2 | CORS locked to configured origin allowlist (not wildcard) | ✅ Pass | `env.CORS_ORIGIN` is parsed from a comma-separated string into an array of explicit origins (`server/src/config/env.ts` lines 22–27). The `cors()` call passes this array and sets `credentials: true` — no wildcard allowed. |
| 3 | Rate limiting on auth routes (register, login) | ✅ Pass | `authLimiter` applies `express-rate-limit` (30 requests per 15-minute window, standard headers) to both `POST /auth/register` and `POST /auth/login` (`server/src/routes/auth.ts` lines 33–41). Limiter is bypassed only in `NODE_ENV=test`. |
| 4 | JWT secrets blocked in production with default values | ✅ Pass | `server/src/config/env.ts` (lines 90–102) runs a startup check: if `NODE_ENV=production` and either JWT secret contains `'change-me'`, the process logs an error and exits with code 1. The server cannot start in production with the repo defaults. |
| 5 | `COOKIE_SECURE` + `COOKIE_SAMESITE` production guidance | ⚠️ Review | Both values default to `false` / `lax` for development convenience. **Before deploying, set `COOKIE_SECURE=true` and `COOKIE_SAMESITE=strict` (or `none` if the client is on a separate origin) in your production environment.** The `.env.example` documents these keys; the env schema enforces valid enum values. |
| 6 | httpOnly cookies (no localStorage tokens) | ✅ Pass | Auth tokens are delivered exclusively via httpOnly cookies set in `server/src/lib/cookies.ts` (referenced from `issueSession` in `server/src/routes/auth.ts`). The auth middleware in `server/src/middleware/auth.ts` reads the cookie directly — tokens are never returned in response bodies or stored client-side in localStorage. |
| 7 | Input validation with Zod on all mutation endpoints | ✅ Pass | `validateBody()` middleware (`server/src/middleware/validate.ts`) wraps Zod schemas and returns 400 with field-level issues on failure. Applied to register, login (auth schemas), and all board/list/card/comment mutation routes (dedicated Zod schemas in `server/src/schemas/`). |
| 8 | MongoDB: no raw query-string interpolation (Mongoose ODM throughout) | ✅ Pass | All database access goes through Mongoose model methods (`findById`, `findOne`, `create`, `updateOne`, etc.) with typed inputs. No raw MongoDB query strings, string concatenation into queries, or `$where` operators observed in any route or model file. |
| 9 | No secrets committed (`.env` in `.gitignore`) | ✅ Pass | `.gitignore` explicitly lists `.env`, `.env.local`, and `.env.*.local` while negating `.env.example` (line 12–15). Only the example file with placeholder values is tracked in the repo. |
| 10 | `npm audit` — run before every deploy | ⚠️ Review | Run `npm audit` from the repo root immediately before deploying and resolve any high or critical findings. Paste the clean output here once verified: `[TODO: paste npm audit output or "0 vulnerabilities" confirmation before publishing]` |

---

## Action Items Before Going Live

1. Set `COOKIE_SECURE=true` in production env (item 5).
2. Set `COOKIE_SAMESITE=strict` or `none` as appropriate for your domain setup (item 5).
3. Run `npm audit` and resolve high/critical CVEs; paste clean output into item 10 (item 10).
4. Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to strong random values (minimum 32 characters). The server enforces this at startup (item 4), but generate the values before provisioning.
5. ~~Restrict `/api-docs` (Swagger UI) to non-production environments~~ — **Fixed:** `server/src/app.ts` now guards the `/api-docs` route behind `if (!isProduction)`, so Swagger UI is disabled in production builds.

---

> **Full security audit** (dependency CVEs, authz edge cases, injection vectors) is
> tracked in the SECURITY PHASE post-deployment. This checklist covers the most
> critical pre-launch controls only — it is not a substitute for a comprehensive audit.
