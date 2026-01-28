---
description: "Operational playbook for pilot: vendor onboarding, response SLAs, human escalation, quality review, and continuous improvement loop."
---

# Workflow 18 — Pilot Ops Playbook

## Goal
Run a clean pilot without annoying vendors or confusing clients:
- Vendors know what to expect
- SLAs and batching prevent spam
- Human escalation exists for edge cases
- Feedback loop to improve

## Outputs
1) Vendor onboarding script + FAQs
2) Vendor reply template
3) SLA + rate-limits policy
4) Human escalation procedure
5) QA review checklist
6) Pilot KPIs

## Step 1 — Vendor onboarding
Create `docs/ops/vendor-onboarding.v1.md`:

### Intro message:
- Who you are (marketplace connector)
- What messages they'll receive
- How to reply (numbered format)
- What happens after shortlist
- Opt-out: "STOP"

### Quick reply format:
1. Stock: yes/no
2. Price: min–max RWF
3. Location: landmark
4. Options: colors/models

## Step 2 — Vendor preferences
Add optional fields to `vendors`:
- `is_opted_out boolean`
- `preferred_language text`
- `preferred_categories text[]`

Opted-out vendors never contacted.

## Step 3 — Rate limits
Create `.agent/rules/96_vendor_rate_limits.md`:

Per vendor:
- Max outreach/day: 20
- Cooldown: 5 minutes
- "busy" reply: exclude 2 hours

Per request:
- Max vendors: 15
- Max batches: 3
- Default batch: 5

## Step 4 — Human escalation
Create `docs/ops/human-escalation.v1.md`:

Escalate when:
- OCR unclear and client cannot clarify
- High-value request with no replies
- Repeated invalid Moltbot outputs
- Vendor complaint

Admin actions:
- Choose vendors manually
- Send manual message
- Disable calling
- Close request

## Step 5 — QA review checklist
Create `docs/ops/qa-checklist.v1.md`:

Review 10 random requests/week:
- Minimal clarifying questions?
- Vendors contacted within caps?
- Shortlist evidence-based?
- Handoff clean?
- Any PII leakage?
- Any unsolicited call?

Categorize issues:
- Taxonomy gap, prompt improvement, parsing bug, policy gating bug

## Step 6 — Weekly improvement loop
Create `docs/ops/weekly-improvement.v1.md`:

Weekly tasks:
- Update taxonomy synonyms
- Improve vendor tagging
- Add 2–3 new E2E scenarios
- Adjust stop conditions
- Review cost metrics

## Step 7 — Pilot KPIs
Create `docs/ops/pilot-kpis.v1.md`:

Track:
- time-to-first-clarification
- time-to-shortlist
- vendor reply rate
- outreach count/request
- % requests handed_off
- OCR confidence distribution
- call escalation rate
- vendor opt-out rate

## Done when
- Vendors onboarded with clear expectations
- Outreach within caps
- Admin can step in cleanly
- Weekly improvement loop operational
