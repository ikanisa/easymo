# EasyMO Coding Agent Instructions

## Overview
WhatsApp mobility platform: React/Vite admin panel + Supabase Edge Functions + NestJS microservices. **pnpm monorepo** (TypeScript 5.9, React 18, Next.js 14, Node 20, Deno 2.x). ~20k SQL lines, 12 services, 6 packages.

## ⚠️ CRITICAL: Build Requirements

### 1. Always Use pnpm ≥10.18.3 (NOT npm)
Workspace uses `workspace:*` protocol. npm breaks TypeScript/eslint deps.
```bash
npm install -g pnpm@10.18.3
pnpm install --frozen-lockfile
```

### 2. Build Shared Packages FIRST
Services fail without compiled packages. Always run:
```bash
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
pnpm build  # Now safe
```

### 3. Security Guard (Prebuild)
`scripts/assert-no-service-role-in-client.mjs` fails build if `VITE_*` or `NEXT_PUBLIC_*` vars contain: `SERVICE_ROLE`, `ADMIN_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`. Remove these from client-facing env vars.

## Build, Test & Lint

### Quick Commands
```bash
# Standard workflow
pnpm install --frozen-lockfile
pnpm --filter @va/shared build && pnpm --filter @easymo/commons build
pnpm lint           # 2 console warnings OK
pnpm exec vitest run  # 84 tests, ~6s
pnpm build          # Vite SPA, ~5s, 163KB gzipped

# Admin app (Next.js, uses npm not pnpm)
cd admin-app
npm ci && npm run lint && npm test -- --run && npm run build

# Microservices
docker compose -f docker-compose.agent-core.yml up
pnpm --filter @easymo/agent-core start:dev

# Database
supabase db push
pnpm seed:remote
pnpm --filter @easymo/db prisma:migrate:dev
```

### Test Suites
- **Vitest** (skip schema check): `pnpm exec vitest run` (84 pass)
- **Deno** (edge functions): `pnpm test:functions`
- **Jest** (services): `pnpm --filter @easymo/wallet-service test`

## CI/CD Workflows

### Main CI (.github/workflows/ci.yml)
30min timeout. Runs: pnpm install → security check → lint → type-check → vitest → deno tests → Prisma migrate.
**Common failures**: Missing shared package builds, service role in env, no DATABASE_URL.

### Admin App CI (.github/workflows/admin-app-ci.yml)
Uses npm (not pnpm). Runs: npm ci → typecheck → lint (max-warnings=0) → test → build. Also: SQL migration hygiene, RLS audit.

### Validation (.github/workflows/validate.yml)
- **Migration hygiene**: Enforces BEGIN/COMMIT wrappers (`scripts/check-migration-hygiene.sh`)
- **Deno lockfiles**: Checks supabase function locks updated

### Additive Guard (.github/workflows/additive-guard.yml)
**Blocks** modifications to existing migrations and protected paths (supabase/functions/wa-webhook/). Only new files allowed.

### Secret Guard (.github/workflows/ci-secret-guard.yml)
Scans for exposed secrets via `tools/scripts/check-client-secrets.mjs`.

## Project Structure

```
/
├── .github/workflows/    # CI: ci.yml, admin-app-ci.yml, validate.yml, additive-guard.yml
├── admin-app/            # Next.js 14 (npm, not pnpm): app/, components/, lib/, middleware.ts
├── apps/
│   ├── api/             # NestJS API (uses @easymo/commons)
│   ├── sip-webhook/     # SIP handler
│   └── voice-bridge/    # (see services/)
├── docs/                 # GROUND_RULES.md (MANDATORY), ARCHITECTURE.md
├── packages/
│   ├── commons/         # @easymo/commons - pino logging, auth
│   ├── db/              # @easymo/db - Prisma (Agent-Core DB)
│   ├── messaging/       # @easymo/messaging - Kafka
│   └── shared/          # @va/shared - TS types
├── services/             # 12 microservices: agent-core, voice-bridge, wallet-service,
│                         # ranking-service, vendor-service, buyer-service, etc.
├── src/                  # Vite React: lib/ (adapter.*.ts, types.ts), components/, pages/
├── station-app/          # Station operator UI
├── supabase/
│   ├── functions/       # Edge: admin-*, simulator, wa-webhook
│   ├── migrations/      # 20+ SQL files (~20k lines). NEW must have BEGIN/COMMIT
│   └── seed/            # Fixtures
├── scripts/              # 19 .sh, 6 .mjs (assert-no-service-role, check-migration-hygiene)
├── Makefile              # Shortcuts: make deps, build, admin
├── package.json          # Root scripts: dev, build, test, lint
├── pnpm-workspace.yaml   # services/*, packages/*, apps/*, admin-app
├── vite.config.ts        # Port 8082, @ alias
└── vitest.config.ts      # jsdom, aliases
```

