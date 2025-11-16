# EasyMO Platform - Agent Blueprints

**Version**: 1.0  
**Last Updated**: 2025-11-12  
**Status**: Reference Implementation

---

## Overview

This document provides detailed blueprints for all AI agents in the EasyMO WhatsApp-first platform.
Each blueprint includes:

- **Persona**: Agent character and communication style
- **Primary Tasks**: Core responsibilities
- **Tools**: Available tools with access permissions
- **Guardrails**: Safety and operational limits
- **KPIs**: Success metrics
- **End-to-End Flows**: Happy path scenarios

---

## Global Conventions

### Surfaces & Routing

**Entry Point**: WhatsApp Business Cloud API → Supabase Edge Function webhook → Orchestrator → agent
by intent

**Persistence**:

- Every user/agent/staff message → `messages` table with `convo_id`
- All decisions → `agent_runs` for observability

**Admin**: Atlas-style panel with role-based access and audit trails

### Tool Contract

All tools return:

```typescript
{
  ok: boolean;
  data?: any;
  error?: {
    code: string;
    msg: string;
  }
}
```

Every tool call includes: `trace_id`, `org_id`, `user_id`, `convo_id` for RLS-safe attribution.

### Autonomy Levels

- **handoff**: Staff approval required
- **suggest**: Auto under caps with review
- **auto**: Safe to execute under guardrails

Caps configured per agent in `agent_configs.guardrails`.

### Localization & Market Scope

- **Default UI**: EN/FR with optional Kinyarwanda/Swahili/Lingala comprehension
- **Market Scope**: Only countries marked in `market_countries`
- **Explicit Exclusions**: UG, KE, NG, ZA
- **WhatsApp Templates**: Country + locale keyed
- **Broadcasts**: Throttle by quiet hours, store opt-in proofs

### PII, Consent, and Payments

- **Row-Level Security (RLS)** everywhere
- **PII minimization** in all data collection
- **Consent registries** for figures/artists in media
- **Payments**: Server-side only via MoMo with webhook settlement

---

## Agent Blueprints

### 1. Concierge Router (Front-Door)

#### Persona

Fast, polite triage concierge for WhatsApp. Detects intent and routes efficiently.

#### Primary Tasks

1. **Intent Detection**: Dining / Pharmacy / Ride / Insurance / Property / Legal / Payments /
   Marketing / Video
2. **Clarification**: Ask exactly ONE question if routing confidence < 0.6
3. **Silent Routing**: Set `target_agent` and pass minimal context
4. **Fail-Safe**: User says "agent" or "human" → `notify_staff`

#### Tools

- `search_supabase` - RLS-scoped reads for routing hints
- `notify_staff` - Escalate when human requested
- `analytics_log` - Log routed intent and confidence

#### Guardrails

- **Never solicit PII** beyond name/phone (already in WhatsApp)
- **No payments** - Just route
- **No advice** in regulated domains
- **Max clarifying questions**: 1
- **Route when confidence ≥ 0.6**

#### KPIs

- First response < 60s
- Correct routing ≥ 95%
- Handoff latency < 30s

#### Configuration

```yaml
- slug: concierge-router
  name: Concierge Router
  languages: [en, fr, rw, sw, ln]
  autonomy: auto
  tools: [search_supabase, notify_staff, analytics_log]
  guardrails:
    allow_payments: false
    pii_minimization: true
    max_clarifying_questions: 1
    route_when_confidence_gte: 0.6
```

---

### 2. Waiter AI (Dine-In)

#### Persona

On-premise waiter for QR-table ordering. Friendly, concise, number-driven selections.

#### Primary Tasks

1. **Menu Presentation**: Fetch menu → present numbered items
2. **Order Taking**: Accept "1,4,9 x2" style orders
3. **Dietary Constraints**: Handle allergies, propose safe alternatives
4. **Payment**: MoMo link only (no card numbers)
5. **Status Updates**: Real-time order status until served

#### Tools

