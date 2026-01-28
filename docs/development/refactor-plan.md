# EasyMo Refactor Plan (Baseline + Execution)

Date: 2026-01-28

## Purpose
This document captures the **baseline audit** and a **full implementation plan** for the refactoring report. It is the single source of truth for scope, sequencing, and acceptance criteria.

## Scope Boundaries (Non-Negotiable)
- Rwanda (RW) only
- Currency: RWF only
- UI languages: English and French only (no Kinyarwanda UI translation)
- No Twilio usage (WhatsApp Cloud API only)
- No MoMo API usage (USSD `tel:` flows only)
- All archive directories and disabled migrations must be **fully removed**, not archived

---

## Baseline Inventory (Phase 0)

### Repository Shape
- Monorepo managed with pnpm workspaces
- Node >= 18.18, pnpm >= 8
- Deno used for some Supabase function tests

### Services (`services/`)
- agent-core
- buyer-service
- ranking-service
- tracking-service
- wallet-service
- voice-bridge
- voice-gateway
- openai-responses-service
- openai-deep-research-service

### Shared Packages (`packages/`)
Selected packages (non-exhaustive):
- commons (logging + env validation)
- agents, ai, ai-core
- messaging, sms-parser
- ui, supabase-schemas
- localization / locales / i18n
- vendor-admin-core

### Migrations
- `supabase/migrations/*.sql`: 101 files
- Archive directories: **none found**
- `.skip` files: **none found**

### Existing Validation & Guardrails
- `scripts/check-env.mjs`
- `scripts/assert-no-service-role-in-client.mjs`
- `scripts/check-schema-alignment.mjs`
- `scripts/check-migrations-rls.mjs`
- `scripts/verify-migrations-before-deploy.sh`
- `scripts/deploy-check.mjs`
- `pnpm schema:verify`, `pnpm lint:migrations`, `pnpm env:check`

### CI Workflows (selected)
- `ci.yml`, `test.yml`, `lint-and-compliance.yml`, `monorepo-quality.yml`
- `supabase-migrations.yml`, `supabase-drift.yml`, `edge-functions.yml`
- `ci-secret-guard.yml`, `rls-audit.yml`, `observability-audit.yml`

### TypeScript / Lint / Format
- Multiple `tsconfig*.json` files (47 total)
- ESLint configs: `eslint.config.mjs`, `eslint.config.strict.mjs`
- Prettier config: `prettier.config.mjs`

### Testing Frameworks
- Vitest used broadly across services and packages
- Jest still present in some packages (e.g., `packages/messaging`, `packages/ai-core`, `packages/circuit-breaker`, `packages/state-machine`)

