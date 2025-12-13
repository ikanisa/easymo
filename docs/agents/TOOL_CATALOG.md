# EasyMO Platform - Tool Catalog

**Version**: 1.0  
**Last Updated**: 2025-11-12  
**Status**: Reference Implementation

---

## Overview

This document defines the complete tool catalog for EasyMO AI agents. All tools follow a
standardized contract with consistent return types, error handling, and attribution.

### Tool Contract

All tools **MUST** return:

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

**Security Requirements**:

- Errors are user-safe by default
- Sensitive details go to logs only
- Every tool call includes `trace_id` and `{org_id, user_id, convo_id}` for RLS-safe attribution

---

## Tool Categories

### A. Messaging & Orchestration

#### notify_staff(channel, payload)

**Purpose**: Notifies Admin Inbox and optionally Slack/SMS

**Parameters**:

```typescript
{
  channel: 'inbox' | 'slack' | 'sms';
  payload: {
    convo_id: string;
    reason: string;
    summary: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    trace_id: string;
    org_id: string;
    user_id: string;
  }
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    ticket_id: string;
    estimated_response_time?: string;
  }
}
```

**Implementation**: Edge function `admin-messages` or notification-worker

---

#### search_supabase(table, filters, limit, order)

**Purpose**: RLS-scoped reads for inventory, menus, quotes, etc.

**Parameters**:

```typescript
{
  table: string;
  filters: Record<string, any>;
  limit?: number;
  order?: {
    column: string;
    ascending: boolean;
  };
  trace_id: string;
  org_id: string;
  user_id: string;
  convo_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    items: Array<Record<string, any>>;
    count: number;
  }
}
```

**Security**: All queries are RLS-scoped to org_id/user_id

---

### B. Commerce & Operations

#### inventory_check(sku[] | name[])

**Purpose**: Check product availability, pricing, and stock levels

**Parameters**:

```typescript
{
  items: Array<{sku?: string; name?: string}>;
  venue_id?: string;
  org_id: string;
  trace_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    items: Array<{
      sku: string;
      name: string;
      price: number;
      qty: number;
      unit: string;
      available: boolean;
    }>;
  }
}
```

**Fallback**: Returns partial results if some items not found

---

#### order_create({items, venue_id, table_no?, notes?})

**Purpose**: Create a new order (dining, pharmacy, hardware, shop)

**Parameters**:

```typescript
{
  items: Array<{
    sku: string;
    name: string;
    qty: number;
    price: number;
  }>;
  venue_id: string;
  table_no?: string;
  notes?: string;
  customer_id: string;
  org_id: string;
  trace_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    order_id: string;
    total: number;
    currency: string;
    estimated_time?: string;
  }
}
```

**Side Effects**: Creates order record, notifies fulfillment team

---

#### order_status_update(order_id, status)

**Purpose**: Update order status and send WhatsApp notifications

**Parameters**:

```typescript
{
  order_id: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  notes?: string;
  trace_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    order_id: string;
    status: string;
    updated_at: string;
  }
}
```

**Side Effects**: Sends WhatsApp template message to customer

---

#### reservation_book({venue_id, when, size, name, phone})

**Purpose**: Book dining reservation or viewing appointment

**Parameters**:

```typescript
{
  venue_id: string;
  when: string; // ISO 8601
  size: number;
  name: string;
  phone: string;
  org_id: string;
  trace_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    reservation_id: string;
    confirmation_code: string;
  }
}
```

---

### C. Maps & Mobility

#### maps_geosearch({lat, lng, radius, kind})

**Purpose**: Find drivers, venues, or services near a location

**Parameters**:

```typescript
{
  lat: number;
  lng: number;
  radius: number; // meters
  kind: 'driver' | 'venue' | 'pharmacy' | 'shop' | 'property';
  filters?: Record<string, any>;
  limit?: number;
  trace_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    results: Array<{
      id: string;
      name: string;
      distance: number; // meters
      lat: number; // coarse precision only
      lng: number; // coarse precision only
      metadata?: Record<string, any>;
    }>;
  }
}
```

**Privacy**: Returns coarse location only (3 decimal places max)

---

#### trip_price_estimate({origin, dest, when, pax})

**Purpose**: Estimate trip pricing for mobility services

**Parameters**:

