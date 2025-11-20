# Dual LLM Provider Implementation - Complete Guide

## Overview

This implementation adds **Gemini 3** as a second LLM engine alongside OpenAI, giving EasyMO:

1. **Redundancy/Failover** - Automatic fallback if OpenAI fails
2. **Specialization** - Use Gemini for Google-connected tasks (Maps, Search, OCR)
3. **Better Ingestion** - Gemini processes messy PDFs, images, forms
4. **Cross-checking** - Gemini validates critical responses

**CRITICAL**: All user-facing interactions remain grounded in EasyMO data. Gemini is a processing engine, NOT a general knowledge chatbot.

---

## Architecture

### Before
```
WhatsApp → Edge Function → OpenAI → Tools → Supabase
```

### After
```
WhatsApp → Orchestrator → LLM Router → {OpenAI OR Gemini} → Tools → Supabase
                                               ↓
                                    Tool-specific routing
```

---

## Files Created

### 1. Core Infrastructure (`supabase/functions/_shared/`)

| File | Purpose |
|------|---------|
| `llm-provider-interface.ts` | Vendor-agnostic LLM interface |
| `llm-provider-openai.ts` | OpenAI implementation |
| `llm-provider-gemini.ts` | Gemini implementation |
| `llm-router.ts` | Intelligent routing & failover |
| `gemini-tools.ts` | Gemini-backed tool implementations |

### 2. Database Migration

**File**: `supabase/migrations/20251120120000_dual_llm_provider_infrastructure.sql`

**Creates**:
- `agent_configurations` columns: `primary_provider`, `fallback_provider`, `provider_config`
- `llm_requests` table: tracks all LLM API calls
- `llm_failover_events` table: monitors provider failover
- `tool_provider_routing` table: defines which provider handles which tool
- Helper functions: `record_llm_request()`, `complete_llm_request()`, `record_llm_failover()`

### 3. Enhanced General Broker Tools

**File**: `supabase/functions/agent-tools-general-broker/index.ts`

**Updates**:
- Integrated Gemini-backed vendor normalization
- Enhanced vendor search with Gemini fallback option
- Structured logging with correlation IDs

---

## Environment Variables Required

```bash
# Existing
OPENAI_API_KEY=sk-...

# NEW - Add these
GEMINI_API_KEY=AIza...
GOOGLE_MAPS_API_KEY=AIza...  # Optional, for geocoding

# Feature flag (default: enabled)
FEATURE_DUAL_LLM=true
FEATURE_LLM_FAILOVER=true
```

---

## How It Works

### 1. Chat Completion Flow

```typescript
// In your agent handler
import { LLMRouter } from "../_shared/llm-router.ts";

const router = new LLMRouter({ 
  correlationId,
  enableFailover: true 
});

const response = await router.execute('general-broker', {
  model: 'gpt-4-turbo-preview', // or 'gemini-1.5-flash'
  system: "You are EasyMO General Broker...",
  messages: conversationHistory,
  tools: agentTools,
  temperature: 0.7,
});
```

**Router decides**:
- If tools include Gemini-preferred ones → use Gemini
- Otherwise → use agent's `primary_provider` (default: OpenAI)
- On error → failover to `fallback_provider`

### 2. Tool Routing

**Gemini-preferred tools** (Google ecosystem):
- `find_vendors_nearby` - Maps integration
- `normalize_vendor_payload` - OCR & parsing
- `parse_property_listing` - Document extraction
- `analyze_menu_image` - Vision + structure
- `research_farming_info` - Web search

**OpenAI-preferred tools** (conversation):
- `get_user_profile`
- `classify_request`
- `route_to_agent`
- `search_easymo_faq`

### 3. Gemini Tool Examples

#### Normalize Vendor Payload
```typescript
import { normalizeVendorPayload } from "../_shared/gemini-tools.ts";

// User sends WhatsApp message: "I have hardware shop in Nyamirambo, we sell cement, paint, iron sheets"
const normalized = await normalizeVendorPayload({
  rawText: userMessage,
  imageUrl: businessCardPhoto, // Optional
}, correlationId);

// Returns:
{
  vendor_name: "Nyamirambo Hardware",
  categories: ["hardware", "construction", "retail"],
  description: "Hardware shop selling cement, paint, and iron sheets",
  address: "Nyamirambo, Kigali",
  latitude: -1.9706,
  longitude: 30.0588
}
```

#### Parse Menu Image
```typescript
import { parseDocument } from "../_shared/gemini-tools.ts";

const menu = await parseDocument(imageUrl, 'menu', correlationId);

// Returns:
[
  {
    name: "Brochettes",
    price: 2500,
    currency: "RWF",
    category: "main",
    dietary_tags: ["gluten-free"]
  },
  // ...
]
```

