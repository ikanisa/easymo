---
description: "PHASE C — Moltbot concierge (allowlist only). Strict contract validation."
---

# PHASE C — Moltbot Concierge

## C1 — Orchestrator Loop + Moltbot client + tool-only execution
Implement:
- context pack builder
- call Moltbot internal API
- validate JSON against output-contract schema
- execute plan via tools only
- fallback to coded path on invalid output
- feature flags + allowlist

**Acceptance**:
- allowlisted users use AI
- non-allowlisted use coded
- invalid output rejected + audited

---

## C2 — Skill package marketplace-concierge
Create:
- prompt/policies/examples
- injection scenarios

**Acceptance**:
- examples validate; injections safe

---

## C3 — AI shortlist closeout
Implement:
- evidence-only shortlist
- 2 messages max
- mark handed_off

**Acceptance**:
- closes loop reliably

**Rollback**:
- AI_CONCIERGE_ENABLED=false