```typescript
{
  origin: {lat: number; lng: number; name?: string};
  dest: {lat: number; lng: number; name?: string};
  when: string; // ISO 8601
  pax: number;
  vehicle_type?: string;
  trace_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    estimate: number;
    currency: string;
    window: {
      min: number;
      max: number;
    }
    eta_minutes: number;
  }
}
```

---

### D. Insurance

#### ocr_extract(file_url)

**Purpose**: Extract text fields from insurance documents

**Parameters**:

```typescript
{
  file_url: string;
  document_type: "vehicle_registration" | "id_card" | "license" | "policy";
  trace_id: string;
  org_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    fields: Record<string, string>;
    confidence: number; // 0-1
    extracted_at: string;
  }
}
```

**Security**: Raw media redacted post-extraction per policy

**Implementation**: Edge function `ocr-processor`

---

#### price_insurance(payload)

**Purpose**: Calculate insurance premium with breakdown

**Parameters**:

```typescript
{
  type: 'motor' | 'travel' | 'health';
  category: string;
  coverage_period_days: number;
  vehicle?: {make: string; model: string; year: number};
  driver?: {age: number; experience_years: number};
  destination?: string;
  trace_id: string;
  org_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    premium: number;
    currency: string;
    breakdown: {
      base: number;
      tax: number;
      fees: number;
    }
    insurer: string;
    validity: string; // ISO 8601
  }
}
```

**Note**: Uses versioned tariffs per insurer

---

#### generate_pdf(template_id, data)

**Purpose**: Generate PDFs (certificates, receipts, contracts)

**Parameters**:

```typescript
{
  template_id: string;
  data: Record<string, any>;
  locale?: string;
  trace_id: string;
  org_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    pdf_url: string;
    expires_at: string;
  }
}
```

**Storage**: PDFs stored in Supabase Storage with 30-day expiry

---

### E. Payments

#### momo_charge({amount, currency, phone, memo})

**Purpose**: Create mobile money payment charge

**Parameters**:

```typescript
{
  amount: number;
  currency: string;
  phone: string;
  memo: string;
  metadata?: Record<string, any>;
  idempotency_key: string; // Required for financial ops
  trace_id: string;
  org_id: string;
  user_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    payment_link: string;
    momo_ref: string;
    expires_at: string;
  }
}
```

**Security**:

- Settlement confirmed via webhook before fulfillment
- Never collect card PANs
- Server-side only

**Implementation**: USSD `tel:` mobile money (no MoMo API)

---

### F. Property & Legal

#### property_search(filters)

**Purpose**: Search rental properties

**Parameters**:

```typescript
{
  filters: {
    price_min?: number;
    price_max?: number;
    bedrooms?: number;
    area?: string;
    pets_allowed?: boolean;
    parking?: boolean;
  };
  limit?: number;
  trace_id: string;
  org_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    listings: Array<{
      id: string;
      title: string;
      price: number;
      bedrooms: number;
      area: string;
      photos: string[];
      available_from: string;
    }>;
  }
}
```

**Privacy**: Exact addresses shared only after viewing booked

---

#### schedule_viewing({listing_id, when, name, phone})

**Purpose**: Schedule property viewing appointment

**Parameters**:

```typescript
{
  listing_id: string;
  when: string; // ISO 8601
  name: string;
  phone: string;
  notes?: string;
  trace_id: string;
  org_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    event_id: string;
    address: string; // Full address now revealed
    contact: string;
  }
}
```

---

#### case_intake({category, summary, docs[]})

**Purpose**: Create legal case intake record

**Parameters**:

```typescript
{
  category: string;
  summary: string;
  docs: string[]; // URLs
  client_name: string;
  client_phone: string;
  trace_id: string;
  org_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    case_id: string;
    reference_number: string;
  }
}
```

**Security**: No legal advice provided; intake only

---

### G. Marketing & Analytics

#### broadcast_schedule({template_id, audience, when})

**Purpose**: Schedule WhatsApp broadcast campaign

**Parameters**:

```typescript
{
  template_id: string; // Pre-approved WhatsApp template
  audience: {
    segment?: string;
    filters?: Record<string, any>;
  };
  when: string; // ISO 8601
  variables?: Record<string, string>;
  trace_id: string;
  org_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    campaign_id: string;
    estimated_reach: number;
    scheduled_at: string;
  }
}
```

