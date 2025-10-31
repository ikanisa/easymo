# AI Agent Stack - Setup & Usage Guide

## Overview

The EasyMO AI Agent Stack provides intelligent, tool-enabled conversational agents powered by OpenAI's Responses API (text) and Realtime API (voice). Agents can perform voucher operations, customer lookup, and other database operations through natural language interactions.

## Architecture

### Components

1. **AI Package** (`/ai`)
   - **Schemas**: Zod schemas with JSON-Schema export for OpenAI function calling
   - **Responses**: Client and router for text-based conversations
   - **Realtime**: SIP session handler and tool bridge for voice calls
   - **AgentKit**: Configuration files for orchestration (graph, connectors, evals)
   - **Tooling**: Tool dispatcher that calls Supabase Edge Functions

2. **Supabase Edge Functions**
   - `ai-lookup-customer`: Find customer by MSISDN
   - `ai-create-voucher`: Create new fuel vouchers
   - `ai-redeem-voucher`: Redeem issued vouchers
   - `ai-void-voucher`: Void/cancel vouchers
   - `ai-whatsapp-webhook`: Receive and process WhatsApp messages
   - `ai-realtime-webhook`: Handle tool calls from voice sessions

3. **Configuration**
   - **Observability**: OpenTelemetry tracing, structured logging with PII masking
   - **Feature Flags**: All agent features default to OFF
   - **Security**: No secrets in client environment variables

## Setup

### 1. Prerequisites

- Node.js ≥ 18
- pnpm ≥ 8
- OpenAI API key with Responses API and Realtime API access
- Supabase project with service role key
- WhatsApp Business API credentials (optional, for chat)
- SIP trunk credentials (optional, for voice)

### 2. Environment Variables

Add to your `.env` file:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-...your-key...
OPENAI_RESPONSES_MODEL=gpt-4o-mini
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...
SUPABASE_ANON_KEY=eyJ...your-anon-key...

# WhatsApp (optional, for chat)
WA_PHONE_ID=your-phone-number-id
WA_TOKEN=your-access-token
WA_VERIFY_TOKEN=your-verify-token
WHATSAPP_API_URL=https://graph.facebook.com/v20.0

# Feature Flags (enable as needed)
FEATURE_AGENT_CHAT=false
FEATURE_AGENT_VOICE=false
FEATURE_AGENT_VOUCHERS=false
FEATURE_AGENT_CUSTOMER_LOOKUP=false

# Observability (optional)
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-otel-collector:4318
OTEL_SERVICE_NAME=ai-agents
ENABLE_OTEL_TRACING=false
LOG_LEVEL=info
```

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Build AI Package

```bash
pnpm --filter @easymo/ai build
```

### 5. Deploy Supabase Functions

```bash
# Deploy all AI agent functions
supabase functions deploy ai-lookup-customer
supabase functions deploy ai-create-voucher
supabase functions deploy ai-redeem-voucher
supabase functions deploy ai-void-voucher
supabase functions deploy ai-whatsapp-webhook
supabase functions deploy ai-realtime-webhook

# Set environment secrets
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set FEATURE_AGENT_CHAT=true
supabase secrets set FEATURE_AGENT_VOICE=true
```

## Usage

### Text Conversations (Responses API)

```typescript
import { respond, extractTextContent } from "@easymo/ai/responses";

const response = await respond(
  [
    { role: "user", content: "Create a voucher for 50,000 RWF for +250788000000" },
  ],
  {
    metadata: {
      correlation_id: crypto.randomUUID(),
      user_id: "customer-123",
    },
  }
);

const reply = extractTextContent(response);
console.log(reply);
```

### Voice Calls (Realtime API)

```typescript
import { createRealtimeSession } from "@easymo/ai/realtime";

// From SIP trunk, you receive an SDP offer
const { sdpAnswer } = await createRealtimeSession(
  sdpOffer,
  correlationId
);

// Return SDP answer to complete WebRTC negotiation
// The Realtime API will handle the voice conversation
// and call your webhook for tool executions
```

### WhatsApp Integration

1. Configure WhatsApp webhook URL:
   ```
   https://your-project.supabase.co/functions/v1/ai-whatsapp-webhook
   ```

2. Enable feature flag:
   ```bash
   FEATURE_AGENT_CHAT=true
   ```

3. Users can now send messages like:
   - "Create a voucher for 10,000 RWF"
   - "Check if +250788123456 is registered"
   - "Void voucher abc123"

### Tool Execution

Tools are automatically called when the AI determines they're needed:

1. **lookup_customer**: Finds customer by phone number
2. **create_voucher**: Creates new voucher (amount, currency)
3. **redeem_voucher**: Redeems issued voucher
4. **void_voucher**: Voids/cancels voucher

All tools:
- Log structured events with correlation IDs
- Mask PII (MSISDN shows as +2507***000)
- Return standardized response format
- Handle errors gracefully

## Testing

### Unit Tests

```bash
# Run all AI package tests
pnpm --filter @easymo/ai test

