# Test Coverage Report

## Overview

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| **Unit Test Coverage** | TBD% | 80% | ⬜ |
| **Integration Test Coverage** | TBD% | 70% | ⬜ |
| **E2E Test Coverage** | TBD% | 60% | ⬜ |
| **Total Test Cases** | TBD | 100+ | ⬜ |

## Coverage by Service

### wa-webhook-core

| Component | Coverage | Tests |
|-----------|----------|-------|
| Router | TBD% | router.test.ts |
| Health Check | TBD% | health.test.ts |
| Signature Verification | TBD% | ../../_shared/security/__tests__/signature.test.ts |

### wa-webhook-profile

| Component | Coverage | Tests |
|-----------|----------|-------|
| Wallet Operations | TBD% | wallet.test.ts |
| Profile Management | TBD% | profile.test.ts |

### wa-webhook-mobility

| Component | Coverage | Tests |
|-----------|----------|-------|
| Nearby Search | TBD% | nearby.test.ts |
| Trip Lifecycle | TBD% | trip-lifecycle.test.ts |

### wa-webhook-insurance

| Component | Coverage | Tests |
|-----------|----------|-------|
| Claims Flow | TBD% | claims.test.ts |
| OCR Processing | TBD% | ocr.test.ts |

## How to Run Tests

```bash
# Run all tests
./scripts/run-tests-with-coverage.sh

# Run specific test suite
deno test --allow-all supabase/functions/wa-webhook-core/__tests__/

# Run with coverage
deno test --allow-all --coverage=coverage supabase/functions/

# Generate coverage report
deno coverage coverage --lcov --output=coverage/lcov.info
```

## Test Results History

| Date | Passed | Failed | Coverage |
|------|--------|--------|----------|
| TBD | TBD | TBD | TBD% |

---

*Report generated automatically by test runner*
