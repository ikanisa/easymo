---
description: "Master Program (Additive Only): Combine WhatsApp concierge + external discovery + anonymous web marketplace (chat-first) under one phased build program for Antigravity."
---

# MASTER PROGRAM — Marketplace Everywhere (WhatsApp + Web PWA) powered by Moltbot

## Hard Constraints
- **Additive only**: no breaking changes to existing WhatsApp marketplace
- **Moltbot is internal brain**: no direct WhatsApp sending from Moltbot
- **Strict JSON output contracts**: validated server-side
- **No cold outreach**: never WhatsApp non-opted-in vendors found via web/maps/social
- **Anonymous web**: uses Supabase Anonymous Sign-Ins; protect with captcha/rate limits
- **Feature flags**: default OFF for every new capability

---

## Workstreams

| Stream | Description |
|--------|-------------|
| **A) WhatsApp Concierge** | DB vendors + OCR + calling + validation |
| **B) External Discovery** | OpenAI web search / Gemini grounding + Maps + Social |
| **C) Web Marketplace** | Anonymous chat-first PWA + matching + notifications + external feeds |

---

## Phase Order (implement in sequence)

### Phase 0 — Governance
- Rule pack in `.agent/rules/` enforcing phase gates + acceptance checks
- Output contract enforcement for Moltbot
- **Acceptance**: Rules exist and are referenced by all tasks

### Phase A — WhatsApp Backbone (No AI)
Tasks A1–A4:
- DB migrations + inbound persist + outbound tools + coded outreach + shortlist
- **Acceptance**: end-to-end works with AI disabled

### Phase B — OCR (Gemini)
Task B1:
- OCR jobs + worker + confidence gating
- **Acceptance**: low-confidence blocks outreach; high confidence updates requirements

### Phase C — Moltbot Concierge (Allowlist)
Tasks C1–C3:
- Orchestrator loop validated + skill package + shortlist closeout
- **Acceptance**: AI path works only for allowlist; invalid outputs rejected

### Phase D — Calling (Meta)
Task D1:
- Consent + start_call tool + callbacks
- **Acceptance**: no calls without consent; blocked after handoff

### Phase E — External Discovery
Tasks E1–E3:
- vendor_leads tables + discovery tools + enrichment
- External options shown to client as links + onboarding invites
- **Acceptance**: no cold outreach; leads deduped; audit_events written

### Phase F — Web Marketplace Core (Anonymous)
Tasks F1–F6:
- Core web tables + RLS + anonymous session bootstrap
- Moltbot web skill + tools + matching + ranking + notifications
- **Acceptance**: user can post buy/sell via chat-only PWA; top 10 notified

### Phase G — Web External Feeds
Task G1:
- external_feed_items pipeline via discovery tools, gated by flags
- **Acceptance**: links-only external options shown; budgets enforced

### Phase H — Moderation + Abuse Controls
Task H1:
- moderation_events + rate limits + block rules
- **Acceptance**: spam scenario triggers block; audit trail exists

### Phase I — E2E + CI + Runbooks
Tasks I1–I3:
- Golden e2e tests for WhatsApp + web + CI commands + rollout/rollback docs
- **Acceptance**: all tests pass; flags OFF preserves old behavior

---

## Definition of Done
- WhatsApp marketplace remains stable and improved (AI optional)
- Web marketplace works anonymously, chat-first, with matching + notifications
- Discovery extends coverage safely without cold outreach
- Everything is auditable, rate-limited, and reversible via flags

---

## Related Files
- Phase task packs: `.agent/tasks/whatsapp/`, `.agent/tasks/discovery/`, `.agent/tasks/web/`
- Rule pack: `.agent/rules/`
- Output contracts: `docs/moltbot/output-contract.v1.json`, `docs/moltbot/web-marketplace-output-contract.v1.json`
- Skills: `skills/marketplace-concierge/`, `skills/community-marketplace-web/`