# Watch mode
pnpm --filter @easymo/ai test:watch
```

### Integration Tests

Test Supabase functions locally:

```bash
# Start Supabase locally
supabase start

# Test lookup customer
curl -X POST http://localhost:54321/functions/v1/ai-lookup-customer \
  -H "Content-Type: application/json" \
  -H "X-Agent-JWT: $AGENT_CORE_INTERNAL_TOKEN" \
  -d '{"msisdn": "+250788000000"}'

# Test create voucher
curl -X POST http://localhost:54321/functions/v1/ai-create-voucher \
  -H "Content-Type: application/json" \
  -H "X-Agent-JWT: $AGENT_CORE_INTERNAL_TOKEN" \
  -d '{"customer_msisdn": "+250788000000", "amount": 50000}'
```

### WhatsApp Webhook Testing

Use ngrok to expose local Supabase:

```bash
ngrok http 54321
# Set webhook URL: https://your-ngrok-url.ngrok.io/functions/v1/ai-whatsapp-webhook
```

## Observability

### Structured Logging

All components log JSON events:

```json
{
  "timestamp": "2025-10-30T06:30:00.000Z",
  "level": "info",
  "event": "ai.tool.create_voucher.success",
  "correlation_id": "123e4567-e89b-12d3-a456-426614174000",
  "voucher_id": "abc-123",
  "amount": 50000,
  "msisdn_masked": "+2507***000"
}
```

### PII Masking

Phone numbers are automatically masked in logs:
- Original: `+250788123456`
- Masked: `+2507***456`

### Tracing

When `ENABLE_OTEL_TRACING=true`:
- All requests get correlation IDs
- Spans track tool execution
- Distributed tracing across services

### Metrics

Monitor:
- Tool call latency (p50, p95, p99)
- Tool call success rate
- OpenAI API costs
- WhatsApp message volume

## Security

### Ground Rules Compliance

✅ **Observability**: Structured logging with correlation IDs  
✅ **Security**: No secrets in VITE_*/NEXT_PUBLIC_* vars  
✅ **Feature Flags**: All features default to OFF  
✅ **PII Protection**: MSISDN masking in all logs  
✅ **Idempotency**: WhatsApp message deduplication  

### Best Practices

1. **Never expose secrets** in client-side code
2. **Always validate** tool inputs with Zod schemas
3. **Use correlation IDs** for request tracing
4. **Mask PII** in logs and traces
5. **Feature flag** all new capabilities
6. **Rate limit** per-customer tool calls

## Troubleshooting

### "OpenAI API key not configured"

Ensure `OPENAI_API_KEY` is set in your environment or Supabase secrets.

### "Supabase configuration missing"

Set both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### "Feature disabled"

Enable the appropriate feature flag:
- `FEATURE_AGENT_CHAT=true` for WhatsApp
- `FEATURE_AGENT_VOICE=true` for voice calls
- `FEATURE_AGENT_VOUCHERS=true` for voucher operations

### WhatsApp webhook not receiving messages

1. Verify webhook URL is publicly accessible
2. Check `WA_VERIFY_TOKEN` matches in both WhatsApp config and your env
3. Ensure `FEATURE_AGENT_CHAT=true`
4. Check Supabase function logs for errors

### Tool calls failing

1. Check Supabase function is deployed and running
2. Verify service role key has correct permissions
3. Check function logs for specific errors
4. Ensure database tables (profiles, vouchers) exist

## Next Steps

1. Review [migration.md](./migration.md) for deployment and rollback procedures
2. Review [runbooks.md](./runbooks.md) for operational procedures
3. Implement evaluation suite (see `/ai/evals`)
4. Set up monitoring dashboards
5. Configure alerts for failures and anomalies

## Support

For issues or questions:
- Check function logs: `supabase functions logs ai-lookup-customer`
- Review structured logs with correlation IDs
- Consult [GROUND_RULES.md](../GROUND_RULES.md) for compliance requirements
