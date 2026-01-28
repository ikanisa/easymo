---
description: "PHASE I — E2E tests + CI + runbooks."
---

# PHASE I — Quality + Ops

## I1 — E2E scenarios
Golden scenarios:
1. **WhatsApp happy path**: client msg → vendor pings → replies → shortlist → handed_off
2. **WhatsApp idempotency**: duplicate webhook → single message row
3. **WhatsApp calling consent**: consent granted → call initiated → callback processed
4. **Web buy post via chat**: anonymous session → draft → posted → suggestions → notifications
5. **Web sell listing via chat**: anonymous session → listing draft → published → inquiries
6. **Web external feed**: discovery tools → external_feed_items → links displayed
7. **Web spam moderation**: spam scenario → moderation_event → session blocked

Test files location: `test/e2e/scenarios/`

**Acceptance**:
- all scenarios pass in CI

---

## I2 — CI command docs
Document one-command test execution:
```bash
# Run all tests
pnpm test

# Run e2e tests only
pnpm test:e2e

# Run with coverage
pnpm test:coverage
```

Location: `docs/ops/ci-test-command.md`

**Acceptance**:
- commands documented and runnable

---

## I3 — Rollout + rollback runbooks
Document:
- Feature flag management
- Allowlist configuration
- Smoke test checklist
- Rollback procedures

Location: `docs/ops/rollout-runbook.v1.md`, `docs/ops/rollback-runbook.v1.md`

**Acceptance**:
- runbooks complete and reviewed
- flags OFF preserves existing behavior
