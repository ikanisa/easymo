---
description: "Generate client-facing shortlist from vendor replies using Moltbot, format WhatsApp-friendly output with wa.me handoff links, and close the concierge loop safely (handed_off)."
---

# Workflow 06 — Shortlist Generation + Handoff Formatting

## Goal
When the request reaches `shortlist_ready`, produce a concise shortlist that:
- ranks vendors based on availability, price, distance, SLA, confidence
- includes only vendor details (no client PII)
- ends with direct handoff links (wa.me)
- transitions request to `handed_off` and stops further outreach

## Outputs
1) Shortlist scoring + ranking rules
2) Moltbot shortlist prompt contract
3) WhatsApp message formatter (1–2 messages max)
4) State transition rules: shortlist_ready → handed_off
5) Tests: formatting, ranking, closeout

## Step 1 — Define shortlist ranking rules
Create `.agent/rules/50_shortlist_ranking.md`:

Score each vendor reply:
- Availability: in_stock +50, unclear +10, out_of_stock -100
- Price fit: within budget +20, slightly above +5
- Distance: ≤2km +15, ≤5km +10, ≤10km +5
- Reply confidence: + (confidence × 20)
- Response speed: quicker replies +10

**Hard constraints:** Max 5 items, exclude out_of_stock unless no alternatives

## Step 2 — Assemble "Shortlist Pack" for Moltbot
Create `src/shortlist/buildShortlistPack.ts`

Outputs:
- `request_id`, `normalized_need`, `client_constraints`
- `ranked_candidates` (top N with scoring breakdown)
- `policies` (handoff mode, calling, language)

## Step 3 — Moltbot shortlist contract
Moltbot must:
- Keep output ≤ 5 items
- Include only known fields (no invention)
- Assign confidence based on vendor reply evidence
- Produce brief summary_text for WhatsApp

## Step 4 — WhatsApp message formatter
Create `src/shortlist/formatForWhatsApp.ts`

Rules:
- Send at most 2 messages
- Per vendor include: Name, Price range, Stock, Location, wa.me link

Template:
> "Here are the best matches I found:"
> "1) VendorName — 15k–30k RWF — In stock — Kigali Heights — wa.me/…"
> "You can now chat them directly."

## Step 5 — State closeout rules
Create `.agent/rules/51_closeout_rules.md`:

When shortlist is sent:
1. Persist shortlist JSON to `marketplace_requests.shortlist`
2. Set state to `shortlist_ready`
3. Immediately set state to `handed_off`
4. Stop any scheduled vendor outreach

After `handed_off`:
- Store vendor replies but do not act
- New client message → new request (unless within short window)

## Step 6 — Tests
1. Formatter never exceeds 2 messages for ≤5 items
2. Links are valid wa.me format (E.164)
3. Out-of-stock vendors excluded when alternatives exist
4. After `handed_off`, scheduler stops

## Done when
- Request completes: vendor replies → shortlist → WhatsApp messages → handed_off