**Guardrails**:

- Only pre-approved templates allowed
- Quiet hours throttle enforced
- Opt-in proof required

---

#### analytics_log(event, props)

**Purpose**: Log events for funnel analytics and KPIs

**Parameters**:

```typescript
{
  event: string;
  props: Record<string, any>;
  trace_id: string;
  org_id: string;
  user_id?: string;
  convo_id?: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    logged_at: string;
  }
}
```

**Privacy**: PII minimized; no sensitive data logged

**Implementation**: Uses observability.ts helpers

---

### H. Buy & Sell Concierge

#### search_businesses_with_tags(query, tags, category, location, radius, limit)

**Purpose**: Search businesses using category, tags, metadata, and user location for semantic
matching

**Parameters**:

```typescript
{
  query_text?: string;       // Natural language query
  tags?: string[];           // Tags to match (e.g., ["laptop", "hp", "used"])
  category?: string;         // Business category
  user_lat?: number;         // User latitude
  user_lng?: number;         // User longitude
  radius_km?: number;        // Search radius (default: 10)
  limit?: number;            // Max results (default: 10)
  trace_id: string;
  org_id: string;
  user_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: Array<{
    id: string;
    name: string;
    category: string;
    address?: string;
    phone?: string;
    owner_whatsapp?: string;
    tags?: string[];
    metadata?: Record<string, any>;
    distance_km?: number;
    relevance_score?: number;
    response_rate?: number; // Vendor quality metric
    response_time_avg_sec?: number; // Avg response time
  }>;
}
```

**Ranking**: Results ranked by relevance (tag overlap + category match) and vendor quality (response
rate)

---

#### create_vendor_inquiries_and_message_vendors(user_id, business_ids, request, consent)

**Purpose**: Create inquiry record and message vendors on user's behalf. REQUIRES explicit user
consent.

**Parameters**:

```typescript
{
  user_id?: string;
  user_phone: string;
  business_ids: string[];
  request_type: 'product' | 'service' | 'medicine';
  request_summary: string;
  structured_payload: {
    item?: string;
    quantity?: number;
    budget?: number;
    timeframe?: string;      // 'now' | 'today' | 'any'
    pickup_area?: string;
    brand?: string;
    constraints?: string[];
  };
  user_lat?: number;
  user_lng?: number;
  language?: string;         // 'en' | 'rw' | 'fr'
  trace_id: string;
  org_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    inquiry_id: string;
    vendor_ids: string[];
    messages_sent: number;
    expires_at: string;      // ISO 8601, usually 2 minutes
  }
}
```

**Side Effects**:

- Creates `market_vendor_inquiries` record
- Sends WhatsApp messages to each vendor
- Creates `market_vendor_inquiry_messages` records

**Guardrails**:

- MAX 5 vendors per inquiry
- User consent is REQUIRED before calling
- Messages are short and professional

---

#### get_vendor_inquiry_updates(inquiry_id)

**Purpose**: Check vendor replies and parse responses (YES/NO with price/quantity)

**Parameters**:

```typescript
{
  inquiry_id: string;
  trace_id: string;
  org_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    inquiry_id: string;
    status: "pending" | "partial" | "complete" | "expired";
    vendor_count: number;
    replied_count: number;
    confirmed_count: number;
    replies: Array<{
      business_id: string;
      business_name: string;
      business_phone: string;
      status: "yes" | "no" | "other" | "pending";
      price?: number;
      quantity?: number;
      notes?: string;
      distance_km?: number;
      response_time_sec?: number;
    }>;
  }
}
```

**Parsing**: Understands responses like:

- "YES 1500 2" → yes, price=1500, quantity=2
- "YEE 1500" → yes, price=1500 (Kinyarwanda)
- "NO" or "OYA" → no

---

#### process_vendor_reply(vendor_phone, message_body, whatsapp_message_id)

**Purpose**: Process an inbound WhatsApp message from a vendor (called by webhook)

**Parameters**:

```typescript
{
  vendor_phone: string;
  message_body: string;
  whatsapp_message_id?: string;
  trace_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    inquiry_id: string;
    parsed: boolean; // Whether response was understood
  }
}
```