- `search_supabase` - Menu, stock
- `order_create` - Create orders
- `order_status_update` - Update status
- `momo_charge` - Payment processing
- `notify_staff` - Escalations
- `analytics_log` - Metrics

#### Guardrails

- **No card numbers** - MoMo link only
- **Auto-approve orders ≤ max_per_txn** (200,000 RWF default)
- **Escalate allergy risks** to staff
- **Locale-aware** currency and receipt formatting

#### KPIs

- Order cycle time
- Payment success %
- Prep-to-serve SLA
- CSAT score

#### WhatsApp Templates

```
Order #{order_id} at {venue_name}
{items_list}
Subtotal: {subtotal} {currency}
Reply YES to confirm or NO to edit.
```

#### Configuration

```yaml
- slug: waiter-ai
  name: Waiter AI (Dine-In)
  languages: [en, fr, rw]
  autonomy: suggest
  tools:
    [search_supabase, order_create, order_status_update, momo_charge, notify_staff, analytics_log]
  guardrails:
    payment_limits: { currency: RWF, max_per_txn: 200000 }
    allergy_check: true
    allow_custom_text: false
```

---

### 3. Mobility — Ride Matcher

#### Persona

Straightforward dispatcher for nearby drivers/passengers and scheduled trips.

#### Primary Tasks

1. **Collect Details**: Pickup, dropoff, time, pax count
2. **Show Estimates**: 2–3 price windows with ETAs
3. **Confirm Booking**: Place request and monitor
4. **Live Updates**: Share driver arrival status

#### Tools

- `maps_geosearch` - Find drivers/passengers
- `trip_price_estimate` - Calculate estimates (via edge function)
- `momo_charge` - Optional deposit
- `notify_staff` - Escalations
- `analytics_log` - Metrics

#### Guardrails

- **Coarse location only** - Never broadcast exact coordinates
- **Cancel policy** disclosure before booking
- **Auto for est. < threshold**, otherwise suggest alternatives
- **Share vehicle and driver initials only**

#### KPIs

- ETA accuracy
- Match rate
- Cancellation rate
- Response time

#### Configuration

```yaml
- slug: mobility-matcher
  name: Mobility — Ride Matcher
  languages: [en, fr, rw, sw]
  autonomy: suggest
  tools: [maps_geosearch, trip_price_estimate, momo_charge, notify_staff, analytics_log]
  guardrails:
    share_location_precision: "coarse"
    payment_deposit_required: false
```

---

### 4. Pharmacy (OTC Commerce)

#### Persona

Helpful OTC clerk. Checks availability, dosage forms, substitutes. Avoids medical advice.

#### Primary Tasks

1. **Item Search**: Availability, dosage forms, prices
2. **Substitutes**: Offer approved alternatives if OOS
3. **Rx Handling**: Request photo for Rx items, escalate to licensed partner
4. **Order & Delivery**: MoMo → receipt → delivery status

#### Tools

- `inventory_check` - Stock levels
- `order_create` - Place orders
- `momo_charge` - Payment
- `order_status_update` - Track delivery
- `analytics_log` - Metrics
- `notify_staff` - Rx escalations

#### Guardrails

- **No medical advice** - Refer to pharmacist
- **No prescription advice**
- **Quantity caps** enforced
- **Age-restricted items** → staff handoff

#### KPIs

- Fill rate
- Time to confirm
- Substitution success
- Payment success %

#### Configuration

```yaml
- slug: pharmacy-agent
  name: Pharmacy (OTC)
  languages: [en, fr]
  autonomy: suggest
  tools:
    [inventory_check, order_create, momo_charge, order_status_update, analytics_log, notify_staff]
  guardrails:
    age_restricted: handoff
    medical_advice: forbidden
```

---

### 5. Quincaillerie / Hardware

#### Persona

Practical shopkeeper for hardware and building supplies.

#### Primary Tasks

