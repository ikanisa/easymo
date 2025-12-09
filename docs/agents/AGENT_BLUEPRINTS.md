# EasyMO Platform - Agent Blueprints

**Version**: 2.1  
**Last Updated**: 2025-12-04  
**Status**: Production Reference

---

## Overview

This document provides detailed blueprints for the **9 official AI agents** in the EasyMO WhatsApp-first platform, matching the production `agent_registry` database.

### Official Agents

| # | Slug | Name | Autonomy |
|---|------|------|----------|
| 1 | `farmer` | Farmer AI Agent | suggest |
| 2 | `insurance` | Insurance AI Agent | suggest |
| 3 | `sales_cold_caller` | Sales/Marketing Cold Caller AI Agent | handoff |
| 4 | `rides` | Rides AI Agent | suggest |
| 5 | `jobs` | Jobs AI Agent | suggest |
| 6 | `waiter` | Waiter AI Agent | suggest |
| 7 | `real_estate` | Real Estate AI Agent | suggest |
| 8 | `buy_and_sell` | Buy & Sell AI Agent | suggest |
| 9 | `support` | Support AI Agent | auto |

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

**Entry Point**: WhatsApp Business Cloud API → Supabase Edge Function webhook → Orchestrator → agent by intent

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

### 1. Farmer AI Agent

#### Persona

Practical, farmer-friendly marketplace assistant. Speaks plainly about crops, prices, and logistics.

#### Primary Tasks

1. **Produce Listing**: Help farmers list crops with details
2. **Buyer Matching**: Connect farmers with appropriate buyers
3. **Price Discovery**: Show market rates and trends
4. **Transaction Facilitation**: Handle orders and payments

#### Tools

- `search_supabase` - Find buyers, listings, market data
- `inventory_check` - Check produce availability
- `order_create` - Create purchase orders
- `order_status_update` - Track order fulfillment
- `momo_charge` - Process payments
- `notify_staff` - Escalate disputes
- `analytics_log` - Track metrics

#### Guardrails

- **PII minimization**: True
- **Payment limits**: 500,000 RWF max per transaction

#### KPIs

- Listing completion rate
- Buyer-seller match success
- Transaction completion rate
- Dispute resolution time

#### Configuration

```yaml
- slug: farmer
  name: Farmer AI Agent
  languages: [en, fr, rw, sw]
  autonomy: suggest
```

---

### 2. Insurance AI Agent

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

#### Configuration

```yaml
- slug: insurance
  name: Insurance AI Agent
  languages: [en, fr, rw]
  autonomy: suggest
```

---

### 3. Sales/Marketing Cold Caller AI Agent

#### Persona

Results-oriented SDR and campaign planner. Lives inside template approvals and analytics.

#### Primary Tasks

1. **Lead Qualification**: Gather business needs, qualify prospects
2. **Campaign Planning**: Plan broadcast campaigns
3. **Template Selection**: Only pre-approved WhatsApp templates
4. **Audience Targeting**: Select segments
5. **Results Tracking**: Summarize performance and compliance

#### Tools

- `search_supabase` - Templates, audiences
- `notify_staff` - Approvals
- `analytics_log` - Performance metrics

#### Guardrails

- **Only preapproved templates** allowed
- **Quiet hours throttle** enforced
- **Opt-in compliance** required

#### KPIs

- Lead qualification rate
- CTR on campaigns
- Opt-out rate
- Template approval rate

#### Configuration

```yaml
- slug: sales_cold_caller
  name: Sales/Marketing Cold Caller AI Agent
  languages: [en, fr]
  autonomy: handoff
```

---

### 4. Rides AI Agent

#### Persona

Straightforward dispatcher for nearby drivers/passengers and scheduled trips.

#### Primary Tasks

1. **Collect Details**: Pickup, dropoff, time, pax count
2. **Show Estimates**: 2–3 price windows with ETAs
3. **Confirm Booking**: Place request and monitor
4. **Live Updates**: Share driver arrival status

#### Tools

- `maps_geosearch` - Find drivers/passengers
- `search_supabase` - Route data, pricing
- `momo_charge` - Optional deposit
- `notify_staff` - Escalations
- `analytics_log` - Metrics

#### Guardrails

- **Coarse location only** - Never broadcast exact coordinates
- **Cancel policy** disclosure before booking
- **Share vehicle and driver initials only**

#### KPIs

- ETA accuracy
- Match rate
- Cancellation rate
- Response time

#### Configuration

```yaml
- slug: rides
  name: Rides AI Agent
  languages: [en, fr, rw, sw]
  autonomy: suggest
```

---

### 5. Jobs AI Agent

#### Persona

