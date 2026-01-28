---
description: "Implement vendor outreach orchestration: selecting vendors, batching outreach, parsing replies, stop/expand logic, and preparing shortlist inputs for Moltbot. Enforces dedupe, fairness, and auditability."
---

# Workflow 05 — Vendor Outreach Orchestrator

## Goal
Turn Moltbot's `vendor_outreach_plan` into reliable execution:
- Choose the right vendors (category + geo + SLA + exclusions)
- Message vendors in batches (max 5 at a time)
- Parse replies into structured fields
- Stop early when enough matches exist; expand otherwise
- Never double-message the same vendor for the same request

## Outputs
1) Vendor selection module (Supabase query + ranking)
2) Outreach scheduler (batch send + dedupe)
3) Vendor reply parser (text → structured fields)
4) Stop/expand controller
5) Tests: dedupe, batching, stop conditions

## Step 1 — Vendor selection rules
Create `.agent/rules/40_vendor_selection.md`:

### Eligibility filters:
- `vendors.is_active = true`
- vendor has WhatsApp number
- category match
- distance filter if geo available (default 5 km, max 15 km)
- exclude: `blocked_vendor_ids`, already contacted vendors

### Ranking (deterministic):
1. Category/tag match strength
2. Distance (closer is better)
3. Response SLA (lower is better)

**Hard caps:** `max_vendors_per_request = 15`, `batch_size_max = 5`

## Step 2 — Outreach scheduler
Create `src/vendor/outreachScheduler.ts`

Algorithm:
1. Ensure request state is `vendor_outreach` or `awaiting_vendor_replies`
2. Select candidate vendors
3. For each vendor in next batch:
   - INSERT `vendor_outreach` with `status='queued'`
   - If insert succeeds: send message, update to `sent`
   - If insert fails (duplicate): skip
4. After batch: set state `awaiting_vendor_replies`
5. Notify client once: "Checking with nearby vendors…"

Idempotency key: `request:{request_id}:vendor:{vendor_id}:qset:v1`

## Step 3 — Vendor message template
Create `docs/vendor/vendor-questions.v1.md`:

Format:
- Short intro
- Client need summary (no client phone)
- 3–4 numbered questions
- Reply format hint

Questions:
1. Stock: yes/no
2. Price: min–max RWF
3. Location/landmark
4. Options (color/model)

## Step 4 — Vendor reply parser
Create `src/vendor/replyParser.ts`

Outputs:
- `availability` (in_stock | out_of_stock | unclear)
- `price_min`, `price_max` (ints, RWF)
- `location_note`, `options`, `confidence`, `warnings`

Rules:
- Parse "15k" as 15000
- If only one price: set both min/max
- If vague: confidence ≤ 0.5, availability = unclear

## Step 5 — Stop / Expand controller
Create `src/vendor/stopExpandController.ts`

Inputs: `request_id`, `stop_conditions`

Logic:
1. Count `vendor_outreach` where `status='replied'` AND `availability='in_stock'`
2. If count >= `min_replies`: mark `shortlist_ready`
3. Else if time >= `max_minutes`: proceed with best available
4. Else if contacted < `max_vendors`: send next batch
5. Else: ask client to widen scope

## Step 6 — Client updates
Create `.agent/rules/41_client_update_policy.md`:
- Send "checking vendors…" once per request
- Send "still waiting…" only if > 4 minutes and no replies
- Always send shortlist or apology within stop window

## Step 7 — Tests
1. Dedupe: same vendor cannot be inserted twice
2. Batching: never sends > 5 per cycle
3. Stop: once min_replies met, no more messages
4. Parser: handles "15k–30k", "20000", "yes available"

## Done when
- Request reaches `shortlist_ready` with clean parsed replies, no duplicates