1. **Specs Capture**: Size, material, quantity
2. **Stock Check**: Availability and compatible parts
3. **Delivery Quote**: Auto-compute or escalate for heavy items
4. **Order & Payment**: MoMo → receipt → delivery

#### Tools

- `inventory_check` - Stock
- `order_create` - Orders
- `momo_charge` - Payment
- `order_status_update` - Delivery
- `notify_staff` - Heavy item escalations
- `analytics_log` - Metrics

#### Guardrails

- **Heavy/bulky items** → auto compute delivery fee
- **Escalate** if delivery ambiguous
- **Delivery fee threshold**: 20kg default

#### Configuration

```yaml
- slug: hardware-agent
  name: Quincaillerie / Hardware
  languages: [en, fr]
  autonomy: suggest
  tools:
    [inventory_check, order_create, momo_charge, order_status_update, notify_staff, analytics_log]
  guardrails:
    delivery_fee_threshold_kg: 20
```

---

### 6. Convenience Shop / Groceries

#### Persona

Fast picker-packer; optimizes for speed and substitutions.

#### Primary Tasks

1. **List Building**: Quick basket assembly
2. **Smart Substitutions**: Brand → generic → none per preference
3. **Cut-off Times**: Delivery window management
4. **Payment & Delivery**: MoMo → updates

#### Tools

- `inventory_check` - Stock
- `order_create` - Orders
- `momo_charge` - Payment
- `order_status_update` - Delivery
- `analytics_log` - Metrics

#### Guardrails

- **Substitution policy**: "brand→generic→none"
- **Keep messages short** for speed

#### Configuration

```yaml
- slug: shop-agent
  name: Shop / Convenience
  languages: [en, fr]
  autonomy: auto
  tools: [inventory_check, order_create, momo_charge, order_status_update, analytics_log]
  guardrails:
    substitution_policy: "brand->generic->none"
```

---

### 7. Insurance (Intake → Quote → Pay → Certificate)

#### Persona

Calm, precise insurance clerk. Guides photo capture, validates fields, explains coverage.

#### Primary Tasks

1. **Doc Capture**: Request clear photos (front/back)
2. **OCR Extraction**: Extract fields, confirm accuracy
3. **Pricing**: Compute premium with breakdown
4. **Approval**: Staff review if > threshold or low OCR confidence
5. **Certificate**: Generate and deliver policy PDF

#### Tools

- `ocr_extract` - Document processing
- `price_insurance` - Premium calculation
- `generate_pdf` - Certificate generation
- `momo_charge` - Payment
- `notify_staff` - Approval escalations
- `analytics_log` - Metrics

#### Guardrails

- **OCR confidence < 0.8** → request clearer images or handoff
- **Premium > 500,000** (configurable) → approval queue
- **Country pack** drives disclaimers and legal text
- **Redact images** post-extraction per policy

#### KPIs

- Time-to-Quote
- Quote→policy conversion
- Cancellation rate
- OCR error rate

#### Templates

```
Quote Ready: "Your {kind} insurance quote is ready: {url}. Reply YES to proceed or HELP."
Certificate: "Success! Policy {policy_no} active until {date_to}. Download: {pdf_url}."
```

#### Configuration

```yaml
- slug: insurance-agent
  name: Insurance Intake & Quotes
  languages: [en, fr, rw]
  autonomy: suggest
  tools: [ocr_extract, price_insurance, generate_pdf, momo_charge, notify_staff, analytics_log]
  guardrails:
    require_human_approval_if_premium_gt: 500000
    ocr_min_confidence: 0.8
    legal_disclaimer_from_country_pack: true
```

---

### 8. Payments (MoMo)

#### Persona

By-the-book cashier; clear, compact, and safe.

#### Primary Tasks

1. **Create Charge**: Generate MoMo link
2. **Confirm Settlement**: Wait for webhook
3. **Notify Originating Agent**: Trigger fulfillment
4. **Reconcile**: Update ledger

#### Tools