#### Cross-Check Response
```typescript
import { crossCheckResponse } from "../_shared/gemini-tools.ts";

const validation = await crossCheckResponse(
  draftResponse,
  { policyData, userContext },
  [
    "Must not promise refunds without manager approval",
    "Must cite actual policy numbers",
    "Must not give legal advice"
  ],
  correlationId
);

if (!validation.isValid) {
  // Don't send draft, use safe fallback
  return safeFallbackMessage;
}
```

---

## Agent Configuration

### Database Setup

```sql
-- Set General Broker to use OpenAI primary, Gemini fallback
UPDATE agent_configurations
SET
  primary_provider = 'openai',
  fallback_provider = 'gemini',
  provider_config = '{
    "openai": {
      "model": "gpt-4-turbo-preview",
      "temperature": 0.7,
      "max_tokens": 1000
    },
    "gemini": {
      "model": "gemini-1.5-flash",
      "temperature": 0.7,
      "max_tokens": 1000
    }
  }'::jsonb
WHERE agent_type = 'general-broker';

-- Set Waiter AI to use Gemini for menu parsing
UPDATE agent_configurations
SET
  primary_provider = 'openai',
  provider_config = jsonb_set(
    provider_config,
    '{gemini,use_for_vision}',
    'true'
  )
WHERE agent_type = 'waiter';
```

### Tool Routing Override

```sql
-- Make specific tool always use Gemini
UPDATE tool_provider_routing
SET preferred_provider = 'gemini'
WHERE tool_name = 'analyze_restaurant_menu';
```

---

## Monitoring & Observability

### 1. LLM Request Metrics

```sql
-- Requests in last hour
SELECT
  provider,
  agent_type,
  COUNT(*) as requests,
  AVG(duration_ms) as avg_duration,
  SUM(total_tokens) as tokens_used
FROM llm_requests
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY provider, agent_type;
```

### 2. Failover Events

```sql
-- Recent failovers
SELECT
  agent_type,
  primary_provider,
  fallback_provider,
  failover_success,
  created_at
FROM llm_failover_events
ORDER BY created_at DESC
LIMIT 20;
```

### 3. Performance View

```sql
-- Hourly performance
SELECT * FROM llm_performance_metrics
WHERE hour > NOW() - INTERVAL '24 hours'
ORDER BY hour DESC;
```

### 4. Structured Logs

All events logged with correlation IDs:

```json
{
  "event": "LLM_ROUTER_EXECUTE",
  "agentSlug": "general-broker",
  "primaryProvider": "openai",
  "model": "gpt-4-turbo-preview",
  "hasTools": true,
  "correlationId": "abc-123",
  "timestamp": "2025-11-20T12:00:00Z"
}
```

---

## Cost Optimization

### Model Selection Strategy

| Use Case | Provider | Model | Reason |
|----------|----------|-------|--------|
| Chat conversation | OpenAI | gpt-3.5-turbo | Cost-effective |
| Complex reasoning | OpenAI | gpt-4-turbo | Best quality |
| Document parsing | Gemini | gemini-1.5-flash | Cheaper + better OCR |
| Vision tasks | Gemini | gemini-1.5-flash | Cheaper than GPT-4 Vision |
| Embeddings | OpenAI | text-embedding-3-small | Proven performance |
| Batch ingestion | Gemini | gemini-1.5-flash | High volume, low cost |

### Cost Tracking

```sql
-- Estimated costs (approximate rates)
SELECT
  provider,
  agent_type,
  SUM(total_tokens) as total_tokens,
  CASE
    WHEN provider = 'openai' THEN SUM(total_tokens) * 0.00001  -- ~$0.01/1K tokens
    WHEN provider = 'gemini' THEN SUM(total_tokens) * 0.000005 -- ~$0.005/1K tokens
  END as estimated_cost_usd
FROM llm_requests
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY provider, agent_type;
```

---

## Integration Steps

### Step 1: Deploy Migration

```bash
# Apply database changes
supabase db push

# Verify tables created
psql $DATABASE_URL -c "\dt llm_*"
```

### Step 2: Set Environment Variables

```bash
# In Supabase Dashboard → Settings → Edge Functions
# Add:
GEMINI_API_KEY=your_key_here
GOOGLE_MAPS_API_KEY=your_key_here  # Optional
```

### Step 3: Update Edge Functions

Deploy updated functions:
```bash
# Deploy General Broker tools
supabase functions deploy agent-tools-general-broker

# Deploy any agent using LLM Router
supabase functions deploy wa-webhook-ai-agents
```

### Step 4: Test Failover