**Side Effects**: Updates vendor metrics (response time, rate)

---

#### log_user_feedback_on_vendor(business_id, feedback_type, rating)

**Purpose**: Log user feedback after visiting a vendor to update quality scores

**Parameters**:

```typescript
{
  inquiry_id?: string;
  message_id?: string;
  business_id: string;
  user_phone: string;
  feedback_type: 'accurate' | 'inaccurate' | 'cancelled' | 'complaint';
  rating?: number;           // 1-5
  comment?: string;
  trace_id: string;
  org_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
}
```

**Side Effects**: Updates business metrics (`confirmation_accuracy`, `response_rate`)

---

### I. Sora-2 Video

#### sora_generate_video({prompt, params})

**Purpose**: Generate video ads using Sora-2 API

**Parameters**:

```typescript
{
  prompt: {
    scene: string;
    cinematography: {
      camera_shot: string;
      lighting_palette: string;
    };
    actions: Array<{time: string; description: string}>;
    dialogue?: string;
  };
  params: {
    model: 'sora-2' | 'sora-2-pro';
    size: '1280x720' | '720x1280' | '1024x1792' | '1792x1024';
    seconds: 4 | 8 | 12;
  };
  brand_kit_id: string;
  reference_images?: string[];
  trace_id: string;
  org_id: string;
}
```

**Returns**:

```typescript
{
  ok: true;
  data: {
    job_id: string;
    status: 'queued' | 'processing' | 'complete' | 'failed';
    preview_url?: string;
    estimated_completion?: string;
  }
}
```

**Critical Rules**:

1. Clip length and resolution are API parameters ONLY (not in prompt)
2. Size availability depends on model:
   - sora-2: 1280x720, 720x1280
   - sora-2-pro: adds 1024x1792, 1792x1024
3. Prompt governs content, motion, lighting, style
4. Use image references for tighter control
5. Use Remix for small deltas

**Guardrails**:

- Brand kit must exist
- Consent registry required
- Country pack palette enforced

---

## Tool Implementation Status

| Tool                                | Implementation | Edge Function         | Status   |
| ----------------------------------- | -------------- | --------------------- | -------- |
| notify_staff                        | ✅             | admin-messages        | Complete |
| search_supabase                     | ✅             | Multiple              | Complete |
| inventory_check                     | ⚠️             | Via search_supabase   | Partial  |
| order_create                        | ⚠️             | Multiple              | Partial  |
| order_status_update                 | ⚠️             | Multiple              | Partial  |
| reservation_book                    | ❌             | TBD                   | Planned  |
| maps_geosearch                      | ✅             | agent-negotiation     | Complete |
| trip_price_estimate                 | ⚠️             | agent-negotiation     | Partial  |
| ocr_extract                         | ✅             | ocr-processor         | Complete |
| price_insurance                     | ❌             | TBD                   | Planned  |
| generate_pdf                        | ❌             | TBD                   | Planned  |
| property_search                     | ✅             | agent-property-rental | Complete |
| schedule_viewing                    | ⚠️             | agent-property-rental | Partial  |
| case_intake                         | ❌             | TBD                   | Planned  |
| broadcast_schedule                  | ❌             | TBD                   | Planned  |
| analytics_log                       | ✅             | observability         | Complete |
| sora_generate_video                 | ❌             | TBD                   | Planned  |
| search_businesses_with_tags         | ✅             | wa-webhook-buy-sell   | Complete |
| create_vendor_inquiries_and_message | ✅             | wa-webhook-buy-sell   | Complete |
| get_vendor_inquiry_updates          | ✅             | wa-webhook-buy-sell   | Complete |
| process_vendor_reply                | ✅             | wa-webhook-buy-sell   | Complete |
| log_user_feedback_on_vendor         | ✅             | wa-webhook-buy-sell   | Complete |

**Legend**:

- ✅ Complete - Fully implemented and tested
- ⚠️ Partial - Basic implementation exists, needs enhancement
- ❌ Planned - Not yet implemented

---

## Tool Access by Agent