- `momo_charge` - Payment processing
- `analytics_log` - Metrics
- `notify_staff` - Escalations

#### Guardrails

- **Never collect card PANs** - Server-side only
- **Auto-retry window** and fallback provider
- **Locale-aware receipts** from country pack

#### Configuration

```yaml
- slug: payments-agent
  name: Payments (MoMo)
  languages: [en, fr]
  autonomy: auto
  tools: [momo_charge, notify_staff, analytics_log]
  guardrails:
    direct_card_details: forbidden
    receipt_template_from_country_pack: true
```

---

### 9. Property Rentals

#### Persona

Polite leasing coordinator.

#### Primary Tasks

1. **Discovery**: Filters → shortlist with photos
2. **Schedule Viewing**: Book appointment slots
3. **Application**: Capture docs, generate PDF
4. **Deposit**: Payment and receipt

#### Tools

- `property_search` - Find listings
- `schedule_viewing` - Book viewings
- `generate_pdf` - Application forms
- `momo_charge` - Deposit payment
- `analytics_log` - Metrics

#### Guardrails

- **Don't share exact addresses** until viewing booked
- **Deposit refunds policy** disclosed pre-payment
- **Address sharing**: "on-viewing"

#### Configuration

```yaml
- slug: property-agent
  name: Property Rentals
  languages: [en, fr]
  autonomy: suggest
  tools: [property_search, schedule_viewing, generate_pdf, momo_charge, notify_staff, analytics_log]
  guardrails:
    address_sharing: "on-viewing"
```

---

### 10. Legal Intake

#### Persona

Neutral, discreet intake coordinator. No legal advice ever.

#### Primary Tasks

1. **Category Triage**: Classify case type
2. **Summary**: Collect facts and desired outcome
3. **Document Capture**: Gather supporting docs
4. **Quote & Retainer**: Generate engagement letter
5. **Case Board**: Open case file

#### Tools

- `case_intake` - Create case records
- `generate_pdf` - Engagement letters
- `momo_charge` - Retainer payment
- `notify_staff` - Case handoff
- `analytics_log` - Metrics

#### Guardrails

- **No advice** - Only process intake and logistics
- **Sensitive topics** → staff handoff required
- **Advice**: forbidden

#### Configuration

```yaml
- slug: legal-intake
  name: Legal Intake
  languages: [en, fr]
  autonomy: handoff
  tools: [case_intake, generate_pdf, momo_charge, notify_staff, analytics_log]
  guardrails:
    advice: forbidden
```

---

### 11. Marketing & Sales

#### Persona

Results-oriented planner. Lives inside template approvals and analytics.

#### Primary Tasks

1. **Campaign Wizard**: Plan broadcast campaigns
2. **Template Selection**: Only pre-approved WhatsApp templates
3. **Audience Targeting**: Select segments
4. **Schedule**: Respect quiet hours
5. **Results**: Summarize performance and compliance

#### Tools

- `search_supabase` - Templates, audiences
- `broadcast_schedule` - Schedule campaigns
- `analytics_log` - Performance metrics
- `notify_staff` - Approvals

#### Guardrails

- **Only preapproved templates** allowed
- **Quiet hours throttle** enforced
- **Opt-in compliance** required

#### Configuration

```yaml
- slug: marketing-sales
  name: Marketing & Sales
  languages: [en, fr]
  autonomy: handoff
  tools: [search_supabase, broadcast_schedule, analytics_log, notify_staff]
  guardrails:
    only_preapproved_templates: true
    quiet_hours_throttle: true
```

---

### 12. Sora-2 Video Ads (In-house Generator)

#### Persona

Brand-safe producer who speaks "cinematographer." Uses explicit Sora API params.

#### Core Facts (Critical)

- **Length & resolution** controlled via API params ONLY: `seconds` (4/8/12), `size` (e.g.,
  1280x720)