```bash
# Test with invalid OpenAI key (should failover to Gemini)
curl -X POST https://your-project.supabase.co/functions/v1/agent-tools-general-broker \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "normalize_vendor_payload",
    "userId": "test-user",
    "rawText": "Hardware shop in Kimironko selling cement and paint"
  }'
```

### Step 5: Monitor Performance

```bash
# Check logs
supabase functions logs agent-tools-general-broker --tail

# Query metrics
psql $DATABASE_URL -c "SELECT * FROM llm_performance_metrics ORDER BY hour DESC LIMIT 10;"
```

---

## Guardrails Enforcement

### 1. EasyMO-Only Scope

```typescript
// In system prompt
const BROKER_SYSTEM_PROMPT = `
You are the EasyMO General Broker.

CRITICAL GUARDRAILS:
- ONLY discuss EasyMO services (mobility, property, jobs, marketplace, etc.)
- NEVER provide general internet knowledge
- ALWAYS ground responses in EasyMO database
- If user asks non-EasyMO question, politely redirect

Example:
User: "What's the capital of France?"
You: "I can only help with EasyMO services like finding properties, 
      booking rides, or searching jobs. How can I assist you today?"
`;
```

### 2. Tool-Level Validation

```typescript
// Before executing tool
if (toolName === 'web_search' && agentType === 'general-broker') {
  throw new Error("General Broker cannot use web_search - EasyMO scope only");
}
```

### 3. Response Validation

```typescript
// After getting LLM response
const validation = await crossCheckResponse(
  response.content,
  { allowedTopics: ['easymo_services'] },
  [
    "Must not discuss non-EasyMO topics",
    "Must cite EasyMO data sources",
    "Must not make unsupported claims"
  ]
);
```

---

## Future Enhancements

### Phase 2: Background Jobs

```typescript
// Cron job for data enrichment
export async function enrichVendorsDaily() {
  const vendors = await supabase
    .from('vendors')
    .select('*')
    .is('geocoded', false);

  for (const vendor of vendors) {
    const enriched = await normalizeVendorPayload({
      rawText: vendor.description,
      address: vendor.address,
    });

    await supabase
      .from('vendors')
      .update({
        latitude: enriched.latitude,
        longitude: enriched.longitude,
        geocoded: true,
      })
      .eq('id', vendor.id);
  }
}
```

### Phase 3: A/B Testing

```sql
-- Test different providers for same agent
UPDATE agent_configurations
SET routing_config = jsonb_set(
  routing_config,
  '{ab_test}',
  '{"enabled": true, "openai_pct": 50, "gemini_pct": 50}'
)
WHERE agent_type = 'waiter';
```

### Phase 4: Cost Alerts

```sql
-- Alert if daily cost exceeds threshold
CREATE OR REPLACE FUNCTION check_llm_cost_threshold()
RETURNS VOID AS $$
DECLARE
  daily_cost DECIMAL;
BEGIN
  SELECT SUM(total_tokens) * 0.00001 INTO daily_cost
  FROM llm_requests
  WHERE created_at > NOW() - INTERVAL '1 day';

  IF daily_cost > 100 THEN
    -- Trigger alert
    INSERT INTO admin_notifications (type, message)
    VALUES ('cost_alert', 'LLM daily cost exceeded $100');
  END IF;
END;
$$ LANGUAGE plpgsql;
```

---

## Troubleshooting

### Issue: Gemini provider fails to initialize

**Cause**: Missing `GEMINI_API_KEY`

**Fix**:
```bash
# Check env
supabase secrets list

# Set if missing
supabase secrets set GEMINI_API_KEY=your_key
```

### Issue: High latency on Gemini calls

**Cause**: Model too large or complex prompt

**Fix**:
```typescript
// Use faster model for simple tasks
providerConfig: {
  gemini: {
    model: 'gemini-1.5-flash', // Instead of 'gemini-1.5-pro'
  }
}
```

### Issue: Failover not triggering

**Cause**: `enableFailover` not set

**Fix**:
```typescript
const router = new LLMRouter({ 
  correlationId,
  enableFailover: true  // ← Add this
});
```

---

## Success Metrics

Track these KPIs:

1. **Availability**: % of requests that succeed (target: 99.9%)
2. **Latency**: P95 response time (target: <2s)
3. **Cost**: Daily LLM spend (track trends)
4. **Failover Rate**: % of requests using fallback (should be <1%)
5. **Tool Accuracy**: Gemini parse success rate (target: >95%)

---

## Contact & Support

- **Implementation Questions**: Check this guide first
- **Bugs**: File issue with `[Dual-LLM]` prefix
- **Performance**: Query `llm_performance_metrics` view
- **Costs**: Query `llm_requests` with token aggregation

---

**Status**: ✅ Implementation complete and ready for deployment

**Last Updated**: 2025-11-20

**Version**: 1.0.0
