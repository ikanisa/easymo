# EasyMO Platform - Global Conventions & Specifications

**Version**: 1.0  
**Last Updated**: 2025-11-12  
**Status**: Reference Implementation

---

## Table of Contents

1. [Global Conventions](#global-conventions)
2. [Tool Naming & Contract](#tool-naming--contract)
3. [Autonomy Levels](#autonomy-levels)
4. [Localization & Market Scope](#localization--market-scope)
5. [PII, Consent, and Payments](#pii-consent-and-payments)
6. [Guardrails Reference](#guardrails-reference)
7. [Compliance Checklist](#compliance-checklist)

---

## Global Conventions

### Surfaces & Routing

#### Entry Point Architecture

```
WhatsApp Business Cloud API
  ↓
Supabase Edge Function (wa-webhook)
  ↓
Orchestrator (intent detection)
  ↓
Agent by Intent (specialized handler)
```

#### Message Persistence

**REQUIRED**: Persist every message to ensure observability and audit trail.

```typescript
// Every user/agent/staff message
await supabase.from("messages").insert({
  convo_id: conversationId,
  role: "user" | "agent" | "staff",
  content: message,
  trace_id: traceId,
  timestamp: new Date().toISOString(),
});
```

#### Decision Tracking

**REQUIRED**: Bind all agent decisions to `agent_runs` for observability.

```typescript
await supabase.from("agent_runs").insert({
  agent_slug: "waiter-ai",
  convo_id: conversationId,
  trace_id: traceId,
  input: originalMessage,
  output: agentResponse,
  tools_called: ["order_create", "momo_charge"],
  duration_ms: executionTime,
  status: "success" | "error",
  org_id: organizationId,
  user_id: userId,
});
```

### Admin Panel

**Style**: Atlas-style panel with clear information hierarchy

**Sections**:

- Inbox (conversations, tickets)
- Payments (transactions, reconciliation)
- Insurance (quotes, policies)
- Dining (orders, menus)
- Property (listings, viewings)
- Legal (cases, documents)
- Marketing (campaigns, templates)
- Videos (Sora jobs, media assets)

**Requirements**:

- Role-based access control (RBAC)
- Audit trails on every high-impact action
- Real-time updates via Supabase Realtime
- Responsive design (mobile-first)

```typescript
// High-impact action audit trail
await supabase.from("audit_log").insert({
  action: "APPROVED_INSURANCE_POLICY",
  actor_id: staffId,
  resource_type: "insurance_policy",
  resource_id: policyId,
  before_state: previousState,
  after_state: newState,
  reason: approvalReason,
  timestamp: new Date().toISOString(),
});
```

---

## Tool Naming & Contract

### Standard Return Type

**MANDATORY**: All tools must return this exact structure.

```typescript
type ToolResult<T = any> = {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    msg: string;
  };
};
```

### Error Handling Philosophy

**User-Safe Errors**: Error messages shown to users should be safe and non-technical.

```typescript
// ✅ CORRECT - User-safe error
return {
  ok: false,
  error: {
    code: "PAYMENT_FAILED",
    msg: "Payment unsuccessful. Please try again.",
  },
};

// ❌ WRONG - Technical error exposed
return {
  ok: false,
  error: {
    code: "DB_ERROR",
    msg: "Postgres connection timeout at line 42",
  },
};
```

**Logging Sensitive Details**: Technical details go to logs only.

```typescript
// Log full technical context
await logStructuredEvent("PAYMENT_FAILED", {
  error: err.message,
  stack: err.stack,
  txId: transactionId,
  provider: "momo",
  endpoint: "/api/charge",
  trace_id: traceId,
});

// Return user-safe message
return {
  ok: false,
  error: {
    code: "PAYMENT_FAILED",
    msg: "Payment unsuccessful. Please try again.",
  },
};
```

### Attribution Context

**REQUIRED**: Every tool call must include attribution for RLS.

```typescript
type AttributionContext = {
  trace_id: string; // For distributed tracing
  org_id: string; // For multi-tenancy
  user_id: string; // For user actions
  convo_id?: string; // Optional conversation context
};

// Tool call example
const result = await inventory_check({
  items: [{ sku: "MED-001" }],
  venue_id: venueId,
  trace_id: crypto.randomUUID(),
  org_id: organizationId,
  user_id: userId,
  convo_id: conversationId,
});
```

---

## Autonomy Levels

### Level Definitions

| Level       | Description                                      | Approval Required   | Use Cases                                               |
| ----------- | ------------------------------------------------ | ------------------- | ------------------------------------------------------- |
| **auto**    | Full automation under guardrails                 | No                  | Menu lookups, status updates, simple queries            |
| **suggest** | Auto execution under caps, review for high-value | Yes, if > threshold | Orders under $200, quotes under $500                    |
| **handoff** | Human approval always required                   | Yes, always         | Legal advice, high-value transactions, sensitive topics |

### Configuration

Caps configured per agent in `agent_configs.guardrails`:

```yaml
guardrails:
  payment_limits:
    currency: RWF
    max_per_txn: 200000 # Auto-approve below this
  approval_thresholds:
    premium_gt: 500000 # Require approval above this
  autonomy_overrides:
    - condition: "medical_advice_requested"
      level: handoff
```

### Implementation

```typescript
async function processAction(agent: Agent, action: Action, amount?: number): Promise<ToolResult> {
  // Check autonomy level
  if (agent.autonomy === "handoff") {
    return await requestStaffApproval(action);
  }

  if (agent.autonomy === "suggest" && amount) {
    const limit = agent.guardrails.payment_limits?.max_per_txn;
    if (limit && amount > limit) {
      return await requestStaffApproval(action);
    }
  }

  // Auto execution
  return await executeAction(action);
}
```

---

## Localization & Market Scope

### Supported Languages

**Rwanda Market Only**:

- en (English) - Default UI
- fr (French) - UI and comprehension
- rw (Kinyarwanda) - Comprehension support

```yaml
languages: [en, fr, rw]
```

**Implementation**:

```typescript
// Detect user language from message
const detectedLanguage = await detectLanguage(message);

// Set conversation locale
await supabase
  .from("conversations")
  .update({
    locale: detectedLanguage,
    country_pack_id: countryPackId,
  })
  .eq("id", conversationId);
```

### Market Countries

**Scope**: Rwanda only (RW)

**Explicit Exclusions**: All countries except Rwanda (including UG, KE, NG, ZA, MT)

```sql
-- Enforce at org onboarding
CREATE POLICY "org_must_have_allowed_country" ON organizations
  FOR INSERT
  WITH CHECK (
    country_code NOT IN ('UG', 'KE', 'NG', 'ZA')
    AND country_code IN (SELECT code FROM market_countries WHERE enabled = true)
  );
```

```typescript
// Runtime check
const allowedCountries = await supabase.from("market_countries").select("code").eq("enabled", true);

if (!allowedCountries.data?.some((c) => c.code === orgCountry)) {
  throw new Error("Organization country not in allowed markets");
}
```

### WhatsApp Templates

**Structure**: Templates are keyed by country + locale.

```typescript
type WhatsAppTemplate = {
  id: string;
  name: string;
  country_code: string; // ISO 3166-1 alpha-2
  locale: string; // en, fr, rw, sw, ln
  category: string; // UTILITY, MARKETING, AUTHENTICATION
  status: "APPROVED" | "PENDING" | "REJECTED";
  components: Array<{
    type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
    text?: string;
    variables?: string[];
  }>;
};

// Select template by country and locale
async function getTemplate(
  name: string,
  countryCode: string,
  locale: string
): Promise<WhatsAppTemplate | null> {
  const { data } = await supabase
    .from("whatsapp_templates")
    .select("*")
    .eq("name", name)
    .eq("country_code", countryCode)
    .eq("locale", locale)
    .eq("status", "APPROVED")
    .single();

  return data;
}
```

### Broadcast Throttling

**Quiet Hours**: No broadcasts during sleep hours (country-specific).

```typescript
type QuietHours = {
  country_code: string;
  start_time: string; // HH:mm format (e.g., "22:00")
  end_time: string; // HH:mm format (e.g., "08:00")
  timezone: string; // IANA timezone (e.g., "Africa/Kigali")
};

// Check if current time is in quiet hours
function isQuietHours(countryCode: string): boolean {
  const now = new Date();
  const quietHours = getQuietHours(countryCode);
  const localTime = new Date(
    now.toLocaleString("en-US", {
      timeZone: quietHours.timezone,
    })
  );

  const hour = localTime.getHours();
  const start = parseInt(quietHours.start_time.split(":")[0]);
  const end = parseInt(quietHours.end_time.split(":")[0]);

  if (start < end) {
    return hour >= start && hour < end;
  } else {
    // Overnight quiet hours (e.g., 22:00 to 08:00)
    return hour >= start || hour < end;
  }
}
```

**Opt-in Proofs**: Store consent before marketing messages.

```sql
CREATE TABLE consent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL,  -- 'whatsapp', 'sms', 'email'
  opted_in BOOLEAN NOT NULL,
  opted_in_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  proof_method TEXT,      -- 'explicit_button', 'double_optin', 'transaction'
  proof_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## PII, Consent, and Payments

### Row-Level Security (RLS)

**MANDATORY**: Enable RLS on all tables containing user data.

```sql
-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own conversations
CREATE POLICY "users_own_conversations" ON conversations
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Staff can see conversations in their org
CREATE POLICY "staff_org_conversations" ON conversations
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM staff_members
      WHERE user_id = auth.uid()
    )
  );
```

### PII Minimization

**Principle**: Collect only what's necessary, mask in logs, purge after retention period.

```typescript
// Mask PII in logs
function maskPhone(phone: string): string {
  return phone.replace(/(\+\d{3})\d+(\d{4})/, "$1****$2");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

// Log with masked PII
log.info(
  {
    event: "USER_LOOKUP",
    phone: maskPhone(user.phone),
    email: maskEmail(user.email),
    trace_id: traceId,
  },
  "User found"
);
```

**Data Retention**: Implement automatic purging.

```sql
-- Purge old messages after 90 days
DELETE FROM messages
WHERE created_at < NOW() - INTERVAL '90 days'
  AND archived = true;
```

### Consent Registries

**Required for**: Media featuring figures/artists, marketing communications.

```typescript
type ConsentRecord = {
  subject_type: "person" | "artist" | "brand";
  subject_id: string;
  subject_name: string;
  consent_type: "likeness" | "voice" | "trademark" | "marketing";
  granted: boolean;
  granted_at?: string;
  expires_at?: string;
  proof_document_url?: string;
  scope: string[]; // ['commercial', 'social_media', 'print']
};

// Check consent before Sora job
async function checkConsent(personId: string, useCase: string): Promise<boolean> {
  const { data } = await supabase
    .from("consent_registry")
    .select("*")
    .eq("subject_id", personId)
    .eq("granted", true)
    .contains("scope", [useCase])
    .gt("expires_at", new Date().toISOString())
    .single();

  return !!data;
}
```

### Payments

**Rules**:

1. **Server-side only** - Never expose payment credentials client-side
2. **MoMo only** - No card PANs collected or stored
3. **Webhook settlement** - Confirm payment before fulfillment
4. **Idempotency** - All financial operations must be idempotent

```typescript
// Idempotent payment
async function createPayment(params: PaymentParams): Promise<ToolResult> {
  const idempotencyKey = params.idempotency_key;

  // Check if already processed
  const existing = await redis.get(`payment:${idempotencyKey}`);
  if (existing) {
    return JSON.parse(existing);
  }

  // Process payment
  const result = await momoCharge(params);

  // Cache result (24 hours)
  await redis.setex(`payment:${idempotencyKey}`, 86400, JSON.stringify(result));

  return result;
}

// Wait for webhook before fulfillment
async function handleWebhook(event: WebhookEvent): Promise<void> {
  if (event.status === "SUCCESSFUL") {
    const order = await getOrder(event.metadata.order_id);

    // Update order status
    await updateOrderStatus(order.id, "confirmed");

    // Trigger fulfillment
    await notifyFulfillment(order);

    // Log settlement
    await logStructuredEvent("PAYMENT_SETTLED", {
      order_id: order.id,
      amount: event.amount,
      momo_ref: event.reference,
      trace_id: order.trace_id,
    });
  }
}
```

---

## Guardrails Reference

### Payment Guardrails

```yaml
payment_limits:
  currency: RWF
  max_per_txn: 200000 # Auto-approve below
  daily_limit: 1000000 # Per user per day
  require_2fa_above: 500000
```

### OCR Guardrails

```yaml
ocr_settings:
  min_confidence: 0.8 # Request retake below
  max_retries: 3
  redact_after_extraction: true
  retention_days: 7
```

### Consent/IP Guardrails

```yaml
content_requirements:
  require_consent_registry: true
  watermark_generated_media: true
  log_asset_usage: true
```

### Localization Guardrails

```yaml
localization:
  excluded_countries: [UG, KE, NG, ZA]
  fallback_locale: en
  never_fail_on_missing_locale: true
  enforce_template_by_locale: true
```

### Sora Parameters

```yaml
sora_params:
  allowed_models: [sora-2, sora-2-pro]
  allowed_seconds: [4, 8, 12]
  allowed_sizes:
    sora-2: [1280x720, 720x1280]
    sora-2-pro: [1280x720, 720x1280, 1024x1792, 1792x1024]
  prompt_max_length: 2000
  require_brand_kit: true
```

**Critical Rule**: Clip length and resolution are set in API params, **not in prompt text**.

```typescript
// ✅ CORRECT
await sora_generate_video({
  prompt: {
    scene: "Product on countertop with soft lighting",
    cinematography: {
      camera_shot: "medium close-up, eye level",
      lighting_palette: "soft daylight, warm fill",
    },
    actions: [
      { time: "0-2s", description: "glint sweeps across logo" },
      { time: "2-4s", description: "tilt to hero angle" },
    ],
  },
  params: {
    model: "sora-2-pro",
    size: "1280x720",
    seconds: 4, // Explicit parameter
  },
});

// ❌ WRONG - Don't specify duration in prompt
await sora_generate_video({
  prompt: {
    scene: "Product on countertop, 4 second shot...", // Wrong!
  },
  params: {
    model: "sora-2-pro",
    size: "1280x720",
    // Missing seconds parameter
  },
});
```

---

## Compliance Checklist

### Before Production Deployment

- [ ] All tables have RLS enabled
- [ ] PII masking implemented in logs
- [ ] Webhook signature verification in place
- [ ] Rate limiting on public endpoints
- [ ] Idempotency for financial operations
- [ ] Audit trails for high-impact actions
- [ ] Data retention policies configured
- [ ] Consent registries populated
- [ ] Market country restrictions enforced
- [ ] Quiet hours configured per country
- [ ] WhatsApp templates approved
- [ ] Feature flags defaulting to OFF
- [ ] Health check endpoints exposed
- [ ] Monitoring and alerts configured
- [ ] Incident response runbook ready

### Per Agent Launch

- [ ] Agent configuration matches blueprint
- [ ] Tools properly restricted per guardrails
- [ ] Autonomy levels tested (auto/suggest/handoff)
- [ ] Localization tested (EN/FR minimum)
- [ ] Payment flow tested end-to-end
- [ ] Webhook settlement verified
- [ ] Error messages are user-safe
- [ ] Sensitive details logged not exposed
- [ ] Attribution context in all tool calls
- [ ] KPI metrics being collected
- [ ] Smoke tests passing
- [ ] Fallback behavior verified

---

## Related Documentation

- [Tool Catalog](./TOOL_CATALOG.md)
- [Agent Blueprints](./AGENT_BLUEPRINTS.md)
- [Agent Configurations](../../config/agent_configs.yaml)
- [Ground Rules](../GROUND_RULES.md)
- [Agent Catalog](../AGENT_CATALOG_COMPLETE.md)

---

**Document Status**: ✅ Complete  
**Last Review**: 2025-11-12  
**Next Review**: Quarterly or on major feature launch