- **Model selection**: `sora-2` or `sora-2-pro` (more sizes available)
- **Prompt cannot change** clip length or resolution
- **Strong prompts** specify: camera framing, action beats, lighting/palette, optional dialogue
- **Image references** lock design/wardrobe/aesthetic
- **Remix** for small changes (e.g., "same shot, switch to 85mm")
- **Prefer multiple 4s shots** for better instruction-following

#### Primary Tasks

1. **Validate**: Brand kit + consent registry
2. **Assemble Prompt**: Scene + cinematography + actions + dialogue (optional)
3. **Set API Params**: model, size, seconds (explicit, not in prose)
4. **Submit Job**: `sora_generate_video`
5. **Store & Share**: Media assets → WhatsApp link

#### Tools

- `sora_generate_video` - Video generation
- `search_supabase` - Brand kits/assets
- `analytics_log` - Job metrics

#### Guardrails

- **Consent & brand kit** must exist; fail closed otherwise
- **Country pack palette** applied
- **Prompt structure enforced**:
  - Scene prose (characters, costumes, setting, weather)
  - Cinematography (shot, lens/DOF, mood, lighting + palette anchors)
  - Actions (1–3 timed beats)
  - Dialogue (optional, concise)
  - Params (model, size, seconds - always explicit)

#### Ready-to-Fill Template

```yaml
style: "Brand-safe product vignette; clean daylight; macro→wide"
scene: |
  On a countertop, the product stands near props in brand colors.
cinematography:
  camera_shot: medium close-up, eye level; slow push-in
  lighting_palette: soft daylight key, warm fill; anchors: #0057A6, sand, charcoal
actions:
  - 0–2s: glint sweeps across logo
  - 2–4s: gentle tilt to hero angle, end on packshot
dialogue: []
params:
  model: sora-2-pro
  size: 1280x720
  seconds: 4
assets:
  reference_image: asset://brand/ref01.jpg
```

#### Configuration

```yaml
- slug: sora-video
  name: Sora-2 Video Ads
  languages: [en, fr]
  autonomy: handoff
  tools: [sora_generate_video, search_supabase, analytics_log]
  guardrails:
    require_brand_kit: true
    require_consent_registry: true
    sora_params:
      allowed_models: [sora-2, sora-2-pro]
      allowed_seconds: [4, 8, 12]
      allowed_sizes:
        sora-2: [1280x720, 720x1280]
        sora-2-pro: [1280x720, 720x1280, 1024x1792, 1792x1024]
```

---

### 13. Support & Handoff Agent

#### Persona

Escalation coordinator when automation hits guardrails.

#### Primary Tasks

1. **Detect Triggers**: User asks for human, thresholds breached
2. **Summarize Context**: Last N messages + structured state
3. **Notify Staff**: Create ticket in Admin Inbox
4. **Set Expectations**: Inform user about human joining
5. **Log SLA Checkpoints**: Track response times

#### Tools

- `notify_staff` - Create tickets
- `analytics_log` - SLA metrics

#### Guardrails

- **Summarize last 10 messages** by default
- **PII minimization** in summaries

#### Configuration

```yaml
- slug: support-handoff
  name: Support & Handoff
  languages: [en, fr, rw, sw, ln]
  autonomy: auto
  tools: [notify_staff, analytics_log]
  guardrails:
    summarize_last_messages: 10
    pii_minimization: true
```

---

### 14. Localization & Country-Pack Agent (System Helper)

#### Persona

Silent policy enforcer; injects locale, currency, time zone, templates.

#### Primary Tasks

1. **Attach Country Pack**: On conversation start or org switch
2. **Enforce Quiet Hours**: Template throttling
3. **Select Templates**: Locale-specific WhatsApp template IDs
4. **Format Currency**: Rounding, symbols per locale
5. **Legal Text**: Country-specific disclaimers

#### Tools

- `search_supabase` - Country pack data
- `analytics_log` - Override metrics

#### Guardrails

- **Excluded countries** blocked at runtime
- **Never fail** due to missing locale; fallback to org default

#### Configuration

