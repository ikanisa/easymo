# Phase 3 - Quick Reference Card

## ✅ What's Done (Infrastructure)

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| Test Utils | `_shared/testing/test-utils.ts` | 650 | ✅ |
| Fixtures | `_shared/testing/fixtures.ts` | 200 | ✅ |
| Test Runner | `scripts/run-tests-with-coverage.sh` | 100 | ✅ |
| Deno Config | `supabase/functions/deno.test.json` | 20 | ✅ |
| Docs | `docs/TEST_*.md` | 140 | ✅ |

## 🚀 Quick Commands

```bash
# Verify setup
deno check supabase/functions/_shared/testing/test-utils.ts

# Run single test
deno test --allow-all path/to/test.ts

# Run all tests
./scripts/run-tests-with-coverage.sh

# Generate coverage
deno test --allow-all --coverage=coverage supabase/functions/
deno coverage coverage --lcov --output=coverage/lcov.info
```

## 📝 Create a Test (Template)

```typescript
import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { createMockSupabase, createTestSuite } from "../../_shared/testing/test-utils.ts";
import { TEST_USERS } from "../../_shared/testing/fixtures.ts";

const suite = createTestSuite("MyComponent");

suite.test("my test case", async () => {
  const supabase = createMockSupabase({
    data: { profiles: TEST_USERS.passenger },
  });
  
  const { data } = await supabase.from("profiles").select("*").single();
  assertEquals(data.user_id, TEST_USERS.passenger.user_id);
});
```

## 📦 Available Mocks

| Mock | Usage |
|------|-------|
| Supabase | `createMockSupabase({ data: {...}, error: null })` |
| WhatsApp | `createMockWhatsAppAPI()` |
| Webhook | `createMockWebhookPayload({ messageType: "text", text: "hi" })` |
| HTTP | `createMockRequest({ method: "POST", body: {...} })` |

## 📊 Next Steps (In Order)

1. **Core Tests** - `wa-webhook-core/__tests__/` (4h)
2. **Mobility Tests** - `wa-webhook-mobility/__tests__/` (4h)
3. **Insurance Tests** - `wa-webhook-insurance/__tests__/` (4h)
4. **Profile Tests** - `wa-webhook-profile/__tests__/` (4h)
5. **E2E Tests** - `_shared/testing/__tests__/e2e-flows.test.ts` (3h)
6. **CI/CD** - `.github/workflows/test.yml` (2h)
7. **UAT** - `scripts/uat/run-uat.ts` (3h)

**Total Remaining:** ~24 hours

## 📚 Key Documents

- `PHASE_3_INFRASTRUCTURE_COMPLETE.md` - Full summary
- `PHASE_3_TEST_IMPLEMENTATION_STATUS.md` - Detailed status
- `docs/TEST_COVERAGE_REPORT.md` - Coverage template
- `docs/TEST_QUALITY_CHECKLIST.md` - QA checklist

---

**Infrastructure: ✅ READY | Tests to Write: ⏳ 24h remaining**