**Key Configs**: eslint.config.js, tsconfig.json, tailwind.config.ts, supabase/config.toml

## MANDATORY: Ground Rules (docs/GROUND_RULES.md)

**ALL code MUST comply. PRs without compliance are REJECTED.**

### 1. Observability
Structured logging (JSON) + correlation IDs for all APIs/edge functions:
```typescript
// Supabase Edge Functions
import { logStructuredEvent } from "../_shared/observability.ts";
await logStructuredEvent("USER_CREATED", { userId, method: "whatsapp" });

// Node.js services
import { childLogger } from "@easymo/commons";
const log = childLogger({ service: "wallet-service" });
log.info({ event: "PAYMENT_PROCESSED", txId }, "Payment OK");
```

Event counters: `await recordMetric("user.created", 1, { source: "whatsapp" });`

### 2. Security
- No secrets in VITE_*/NEXT_PUBLIC_* (enforced by prebuild)
- Verify webhook signatures (WhatsApp, Twilio)
- Mask PII in logs
- Use RLS policies on all tables

### 3. Feature Flags
Gate new features (default OFF):
```typescript
const enableMarketplace = process.env.FEATURE_MARKETPLACE === 'true';
```

## Database & Migrations

### Supabase (supabase/migrations/)
**Format**: NEW migrations MUST have `BEGIN;` and `COMMIT;` (enforced by CI). Naming: `YYYYMMDDHHMMSS_description.sql`.
```bash
supabase db push              # Apply migrations
pnpm seed:remote              # Load fixtures
pnpm schema:verify            # Check alignment
```

### Agent-Core Prisma (packages/db/)
```bash
pnpm --filter @easymo/db prisma:generate         # Generate client
pnpm --filter @easymo/db prisma:migrate:dev      # Apply dev migrations
pnpm --filter @easymo/db seed                     # Seed data
```
Uses separate Postgres (not Supabase), configured via DATABASE_URL.

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Cannot find '@easymo/commons'" | Shared packages not built | `pnpm --filter @va/shared build && pnpm --filter @easymo/commons build` |
| "SECURITY VIOLATION in .env" | Server secrets in VITE_* vars | Remove SERVICE_ROLE, ADMIN_TOKEN from VITE_*/NEXT_PUBLIC_* vars |
| "Schema dump out of sync" | Missing local Supabase | Use `pnpm exec vitest run` (skips schema check) |
| apps/api type errors | Path alias issues | Build commons first, or ignore (non-critical) |
| "Ignored build scripts" warning | pnpm security | Run `pnpm approve-builds` or ignore (non-critical) |
| npm used instead of pnpm | Wrong package manager | Delete node_modules, run `pnpm install --frozen-lockfile` |

## Environment Variables

### Required (Server-side only, NO client prefix)
```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
EASYMO_ADMIN_TOKEN=your-token
ADMIN_SESSION_SECRET=min-16-chars
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6380
KAFKA_BROKERS=localhost:19092
```

### Public (Client-safe)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

## Quick Reference

```bash
# Install & Build (ALWAYS run shared first)
pnpm install --frozen-lockfile
pnpm --filter @va/shared build && pnpm --filter @easymo/commons build
pnpm build  # ~5s, 163KB gzipped

# Lint & Test
pnpm lint                      # 2 warnings OK
pnpm exec vitest run           # 84 tests, ~6s
cd admin-app && npm ci && npm test -- --run

# Dev
pnpm dev                       # Vite :8080
make admin                     # Next.js :3000
docker compose -f docker-compose.agent-core.yml up

# Database
supabase db push
pnpm seed:remote
pnpm --filter @easymo/db prisma:migrate:dev
```

**Build times**: install ~60s, build ~5s, test ~6s. CI timeout: 30min.

---

## Trust These Instructions

These are validated by running actual commands in the repo. **Use them first** before searching. Only search if:
- Instructions incomplete/contradictory
- Errors not documented here
- Need implementation details beyond build/test

**Priority**: This file → docs/GROUND_RULES.md → README.md → Service READMEs

**Remember**: pnpm only, build shared packages first, follow ground rules (observability, security, feature flags).