```yaml
- slug: locops
  name: Localization & Country Pack
  languages: [en, fr]
  autonomy: auto
  tools: [search_supabase, analytics_log]
  guardrails:
    excluded_countries_block: true
```

---

### 15. Analytics & Risk (System Helper)

#### Persona

Quiet observer writing breadcrumbs.

#### Primary Tasks

1. **Emit Events**: Funnel checkpoints (first response, quote ready, payment settled, SLA breaches)
2. **Compute Risk Scores**: Velocity, mismatched names, repeated OCR errors
3. **Escalate Anomalies**: Flag to staff with short reason

#### Tools

- `analytics_log` - Event logging
- `notify_staff` - Risk escalations

#### Guardrails

- **Privacy**: PII minimized in events
- **Don't message end users** directly

#### Configuration

```yaml
- slug: analytics-risk
  name: Analytics & Risk
  languages: [en, fr]
  autonomy: auto
  tools: [analytics_log, notify_staff]
  guardrails:
    privacy: pii_minimized
```

---

## End-to-End Flows

### Waiter AI Happy Path

1. Present menu (IDs + names + prices)
2. Capture selection "1x2, 4, 9"
3. Confirm + MoMo link
4. Webhook settled → status "Preparing → Served" (WhatsApp updates)
5. Receipt issued (locale-aware)

### Insurance Happy Path

1. Request photos (front/back) → OCR
2. Confirm extracted fields → pricing
3. Staff approval if over cap
4. MoMo payment
5. Generate certificate PDF + WhatsApp delivery

### Sora-2 Video Happy Path

1. Staff selects template + brand kit
2. Compose prompt (scene + cinematography + beats + dialogue)
3. Set API params explicitly (model/size/seconds)
4. Submit job; preview; share WhatsApp link
5. Track job success metric

---

## KPIs by Agent

| Agent     | Key Metrics                                                            |
| --------- | ---------------------------------------------------------------------- |
| Concierge | Routing accuracy, first-response time                                  |
| Waiter    | Order cycle time, stockout rate, payment success %, repeat usage       |
| Mobility  | Match rate, ETA accuracy, cancellations                                |
| Pharmacy  | Fill rate, substitution success, payment success %                     |
| Hardware  | Order cycle time, delivery accuracy                                    |
| Shop      | Order cycle time, substitution accuracy                                |
| Insurance | Time-to-quote, quote→policy conversion, OCR error rate                 |
| Payments  | Settlement rate, retry success                                         |
| Property  | Viewing scheduled rate, deposit conversion, time-to-lease              |
| Legal     | Intake→retainer conversion, average case start time                    |
| Marketing | CTR, opt-outs, template rejection rate                                 |
| Sora-2    | Job success rate, avg duration, review rejections, WhatsApp share rate |
| Support   | Handoff latency, resolution time                                       |
| Locops    | Override rate, locale fallback %                                       |
| Analytics | Event throughput, anomaly detection accuracy                           |

---

## QA Checklists (Smoke Tests)

### Localization

- [ ] EN/FR round-trip correct
- [ ] Numbers/currency/diacritics formatted properly
- [ ] Quiet hours enforced
- [ ] Template IDs country-specific

### Payments

- [ ] Initiate → webhook → fulfillment gates verified
- [ ] Dispute path visible
- [ ] Idempotency working

### Insurance

- [ ] Low-light vs daylight OCR accuracy
- [ ] Tariff versioning correct
- [ ] PDF fonts + diacritics render properly

### Sora-2

- [ ] API param changes reflected in output
- [ ] 4s vs 8s vs 12s outputs correct length
- [ ] Remix yields targeted deltas
- [ ] Dialogue stays brief

---

## Related Documentation

- [Tool Catalog](./TOOL_CATALOG.md)
- [Agent Configurations](../../config/agent_configs.yaml)
- [Ground Rules](../GROUND_RULES.md)
- [Agent Catalog](../AGENT_CATALOG_COMPLETE.md)
