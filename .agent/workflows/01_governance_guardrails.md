---
description: "Set up governance + guardrails for Moltbot-as-internal-agent API, OCR, vendor outreach, and WhatsApp calling. Creates rule pack skeleton and enforces safe agent behavior."
---

# Workflow 01 — Governance & Guardrails (Moltbot Internal Agent API)

## Goal
Lock down agent behavior so the project stays safe, auditable, and reversible:
- Moltbot is reasoning only (internal API), never the WhatsApp transport.
- OCR is confidence-scored; low confidence => clarify, no guessing.
- Calling requires explicit consent + strict triggers.
- Every tool call is logged with request_id for audit.

## Step 1 — Create workspace rule pack folder + baseline rules
Create the workspace rules directory and add the baseline rule files:
- `.agent/rules/00_project_identity.md`
- `.agent/rules/01_security_privacy.md`
- `.agent/rules/02_architecture_boundaries.md`
- `.agent/rules/03_tooling_idempotency_logging.md`
- `.agent/rules/04_calling_consent_policy.md`
- `.agent/rules/05_ocr_safety_policy.md`

Each rule file MUST include:
- Purpose
- Do / Don't bullets
- Required artifacts (logs, test, rollback)
- "Escalation" clause: when to stop and ask the human

## Step 2 — Write the baseline rules (content requirements)

### 00_project_identity.md
- Project: WhatsApp multivendor marketplace concierge (connects clients to vendors; no payments/orders).
- Roles: client, vendor, admin.
- Handoff model: shortlist then client chats vendors directly.

### 01_security_privacy.md
- Never expose secrets in logs or chat.
- Never forward client phone to vendors before handoff.
- Store explicit consent for calling (who consented, when, scope, expiry).

### 02_architecture_boundaries.md
- WhatsApp transport remains in existing Meta WhatsApp Business API service.
- Moltbot is internal "brain service" only.
- OCR runs in isolated pipeline; output is structured + confidence.
- Any external side-effect must go through a tool (no "imaginary sending messages").

### 03_tooling_idempotency_logging.md
- Every inbound message => `event_id`.
- Every concierge request => `request_id`.
- Every tool call includes `request_id`, `actor`, `input_hash`, `output_hash`.
- Vendor outreach must be idempotent (avoid duplicate pings).

### 04_calling_consent_policy.md
- Call is allowed only if:
  1) client requested a call OR opted-in explicitly, AND
  2) purpose matches allowed triggers, AND
  3) a chat fallback exists.
- Default to chat. Calls are escalation, not primary.

### 05_ocr_safety_policy.md
- OCR output must include `confidence` per field.
- For medical prescriptions: if drug/dose unclear => ask clarifying question, do not guess.
- Keep "uncertain" flags visible in shortlist notes.

## Step 3 — Configure Antigravity to require review for actions
In Antigravity settings:
- Terminal execution policy: ask for approval (no auto-run).
- Review policy: ask for approval before major changes.
- Browser allowlist: only trusted docs (Meta, Supabase, Moltbot/clawdbot, Google, OpenAI docs).

## Step 4 — Add "Kill Switch" requirement
Add a required feature flag design:
- `AI_CONCIERGE_ENABLED=false` instantly falls back to coded workflows.
- `CALLING_ENABLED=false` disables call tool usage.
- `OCR_ENABLED=false` disables OCR pipeline.

## Done when
- Rule pack exists in `.agent/rules/`
- The team can run `/01_governance_guardrails` and it always:
  - keeps Moltbot internal-only,
  - enforces consent before calling,
  - enforces OCR confidence + clarification,
  - requires audit logs + rollback plan.
