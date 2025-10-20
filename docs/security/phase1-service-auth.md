# Phase 1 – Service Authentication & Access Control

**Objective:** gate every internal API behind verifiable authentication and request metadata so that only trusted workloads can invoke privileged operations.

---

## 1. Shared Architecture Decisions

| Topic | Decision | Notes / Follow-up |
|-------|----------|-------------------|
| Auth primitive | HMAC-signed JSON Web Tokens (JWT) exchanged between services | Short-term choice that works in containerised and serverless targets. Evaluate mTLS once gateway platform is available. |
| Issuer | `auth-service` module (new) embedded in `packages/commons` | Handles key rotation, signing utilities, and validation helpers shared by Express/Nest apps. |
| Token claims | `iss`, `aud`, `iat`, `exp`, `jti`, `scope` | Values drive per-service allow-lists and granular permissions (e.g. `buyer:intent.write`). |
| Key rotation | Two active secrets (`SERVICE_JWT_KEYS=key1,key2`) | Services accept both; signing uses first entry. Rotate via env update + deploy. |
| Request metadata | `X-Request-ID`, `X-Service-Name`, `X-Forwarded-For` enforced at ingress | Missing IDs trigger 400 before auth processing. |
| Rate limiting | Token bucket using Redis (shared for per-origin quotas) | Implemented as Express middleware, configurable per service. |

---

## 2. Deliverables & Task Breakdown

### 2.1 Core Auth Utilities
1. **Design doc update** (this file) – ✅
2. **Implement `packages/commons/src/service-auth`**
   - `signServiceJwt(payload)` – uses top key in `SERVICE_JWT_KEYS`.
   - `verifyServiceJwt(token, { audience })` – validates signature, exp, audience.
   - `buildAuthHeaders({ audience, scope, requestId })`.
   - `expressServiceAuth({ audience, scopes })` middleware (Express).
   - `nestjsServiceAuthGuard({ audience, scopes })` guard (NestJS).
   - `rateLimiter({ redisUrl, points, duration })`.
3. **Unit tests** for signing/verification, guard, and rate limiter (Vitest).

### 2.2 Ingress & Config Hardening
4. **Update `.env.example` + per-service `.env.example`** with:
   - `SERVICE_JWT_KEYS`
   - `SERVICE_JWT_ISSUER`
   - `SERVICE_NAME`
   - `REDIS_RATE_LIMIT_URL`
5. **Docker compose**: inject the above env vars and a Redis instance (reuse existing when present).
6. **Gateway/Proxy (optional)**: if using nginx/Traefik, add config to ensure `X-Request-ID` and TLS termination.

### 2.3 Service Integration (each item includes unit tests)
7. `services/buyer-service`
   - Apply Express middleware (`requestId`, rate limit, auth).
   - Require scopes: `buyer:intent.write`, `buyer:purchase.write`, `buyer:read`.
   - Add SuperTest coverage for 401/403 and success paths.
8. `services/wallet-service`
   - Protect `/wallet/*` routes; scopes `wallet:transfer.write`, `wallet:accounts.read`.
   - Ensure commission/balance endpoints require proper audience (`buyer-service`, `reconciliation-service`).
9. `services/attribution-service`
   - Guard endpoints with scope `attribution:write`.
10. `services/reconciliation-service`
    - Protect settlement endpoints with `recon:write`.
11. `services/voice-bridge`, `services/whatsapp-bot`, `services/sip-ingress`
    - Require internal JWT for analytics, outbound initiation, webhook ingestion.
    - Add signature verification (Phase 4 will build on this).
12. `services/agent-core` (NestJS)
    - Introduce guard for `/ai/*` routes; scopes `agent:tasks.write`, etc.
13. **Admin Next.js API routes**
    - When calling internal services, attach signed JWT via shared helper.

### 2.4 Tooling & Documentation
14. **CLI helper** (`scripts/sign-service-jwt.mjs`) to mint tokens for manual testing.
15. **Docs** update:
    - `README.md` – add “Service Auth” section with rollout steps.
    - `docs/security/service-tokens.md` – operational runbook, rotation procedure.
16. **CI enforcement**
    - Add lint rule/ESLint plugin ensuring protected routes import auth middleware.
    - Pipeline step to run `pnpm test --filter @easymo/*` for services touched.

---

## 3. Timeline & Ownership (Suggested)

| Week | Focus | Owner(s) |
|------|-------|----------|
| W1   | Core utilities, env updates, buyer-service integration | Backend platform team |
| W2   | Wallet + attribution + admin API adjustments, CI updates | Marketplace squad |
| W3   | Voice/WhatsApp/SIP + agent-core guard, documentation refresh | Comms squad + AI squad |

Parallel work allowed once utilities land in main. Each service PR must include auth unit tests and updated Postman/Insomnia collections where applicable.

---

## 4. Acceptance Criteria

1. Every service rejects requests without valid JWT (`401`) and with missing scopes (`403`).
2. Integration tests prove trusted tokens succeed and unauthenticated calls fail.
3. Rate limiting is configurable and covered by tests (e.g., exceeding 100 req/min returns `429`).
4. Secrets never logged; rotation path documented and rehearsal completed.
5. CI pipeline runs new tests and blocks merges on failures.

---

## 5. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Clock drift causing `iat/exp` failures | Allow ±60s skew; monitor logs for drift alerts. |
| Token leakage in logs | Redact `Authorization` headers in Pino/Nest logging. |
| Breaking existing integrations | Provide migration guide and dual-run window where both old/new auth accepted (feature flag). |
| Redis outages impacting rate limiter | Use circuit breaker to fail-open with warning if Redis unavailable. |