| Agent                 | Tools Allowed                                                                                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Concierge Router      | search_supabase, notify_staff, analytics_log                                                                                                                                                                    |
| Waiter AI             | search_supabase, order_create, order_status_update, momo_charge, notify_staff, analytics_log                                                                                                                    |
| Mobility Orchestrator | maps_geosearch, search_supabase, momo_charge, notify_staff, analytics_log                                                                                                                                       |
| Buy & Sell            | search_businesses_with_tags, create_vendor_inquiries_and_message, get_vendor_inquiry_updates, log_user_feedback_on_vendor, inventory_check, order_create, momo_charge, ocr_extract, notify_staff, analytics_log |
| Pharmacy              | search_supabase, inventory_check, order_create, order_status_update, momo_charge, ocr_extract, notify_staff, analytics_log                                                                                      |
| Hardware              | search_supabase, inventory_check, order_create, order_status_update, momo_charge, notify_staff, analytics_log                                                                                                   |
| Shop                  | search_supabase, inventory_check, order_create, order_status_update, momo_charge, notify_staff, analytics_log                                                                                                   |
| Insurance             | ocr_extract, price_insurance, generate_pdf, momo_charge, notify_staff, analytics_log                                                                                                                            |
| Property              | search_supabase, schedule_viewing, generate_pdf, momo_charge, notify_staff, analytics_log                                                                                                                       |
| Legal Intake          | search_supabase, generate_pdf, momo_charge, notify_staff, analytics_log                                                                                                                                         |
| Payments              | momo_charge, notify_staff, analytics_log                                                                                                                                                                        |
| Marketing & Sales     | search_supabase, broadcast_schedule, analytics_log, notify_staff                                                                                                                                                |
| Sora-2 Video          | sora_generate_video, search_supabase, analytics_log                                                                                                                                                             |
| Support & Handoff     | notify_staff, analytics_log                                                                                                                                                                                     |
| Locops                | search_supabase, analytics_log                                                                                                                                                                                  |
| Analytics & Risk      | analytics_log, notify_staff                                                                                                                                                                                     |

---

## Error Codes

Standard error codes across all tools:

| Code                | Description                         | User Message                      |
| ------------------- | ----------------------------------- | --------------------------------- |
| AUTH_ERROR          | Authentication/authorization failed | "Access denied"                   |
| NOT_FOUND           | Resource not found                  | "Item not found"                  |
| VALIDATION_ERROR    | Invalid input parameters            | "Invalid request"                 |
| RATE_LIMIT          | Too many requests                   | "Please try again later"          |
| SERVICE_UNAVAILABLE | External service down               | "Service temporarily unavailable" |
| PAYMENT_FAILED      | Payment processing failed           | "Payment unsuccessful"            |
| INSUFFICIENT_FUNDS  | Not enough balance                  | "Insufficient funds"              |
| EXPIRED             | Resource expired                    | "Link expired"                    |
| CONFLICT            | Resource conflict                   | "Already exists"                  |
| INTERNAL_ERROR      | Unexpected error                    | "Something went wrong"            |

---

## Testing Tools

Each tool should have:

1. **Unit tests**: Test logic in isolation
2. **Integration tests**: Test with real dependencies
3. **Failure tests**: Test error handling
4. **Load tests**: Test under high volume

Example test structure:

```typescript
describe("momo_charge", () => {
  it("should create payment link", async () => {
    const result = await momo_charge({
      amount: 1000,
      currency: "RWF",
      phone: "+250788123456",
      memo: "Test payment",
      idempotency_key: "test-123",
      trace_id: "trace-123",
      org_id: "org-123",
      user_id: "user-123",
    });

    expect(result.ok).toBe(true);
    expect(result.data.payment_link).toBeDefined();
    expect(result.data.momo_ref).toBeDefined();
  });

  it("should handle idempotency", async () => {
    const key = "duplicate-123";
    const result1 = await momo_charge({ ...params, idempotency_key: key });
    const result2 = await momo_charge({ ...params, idempotency_key: key });

    expect(result1.data.momo_ref).toBe(result2.data.momo_ref);
  });

  it("should reject invalid phone", async () => {
    const result = await momo_charge({
      ...params,
      phone: "invalid",
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });
});
```

---

## Related Documentation

- [Agent Configurations](../../config/agent_configs.yaml)
- [Ground Rules](../GROUND_RULES.md)
- [Agent Catalog](../AGENT_CATALOG_COMPLETE.md)
- [Observability Guide](../MONITORING_SETUP.md)
