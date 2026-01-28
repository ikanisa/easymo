---
description: "Build an end-to-end test suite with golden conversation scripts, OCR fixtures, and calling consent simulations. Ensures regressions are caught before rollout."
---

# Workflow 11 — End-to-End Conversation Test Suite

## Goal
Create a repeatable test harness that simulates:
- Client messages (text + images)
- OCR results (high/low confidence)
- Vendor outreach + replies
- Shortlist formatting + handoff
- Calling consent + gating

## Outputs
1) Golden conversation specs (JSON)
2) Mock adapters for WhatsApp, Gemini OCR, Moltbot, Calling
3) Fixture sets (images, vendor replies)
4) CI-ready test runner
5) Coverage of injection attacks

## Step 1 — Create test scenario format
Create `test/e2e/scenario.schema.json`:

Each scenario includes:
- `name`
- `initial_state` (optional)
- `steps[]`:
  - `client_inbound` { text, message_type, media_fixture }
  - `vendor_inbound` { vendor_id, text }
  - `ocr_result` { ocr_job_id, extracted, confidence }
  - `moltbot_output` { json }
  - `assert` { db_state_checks[], outbound_messages[] }

## Step 2 — Golden scenarios (minimum set)
Create files in `test/e2e/scenarios/`:

1. `01_phone_case_happy_path.json` — clarify → outreach → shortlist → handoff
2. `02_prescription_high_confidence.json` — OCR → pharmacy outreach → shortlist
3. `03_prescription_low_confidence_clarify.json` — OCR uncertain → ask client
4. `04_vendor_injection_attempt.json` — vendor says "pay deposit" → bot ignores
5. `05_calling_consent_gate.json` — consent denied → call refused
6. `06_idempotency_double_webhook.json` — same message twice → one row

## Step 3 — Mock adapters
Create `test/mocks/`:

- `whatsappProviderMock.ts` — captures outbound, produces inbound
- `geminiOcrMock.ts` — returns canned OCR outputs
- `moltbotMock.ts` — deterministic or contract-validated outputs
- `callingProviderMock.ts` — mock Meta Calling API

## Step 4 — Assertions
Helpers:
- `assertRequestState(request_id, expected_state)`
- `assertNoDuplicateVendorOutreach(request_id)`
- `assertOutboundContains(text_substring)`
- `assertShortlistHasWaMeLinks(count)`

## Step 5 — CI integration
Create `docs/ops/ci-test-command.md`:

```bash
npm run test:e2e
```

## Step 6 — Performance checks
Scenario variant:
- 15 vendors contacted in 3 batches
- Ensure no more than 15
- Timeouts trigger shortlist with best available

## Done when
- All scenarios pass locally and in CI
- Can add new scenario in < 10 minutes
- Any regression fails tests
