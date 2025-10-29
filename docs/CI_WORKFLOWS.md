# CI/CD Workflows Documentation

This document provides detailed information about all GitHub Actions workflows in the EasyMO repository, including their purpose, triggers, common failure modes, and troubleshooting steps.

## Table of Contents

- [Overview](#overview)
- [Workflows](#workflows)
  - [1. CI Workflow (ci.yml)](#1-ci-workflow-ciyml)
  - [2. Admin App CI (admin-app-ci.yml)](#2-admin-app-ci-admin-app-ciyml)
  - [3. Validate (validate.yml)](#3-validate-validateyml)
  - [4. Additive Guard (additive-guard.yml)](#4-additive-guard-additive-guardyml)
  - [5. Secret Guard (ci-secret-guard.yml)](#5-secret-guard-ci-secret-guardyml)
  - [6. Node.js CI (node.yml)](#6-nodejs-ci-nodeyml)
  - [7. OpenAPI Lint (openapi-lint.yml)](#7-openapi-lint-openapi-lintyml)
  - [8. Supabase Deploy (supabase-deploy.yml)](#8-supabase-deploy-supabase-deployyml)
  - [9. Synthetic Checks (synthetic-checks.yml)](#9-synthetic-checks-synthetic-checksyml)
- [Common Failure Modes](#common-failure-modes)
- [Environment Variables](#environment-variables)
- [Expected Timings](#expected-timings)

---

## Overview

The EasyMO repository uses GitHub Actions for continuous integration and deployment. All workflows are located in `.github/workflows/` and are triggered automatically on push or pull request events.

**Key Principles:**
- All workflows require `pnpm` as the package manager
- Security checks run on every build to prevent secret exposure
- Schema verification ensures database consistency
- Additive-only migrations prevent breaking changes

---

## Workflows

### 1. CI Workflow (ci.yml)

**Purpose:** Main continuous integration pipeline that builds, lints, tests, and validates the entire codebase.

**Triggers:**
- Push to `main` branch
- Pull requests to any branch

**Jobs:**
1. Build and test the entire workspace
2. Run linting and type checking
3. Execute unit tests
4. Run Deno tests for Supabase functions
5. Build shared packages
6. Apply Prisma migrations

**Required Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string for testing
- `NODE_OPTIONS`: Memory allocation for Node.js (default: `--max_old_space_size=4096`)

**Expected Duration:** 15-20 minutes

**Common Failure Modes:**

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Missing dependencies | `pnpm install` warnings, module not found errors | Run `pnpm install` locally and commit `pnpm-lock.yaml` |
| Type errors | `pnpm type-check` fails with TypeScript errors | Fix type mismatches, ensure all tsconfig.json files are valid |
| Test failures | Unit tests fail in CI but pass locally | Ensure all environment variables are set, check for timing issues |
| Schema mismatch | Schema verification fails | Run `supabase db dump > latest_schema.sql` and update checksum |
| Out of memory | Node process killed during build | Increase `NODE_OPTIONS` memory limit |
| Service role exposure | Security check fails | Remove any `NEXT_PUBLIC_` or `VITE_` prefixed secret variables |

**Troubleshooting Steps:**

1. **Build Failures:**
   ```bash
   # Locally reproduce the CI build
   pnpm install --frozen-lockfile
   pnpm build
   ```

2. **Type Check Failures:**
   ```bash
   # Run type checking locally
   pnpm type-check
   
   # Check specific tsconfig files
   tsc --noEmit -p apps/api/tsconfig.json
   ```

3. **Test Failures:**
   ```bash
   # Run tests with same options as CI
   pnpm test -- --runInBand
   
   # Check Deno tests
   deno test --no-check --allow-env --allow-read --allow-net supabase/functions/_shared
   ```

4. **Migration Failures:**
   ```bash
   # Apply migrations locally
   pnpm --filter @easymo/db prisma:migrate:deploy
   ```

---

### 2. Admin App CI (admin-app-ci.yml)

**Purpose:** Dedicated CI pipeline for the Next.js admin application.

**Triggers:**
- Push to `main` branch
- Pull requests that modify admin-app or related files

**Jobs:**
1. Install dependencies
2. Run admin app specific tests
3. Build the admin application
4. Run smoke tests

**Expected Duration:** 10-15 minutes

**Common Failure Modes:**

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Build failures | Next.js build errors | Check for missing environment variables, ensure all pages compile |
| Smoke test failures | E2E tests fail | Verify test fixtures are up to date, check for API changes |
| Missing public assets | 404 errors in build | Ensure all referenced assets exist in `public/` directory |

**Troubleshooting Steps:**

1. **Local Admin Build:**
   ```bash
   cd admin-app
   pnpm build
   pnpm start
   ```

2. **Run Smoke Tests:**
   ```bash
   pnpm --filter @easymo/admin-app exec vitest run --config vitest.config.smoke.cjs
   ```

---

### 3. Validate (validate.yml)

**Purpose:** Runs hygiene checks on migrations and Deno lockfiles.

**Triggers:**
- Pull requests
- Push to `main` branch

**Jobs:**
1. Check migration hygiene (additive-only, proper formatting)
2. Verify Supabase function lockfiles are up to date

**Expected Duration:** 1-2 minutes

**Common Failure Modes:**

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Migration modified | Existing migration file changed | Revert changes and create a new migration instead |
| Missing lockfile | Deno lockfile out of sync | Run `deno cache --reload --lock=deno.lock --lock-write supabase/functions/**/*.ts` |
| Non-additive change | Migration contains DROP or ALTER | Refactor to use additive-only patterns |

**Troubleshooting Steps:**

1. **Check Migration Hygiene:**
   ```bash
   bash scripts/check-migration-hygiene.sh
   ```

2. **Update Deno Lockfiles:**
   ```bash
   bash scripts/check-deno-lockfiles.sh
   ```

---

### 4. Additive Guard (additive-guard.yml)

**Purpose:** Enforces additive-only changes to critical paths (migrations, edge functions).

**Triggers:**
- Pull requests only

**Rules:**
- Existing migrations cannot be modified
- Certain edge functions are protected from changes
- Only new files can be added to protected directories

**Expected Duration:** < 1 minute

**Common Failure Modes:**

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Migration modified | Guard fails on existing migration | Create a new migration file instead of modifying existing ones |
| Protected path modified | Guard fails on forbidden path | Check if changes are necessary, create new files instead |

**Troubleshooting Steps:**

1. **Check Changed Files:**
   ```bash
   git diff --name-only origin/main HEAD
   ```

2. **Revert and Create New:**
   ```bash
   # Revert the modified migration
   git checkout origin/main -- supabase/migrations/existing_migration.sql
   
   # Create a new migration
   supabase migration new your_change_description
   ```

---

### 5. Secret Guard (ci-secret-guard.yml)

**Purpose:** Prevents accidental exposure of service role keys and other secrets in client-side code.

**Triggers:**
- Push to `main` branch
- Pull requests

**Checks:**
- No `NEXT_PUBLIC_` or `VITE_` variables contain secrets
- Service role keys are not exposed
- Forbidden names are not used in public environment variables

**Expected Duration:** < 1 minute

**Common Failure Modes:**

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Service role exposed | Guard detects `SERVICE_ROLE` in public var | Remove from `NEXT_PUBLIC_` or `VITE_` variables |
| Secret in env file | Guard finds secrets in `.env` | Move to `.env.local` or use server-side only variables |
| Token in client code | Build-time secret detection | Refactor to use server-side API calls |

**Troubleshooting Steps:**

1. **Run Secret Check Locally:**
   ```bash
   node scripts/assert-no-service-role-in-client.mjs
   ```

2. **Check Environment Variables:**
   ```bash
   # List all public environment variables
   env | grep -E '^(NEXT_PUBLIC_|VITE_)'
   ```

3. **Fix Secret Exposure:**
   - Remove `NEXT_PUBLIC_` or `VITE_` prefix from secret variables
   - Use server-side API routes or edge functions instead
   - Update `.env.example` with proper placeholder values

---

### 6. Node.js CI (node.yml)

**Purpose:** Extended Node.js testing across multiple Node versions and platforms.

**Triggers:**
- Push to `main` branch
- Pull requests

**Matrix Testing:**
- Node versions: 18.x, 20.x
- Operating systems: ubuntu-latest, macos-latest (optional)

**Expected Duration:** 15-25 minutes (per matrix combination)

**Common Failure Modes:**

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Version-specific failures | Tests pass on one Node version but fail on another | Check for Node version-specific APIs, update package.json engines |
| Platform-specific issues | Tests fail on specific OS | Check for path separator issues, use Node.js path utilities |

---

### 7. OpenAPI Lint (openapi-lint.yml)

**Purpose:** Validates OpenAPI specifications for API documentation.

**Triggers:**
- Pull requests that modify API specs
- Push to `main` branch

**Expected Duration:** 1-2 minutes

**Common Failure Modes:**

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Invalid OpenAPI spec | Linter reports validation errors | Fix spec according to OpenAPI 3.0/3.1 standards |
| Missing required fields | Schema validation fails | Add required fields (info, paths, etc.) |

---

### 8. Supabase Deploy (supabase-deploy.yml)

**Purpose:** Deploys Supabase Edge Functions to production.

**Triggers:**
- Manual workflow dispatch
- Push to `main` branch (with appropriate filters)

**Required Secrets:**
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`

**Expected Duration:** 3-5 minutes

**Common Failure Modes:**

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Authentication failure | Deploy fails with auth error | Verify `SUPABASE_ACCESS_TOKEN` is valid |
| Function build error | Edge function fails to compile | Test function locally with `supabase functions serve` |
| Missing dependencies | Runtime errors after deploy | Ensure all imports are compatible with Deno |

**Troubleshooting Steps:**

1. **Test Function Locally:**
   ```bash
   supabase functions serve function-name --env-file .env.local
   ```

2. **Manual Deploy:**
   ```bash
   supabase functions deploy function-name
   ```

---

### 9. Synthetic Checks (synthetic-checks.yml)

**Purpose:** Runs automated health checks against production endpoints.

**Triggers:**
- Scheduled (cron)
- Manual workflow dispatch

**Checks:**
- Admin API health endpoint
- Database connectivity
- Storage bucket accessibility

**Expected Duration:** 2-5 minutes

**Common Failure Modes:**

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Endpoint unreachable | HTTP timeout or 5xx errors | Check service status, verify DNS/routing |
| Auth failures | 401/403 responses | Verify API tokens are valid and not expired |
| Database connection issues | Connection timeout | Check database availability and connection strings |

---

## Common Failure Modes

### 1. Missing Environment Variables

**Symptoms:**
- Build fails with "undefined" errors
- Tests fail with missing configuration

**Solution:**
```bash
# Copy example file and fill in values
cp .env.example .env
# Ensure all CHANGEME_* values are replaced
```

### 2. Schema and Migration Mismatches

**Symptoms:**
- Schema verification fails
- Checksum mismatch errors

**Solution:**
```bash
# Update schema dump after migrations
supabase db dump --schema public > latest_schema.sql

# Update checksum in latest_schema.sql
# Add comment: -- MIGRATIONS_CHECKSUM: <computed-hash>
node scripts/check-schema-alignment.mjs
```

### 3. Dependency Issues in Recursive Builds

**Symptoms:**
- "Module not found" errors during build
- Workspace dependency resolution failures

**Solution:**
```bash
# Clean install
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install

# Build dependencies in correct order
pnpm --filter @easymo/shared build
pnpm --filter @easymo/messaging build
pnpm build
```

### 4. TypeScript Path Resolution Errors

**Symptoms:**
- "Cannot find module" in TypeScript files
- Import path errors during build

**Solution:**
- Verify `tsconfig.json` extends correct base config
- Check `paths` configuration matches actual file structure
- Ensure `baseUrl` is set correctly
- Run `pnpm type-check` to validate

### 5. Out of Memory Errors

**Symptoms:**
- "JavaScript heap out of memory"
- Process killed during build

**Solution:**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max_old_space_size=4096"
pnpm build
```

---

## Environment Variables

All workflows require certain environment variables to be set. These are managed through:

1. **GitHub Secrets**: For sensitive production values
2. **Workflow Environment**: For CI-specific configuration
3. **Repository Variables**: For non-sensitive shared values

See [ENV_VARIABLES.md](./ENV_VARIABLES.md) for detailed documentation.

---

## Expected Timings

Use these benchmarks to identify performance issues:

| Workflow | Expected Duration | Timeout |
|----------|------------------|---------|
| CI (ci.yml) | 15-20 minutes | 30 minutes |
| Admin App CI | 10-15 minutes | 25 minutes |
| Validate | 1-2 minutes | 5 minutes |
| Additive Guard | < 1 minute | 2 minutes |
| Secret Guard | < 1 minute | 2 minutes |
| Node.js CI | 15-25 minutes | 30 minutes |
| OpenAPI Lint | 1-2 minutes | 5 minutes |
| Supabase Deploy | 3-5 minutes | 10 minutes |
| Synthetic Checks | 2-5 minutes | 10 minutes |

**Performance Tips:**
- Use `pnpm --frozen-lockfile` in CI to avoid unnecessary dependency resolution
- Enable caching for Node.js and pnpm with GitHub Actions cache
- Run independent jobs in parallel when possible
- Use `--runInBand` for tests to avoid concurrency issues

---

## Getting Help

If you encounter issues not covered in this document:

1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common problems
2. Review workflow logs in GitHub Actions UI
3. Run the failing step locally to reproduce
4. Check for recent changes that might have introduced the issue
5. Consult the team in the development chat

---

**Last Updated**: 2025-10-29  
**Maintained by**: EasyMO Platform Team
