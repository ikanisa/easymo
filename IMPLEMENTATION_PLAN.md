# EasyMO Repository Cleanup & Fixes - Implementation Plan
**Generated**: 2025-11-27
**Priority**: CRITICAL - Pre-Production Cleanup

## 🎯 IMMEDIATE ACTIONS (Today - 2 hours)

### ✅ Step 1: Fix Failing Tests (15 min)
**Issue**: 3 tests fail due to non-existent `apps/api/src/common/env.ts`
**Root Cause**: apps/api directory doesn't exist, tests are outdated
**Action**: Remove obsolete test file

```bash
rm tests/api/env/api-env.test.ts
pnpm exec vitest run  # Verify fix
```

### ✅ Step 2: Activate OpenTelemetry (15 min)
**Status**: Config exists but not activated
**Action**: Add to .env.example

```bash
# Add to .env.example:
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
OTEL_SERVICE_NAME=easymo-production
```

### ✅ Step 3: Document Circuit Breaker Package (10 min)
**Discovery**: packages/circuit-breaker EXISTS (not reported in audit)
**Action**: Verify implementation and document usage

```bash
ls -la packages/circuit-breaker/
cat packages/circuit-breaker/README.md
```

### ✅ Step 4: Migrate DLQ from Archive (30 min)
**Issue**: DLQ only in archived webhook
**Action**: Extract and apply to active webhooks

```bash
# Review archived DLQ implementation
cat supabase/functions/.archive/wa-webhook-legacy-20251124/router/enhanced_processor.ts

# Create ticket to port DLQ to active wa-webhook-unified
```

## 📋 THIS WEEK (3-5 days)

### Step 5: Documentation Consolidation (2 days)
**Current**: 360 MD files in root
**Target**: Max 20 in root, rest in docs/

**Strategy**:
1. Identify duplicates (all *_COMPLETE.md, *_SUCCESS.md, *_DEPLOYMENT*.md)
2. Keep latest, move others to docs/archive/
3. Create master INDEX.md in docs/

```bash
# Phase 1: Move deployment docs
mkdir -p docs/archive/deployment
mv *DEPLOYMENT*.md *COMPLETE*.md *SUCCESS*.md docs/archive/deployment/

# Phase 2: Move status reports
mkdir -p docs/archive/status
mv *STATUS*.md *SUMMARY*.md docs/archive/status/

# Phase 3: Keep only essential root docs
# Keep: README.md, CONTRIBUTING.md, CHANGELOG.md, QUICKSTART.md
```

### Step 6: Standardize Admin App Package Manager (1 day)
**Issue**: admin-app uses npm, monorepo uses pnpm
**Action**: Migrate to pnpm

```bash
cd admin-app
rm -rf node_modules package-lock.json
echo 'pnpm@10.18.3' > .npmrc
pnpm install --frozen-lockfile
```

### Step 7: Resolve admin-app vs admin-app-v2 (2 hours)
**Discovery**: Both exist, unclear status
**Action**: Determine canonical version

```bash
# Compare last modification dates
ls -lta admin-app admin-app-v2

# Check which is deployed
grep -r "admin-app" netlify.toml .github/workflows/
```

## 🔍 NEXT WEEK (5-7 days)

### Step 8: Database Schema Analysis (2 days)
**Issue**: 82,393 lines of SQL is massive
**Action**: Analyze and recommend partitioning

```bash
# Find largest tables
grep -E "CREATE TABLE" supabase/migrations/*.sql | wc -l

# Analyze RLS policies
grep -E "CREATE POLICY" supabase/migrations/*.sql | wc -l

# Find candidates for partitioning
grep -E "CREATE TABLE.*(messages|events|transactions|logs)" supabase/migrations/*.sql
```

### Step 9: Complete Webhook Signature Verification (1 day)
**Status**: 9/10 handlers verified
**Action**: Find and fix missing handler

```bash
# Find the unverified handler
for handler in supabase/functions/wa-webhook*/index.ts; do
  echo "Checking $handler"
  grep -q "verify.*signature" "$handler" || echo "MISSING: $handler"
done
```

### Step 10: Add Security Scanning to CI (1 day)
**Action**: Integrate Snyk or Trivy

```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on: [push, pull_request]
jobs:
  snyk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master
        with:
          args: --severity-threshold=high
```

## 📊 SUCCESS METRICS

| Metric | Current | Target |
|--------|---------|--------|
| Root MD files | 360 | ≤20 |
| Failing tests | 3/43 | 0/43 |
| OpenTelemetry | Configured | Active |
| DLQ coverage | 0% | 100% |
| Webhook verification | 90% | 100% |
| Admin apps | 2 (confusion) | 1 (clear) |
| Security scanning | None | Active |

## 🚀 DEPLOYMENT READINESS PROGRESSION

- **Current**: 59%
- **After immediate fixes**: 65%
- **After this week**: 75%
- **After next week**: 85%
- **Production ready**: 90%+

---

**Execution Order**:
1. Fix tests (blocker for CI)
2. Activate OpenTelemetry (observability)
3. Port DLQ (reliability)
4. Consolidate docs (maintainability)
5. Security scanning (compliance)