Professional job board assistant. Connects seekers with opportunities.

#### Primary Tasks

1. **Job Search**: Help users find suitable positions
2. **Job Posting**: Assist employers in creating listings
3. **Application**: Facilitate job applications
4. **Matching**: Connect candidates with employers

#### Tools

- `search_supabase` - Job listings, candidates
- `notify_staff` - Escalations
- `analytics_log` - Metrics

#### Guardrails

- **PII minimization** in applications
- **Job verification required** for postings
- **Fraud detection** on suspicious listings

#### KPIs

- Job fill rate
- Application submission rate
- Time to hire
- User satisfaction

#### Configuration

```yaml
- slug: jobs
  name: Jobs AI Agent
  languages: [en, fr, rw]
  autonomy: suggest
```

---

### 6. Waiter AI Agent

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

#### KPIs

- Order cycle time
- Payment success %
- Prep-to-serve SLA
- CSAT score

#### Configuration

```yaml
- slug: waiter
  name: Waiter AI Agent
  languages: [en, fr, rw]
  autonomy: suggest
```

---

### 7. Real Estate AI Agent

#### Persona

Polite leasing and sales coordinator for properties.

#### Primary Tasks

1. **Discovery**: Filters → shortlist with photos
2. **Schedule Viewing**: Book appointment slots
3. **Application**: Capture docs, generate PDF
4. **Deposit**: Payment and receipt

#### Tools

- `search_supabase` - Property listings
- `schedule_viewing` - Book viewings
- `generate_pdf` - Application forms
- `momo_charge` - Deposit payment
- `notify_staff` - Escalations
- `analytics_log` - Metrics

#### Guardrails

- **Don't share exact addresses** until viewing booked
- **Deposit refunds policy** disclosed pre-payment

#### KPIs

- Viewing scheduled rate
- Deposit conversion
- Time-to-lease

#### Configuration

```yaml
- slug: real_estate
  name: Real Estate AI Agent
  languages: [en, fr]
  autonomy: suggest
```

---

### 8. Buy & Sell AI Agent

#### Persona

WhatsApp-first "Buy & Sell Concierge" that helps users find products, services, and nearby businesses. Two modes:

- **User-facing**: Friendly shopper's assistant
- **Vendor-facing**: Professional sourcing/broker assistant

**Note**: This agent consolidates capabilities from the former `marketplace` agent (pharmacy, hardware, shop) and `business_broker` agent (business brokerage, legal intake).

#### Primary Tasks

1. **Concierge Search**: Understand free-text requests, extract product/service details, budget, quantity, urgency
2. **Business Discovery**: Search nearby businesses using tags/metadata and location
3. **Vendor Outreach**: With user consent, contact vendors via WhatsApp to check stock/availability
4. **Response Aggregation**: Collect vendor replies, filter to confirmed matches, present shortlist
5. **Product Commerce**: Find products, check availability, place orders across all retail categories
6. **Order Fulfillment**: Track delivery, handle substitutions, process payments

#### Tools

- `search_businesses_with_tags` - Search businesses by category, tags, metadata, and location
- `create_vendor_inquiries_and_message_vendors` - Message vendors on behalf of user (requires consent)
- `get_vendor_inquiry_updates` - Check and parse vendor replies
- `log_user_feedback_on_vendor` - Record feedback to update vendor quality scores
- `search_supabase` - Products, inventory, businesses
- `inventory_check` - Stock levels
- `order_create` - Place orders
- `order_status_update` - Track delivery
- `momo_charge` - Payment
- `ocr_extract` - Prescription verification
- `maps_geocode` - Location-based search
- `notify_staff` - Escalations
- `analytics_log` - Metrics

#### Guardrails

**Concierge guardrails:**
- **explicit_consent_required**: True - NEVER contact vendors without user permission
- **max_vendors_per_inquiry**: 5 - Don't spam vendors
- **vendor_message_limit**: 4 lines per message
- **reply_timeout_minutes**: 2 - How long to wait for vendor replies

**Commerce guardrails (from marketplace):**
- **medical_advice**: Forbidden
- **pharmacist_review_required**: True for Rx items
- **age_restricted**: Handoff for restricted products
- **delivery_fee_threshold_kg**: 20kg for heavy items
- **substitution_policy**: "brand→generic→none"

**Business brokerage guardrails (from business_broker):**
- **advice**: Forbidden (no legal, tax, or financial advice)
- **sensitive_topics_handoff**: True
- **pii_minimization**: True

#### KPIs

- Vendor response rate
- Vendor accuracy (did they actually have the item?)
- User-vendor connection rate
- Order completion rate
- Delivery success rate
- Time to first confirmed vendor

#### Configuration

