---
description: "Production rollout plan: environment separation, secrets, feature flags, staged enablement, rollback/kill switches, and operational runbooks. Ensures you can revert to coded workflows instantly."
---

# Workflow 10 — Deployment & Rollback

## Goal
Ship safely:
- Dev/Staging/Prod separation
- Secrets managed properly
- Feature flags default OFF
- Gradual rollout (allowlist → percentage → full)
- Instant rollback to coded workflows

## Outputs
1) Environment config spec
2) Secrets map
3) Feature flag system
4) Rollout strategy + runbook
5) Rollback strategy + runbook
6) Smoke tests + monitoring checklist

## Step 1 — Environment separation
Create `.agent/rules/80_env_separation.md`:

Environments: `development`, `staging`, `production`

Each must have:
- Own WhatsApp credentials/phone number
- Own Supabase project or schema separation
- Own Moltbot endpoint + token

**Never point dev/stage to prod WhatsApp numbers.**

## Step 2 — Secrets map
Create `docs/ops/secrets-map.v1.md`:

### WhatsApp (Meta):
- `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`

### Supabase:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### Moltbot:
- `MOLTBOT_BASE_URL`, `MOLTBOT_BEARER_TOKEN`

### OCR:
- `GEMINI_API_KEY`, `OPENAI_API_KEY` (fallback)

**Store in deploy platform secret manager. Never log, never commit.**

## Step 3 — Feature flags
- `AI_CONCIERGE_ENABLED=false` (default)
- `OCR_ENABLED=false` (default)
- `CALLING_ENABLED=false` (default)
- `AI_CONCIERGE_ALLOWLIST_PHONES`
- `AI_CONCIERGE_PERCENT_ROLLOUT`

## Step 4 — Staged rollout
Create `docs/ops/rollout-runbook.v1.md`:

### Phase 0 — Local simulation
Mock WhatsApp + vendors, verify dedupe/stop/shortlist

### Phase 1 — Staging with internal testers
Allowlist only, OCR for test images, calling OFF

### Phase 2 — Limited production pilot
≤ 50 users, max 10 vendors, calling OFF

### Phase 3 — Expand
Increase allowlist/percentage, enable calling after consent proven

Monitoring checklist per phase:
- Error rate, time-to-shortlist, vendor reply rate
- Moltbot rejection rate, OCR failures, call failures

## Step 5 — Rollback runbook
Create `docs/ops/rollback-runbook.v1.md`:

### Emergency rollback:
1. Set all flags to false
2. Confirm coded workflows active
3. Keep logging on
4. Export audit packs for debugging

### Partial rollback:
- Disable calling only
- Disable OCR only

## Step 6 — Production smoke tests
Create `docs/ops/smoke-tests.v1.md`:

1. Text request → clarification question
2. Request with location → vendor outreach
3. Vendor replies → shortlist within 6 min
4. Image → OCR job + low confidence triggers clarification
5. Consent YES → call tool allowed (staging)

## Step 7 — SLOs and safeguards
Create `.agent/rules/81_slo_safeguards.md`:

SLO targets:
- 90% requests shortlisted in ≤ 6 minutes
- 99% webhook events deduped correctly
- 0% unsolicited calls

## Done when
- Deploy to staging/prod with flags OFF
- Enable AI for single allowlisted phone safely
- Rollback in < 1 minute by flipping flags