### Documentation
- Root docs trimmed to: `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `QUICK_START.md`
- Minimal docs tree rebuilt under `docs/`

---

## Gap Matrix (Report vs Reality)

| Area | Report Expectation | Current State | Gap Status |
| --- | --- | --- | --- |
| Docs cleanup | Massive root cleanup + minimal docs tree | Completed and pushed | Done |
| Migration archives | Remove archive directories | No archive dirs found; keep enforcement | Partial (needs enforcement) |
| Migration validation | New audit/manifest tooling | Some checks exist (`lint:migrations`, `schema:verify`) | Partial |
| Env validation | Dedicated env validator package | `packages/commons` already provides env validation | Partial (needs consolidation + enforcement) |
| Service contracts | Contract files + validation | Not present | Missing |
| Shared packages | Structured shared libs | Many packages exist but unstandardized | Partial |
| TS strictness | Strict base + per-service | Mixed, not enforced globally | Partial |
| ESLint rules | Strong, security-focused | Multiple configs exist; uneven enforcement | Partial |
| Testing infra | Unified test utils + contracts | Mixed frameworks, no contract tests | Partial |
| Observability | Unified logger + metrics | Partial (commons + edge logs) | Partial |
| CI/CD | Full pipeline + security scans | Many workflows exist; not unified | Partial |
| Performance | Indexes + caching | Not systematic | Missing |

---

## Full Implementation Plan

### Phase 1 — Migration & Schema Hygiene (all services)
**Goal:** Hard-stop schema drift and remove any archive baggage.

Deliverables:
- `scripts/migration-audit.mjs` (timestamp order, duplicates, prohibited strings)
- CI/pnpm hook: `pnpm migration:validate`
- Hard gate to **fail** if archive directories or `.skip` files exist

Acceptance Criteria:
- `pnpm migration:validate` passes locally and in CI
- No archive or disabled migration directories exist

### Phase 2 — Environment Variable Security (all services)
**Goal:** Unified, strict env validation and no secrets in public env.

Deliverables:
- Consolidate on `packages/commons/src/env-validation.ts` for runtime checks
- Extend `scripts/check-env.mjs` to enforce required vars and sensitive prefix rules
- Update docs: `docs/setup/environment-variables.md`

Acceptance Criteria:
- Build fails if a secret is in `NEXT_PUBLIC_*` or `VITE_*`
- All critical services validate env at startup

### Phase 3 — Service Contracts & Boundaries
**Goal:** Make service APIs explicit and testable.

Deliverables:
- Contract definitions for 2 pilot services (wallet-service, agent-core)
- Contract validator script + CI hook
- Expand to all services after pilot

Status:
- Pilot contracts created (agent-core, wallet-service)
- Validator script added (CI hook pending)

Acceptance Criteria:
- Contract validation passes for pilot services
- CI fails on missing/invalid contracts

### Phase 4 — Code Quality Hardening
**Goal:** Make strict TS/lint rules safe and incremental.

Deliverables:
- Apply strict TS options per service, one at a time
- Align ESLint rules across services with security-focused rules

Acceptance Criteria:
- Each service opt-in completed without breaking builds

Status:
- Pilot: tracking-service strict TS flags enabled (noUncheckedIndexedAccess, noImplicitOverride, noFallthroughCasesInSwitch)
- Pilot: ranking-service strict TS flags enabled (noUncheckedIndexedAccess, noImplicitOverride, noFallthroughCasesInSwitch)

### Phase 5 — Testing Unification
**Goal:** Standardize tests and add coverage where it matters.

Deliverables:
- `@easymo/test-utils` with fixtures + helpers
- Convert remaining Jest-only packages to Vitest
- Add 1–2 integration tests per critical service

Acceptance Criteria:
- All services use Vitest
- CI test step succeeds across services

Status:
- Added @easymo/test-utils package scaffold
- Migrated @easymo/messaging test runner to Vitest

### Phase 6 — Observability
**Goal:** Standard logging + metrics for key flows.

Deliverables:
- Consolidated logger in `@easymo/commons`
- Correlation IDs and PII masking enforced
- Metrics for mobility + wallet

Acceptance Criteria:
- Log format consistent across services
- Metrics endpoints available in critical services

### Phase 7 — CI/CD Consolidation
**Goal:** Reduce workflow fragmentation and enforce core checks.

Deliverables:
- Single “quality gate” workflow: lint + typecheck + migration validate + env validate
- Keep specialized workflows but reduce duplication

Acceptance Criteria:
- One authoritative CI entrypoint passes for all PRs

### Phase 8 — Performance & Security
**Goal:** Measured improvements without premature optimization.

Deliverables:
- Add indexes only after query profiling
- Implement caching where latency is proven
- Add rate limiting for high-traffic endpoints

Acceptance Criteria:
- p95 latency improvement is measurable in logs/metrics

---

## Execution Order (strict)
1. Phase 1 (migration validation + archive enforcement)
2. Phase 2 (env validation consolidation)
3. Phase 3 (service contracts, pilot services)
4. Phase 4 (TS/Lint strictness per service)
5. Phase 5 (testing unification)
6. Phase 6 (observability)
7. Phase 7 (CI/CD consolidation)
8. Phase 8 (performance/security tuning)

---

## Checklist (tracking)

- [x] Phase 1 complete (migration audit + CI hook)
- [x] Phase 2 complete (env validation enforcement)
- [ ] Phase 3 complete (contracts pilot + validator)
- [ ] Phase 4 complete (TS/Lint strictness rollout)
- [ ] Phase 5 complete (Vitest-only + test-utils)
- [ ] Phase 6 complete (logging + metrics standardization)
- [ ] Phase 7 complete (CI/CD consolidation)
- [ ] Phase 8 complete (performance/security improvements)