```yaml
- slug: buy_and_sell
  name: Buy & Sell AI Agent
  languages: [en, fr, rw]
  autonomy: suggest
```

#### Example Flows

**Laptop Search with Vendor Outreach:**
```
User: "I need a laptop for school under 400k near Remera"
Agent: Extracts: laptop, budget 400k, location Remera
Agent: Searches electronics shops with tags ["laptop"]
Agent: "I found 6 nearby electronics shops. I can message 4 of them to ask if they have a school laptop under 400k. Do you want me to contact them?"
User: "Yes, contact them"
Agent: Messages vendors, waits for replies
Agent: "Here are 2 shops that confirmed they have laptops under 400k:
        1. TechHub - 0.8km - 380,000 RWF (HP Pavilion)
        2. Kigali Electronics - 1.2km - 350,000 RWF (Lenovo IdeaPad)
        [Chat TechHub] [Chat Kigali Electronics]"
```

**Pharmacy Search:**
```
User: "I need paracetamol 500mg, 2 strips near Kacyiru"
Agent: Extracts: paracetamol 500mg, quantity 2 strips, location Kacyiru
Agent: Searches pharmacies with tags ["paracetamol"]
Agent: Asks for permission to contact pharmacies
User: Confirms
Agent: Messages pharmacies, collects replies
Agent: "CityCare Pharmacy (400m) has it: 1,500 RWF/strip
        [Chat CityCare]
        
        ⚠️ Follow your doctor's prescription and pharmacist's guidance."
```

---

### 9. Support AI Agent

#### Persona

Customer support and front-door triage concierge. Helpful, efficient routing and problem-solving.

**Note**: This agent consolidates capabilities from the former `concierge-router` and `support-handoff` agents.

#### Primary Tasks

1. **Intent Detection**: Route to appropriate specialist agent
2. **FAQ Handling**: Answer common questions
3. **Troubleshooting**: Help with account and service issues
4. **Escalation**: Summarize context for human handoff

#### Tools

- `search_supabase` - Help articles, user data
- `notify_staff` - Escalate to humans
- `analytics_log` - Metrics

#### Guardrails

- **allow_payments**: False
- **max_clarifying_questions**: 2
- **route_when_confidence_gte**: 0.6
- **summarize_last_messages**: 10

#### KPIs

- Routing accuracy
- First response time
- Resolution rate
- Escalation rate

#### Configuration

```yaml
- slug: support
  name: Support AI Agent
  languages: [en, fr, rw, sw, ln]
  autonomy: auto
```

---

## Agent Slug Migration Reference

When migrating from the old agent system, use this mapping:

| Old Slug | New Slug | Notes |
|----------|----------|-------|
| `concierge-router` | `support` | Merged into Support |
| `waiter-ai` | `waiter` | Renamed |
| `mobility-orchestrator` | `rides` | Renamed |
| `pharmacy-agent` | `buy_and_sell` | Merged into Buy & Sell |
| `hardware-agent` | `buy_and_sell` | Merged into Buy & Sell |
| `shop-agent` | `buy_and_sell` | Merged into Buy & Sell |
| `marketplace` | `buy_and_sell` | Merged into Buy & Sell |
| `business_broker` | `buy_and_sell` | Merged into Buy & Sell |
| `insurance-agent` | `insurance` | Renamed |
| `property-agent` | `real_estate` | Renamed |
| `legal-intake` | `buy_and_sell` | Merged into Buy & Sell |
| `payments-agent` | N/A | Internal utility (not agent) |
| `marketing-sales` | `sales_cold_caller` | Renamed |
| `sora-video` | N/A | Removed |
| `support-handoff` | `support` | Merged into Support |
| `locops` | N/A | Internal utility (not agent) |
| `analytics-risk` | N/A | Internal utility (not agent) |

---

## KPIs by Agent

| Agent | Key Metrics |
|-------|-------------|
| Farmer | Listing completion, match success, transaction rate |
| Insurance | Time-to-quote, quote→policy conversion, OCR error rate |
| Sales Cold Caller | Lead qualification, CTR, opt-out rate |
| Rides | ETA accuracy, match rate, cancellations |
| Jobs | Job fill rate, application rate, time to hire |
| Waiter | Order cycle time, payment success %, CSAT |
| Real Estate | Viewing rate, deposit conversion, time-to-lease |
| Buy & Sell | Order completion, delivery success, business match rate, fill rate |
| Support | Routing accuracy, first response time, resolution rate |

---

## Related Documentation

- [Tool Catalog](./TOOL_CATALOG.md)
- [Agent Configurations](../../config/agent_configs.yaml)
- [Ground Rules](../GROUND_RULES.md)
