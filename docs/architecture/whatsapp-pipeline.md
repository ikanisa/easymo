# WhatsApp Pipeline Architecture

**Status**: Design Phase  
**Last Updated**: 2025-11-22  
**Purpose**: Unified WhatsApp webhook pipeline for all AI agents

## Overview

Single, consolidated WhatsApp webhook handler that normalizes events, detects active agent, parses intents, and triggers domain updates.

## Current State vs. Target

### Current (❌ Fragmented)
```
WhatsApp Cloud API
    ↓
    ├→ wa-webhook (main)
    ├→ wa-webhook-jobs
    ├→ wa-webhook-mobility  
    ├→ wa-webhook-property
    ├→ wa-webhook-wallet
    ├→ wa-webhook-core
    └→ wa-webhook-ai-agents
```

### Target (✅ Unified)
```
WhatsApp Cloud API
    ↓
wa-webhook (single entry point)
    ↓
[Normalize Event] → whatsapp_messages
    ↓
[Detect Agent] → Find/create whatsapp_conversation
    ↓
[Agent Runtime] → OpenAI/Gemini with context
    ↓
[Parse Intent] → ai_agent_intents (status='pending')
    ↓
[Apply Intent Service] → Update domain tables
    ↓
[Generate Reply] → Send WhatsApp message
```

## Pipeline Components

### 1. Event Normalization
**Location**: `wa-webhook/index.ts`

**Responsibilities**:
- Validate WhatsApp signature (security)
- Extract phone number, message type, content
- Create/update `whatsapp_users` record
- Store raw message in `whatsapp_messages`
- Generate correlation ID for tracing

**Schema**:
```typescript
interface NormalizedEvent {
  correlationId: string;
  userId: uuid;  // from whatsapp_users
  phoneNumber: string;
  messageType: 'text' | 'interactive' | 'location' | 'image';
  content: string;
  payload: any;  // original WhatsApp payload
  timestamp: Date;
}
```

### 2. Agent Detection
**Location**: `wa-webhook/router/agent-detector.ts`

**Logic**:
1. Check for active conversation with non-null agent_id
2. Check message content for menu selection (1️⃣-9️⃣)
3. Check for agent-specific keywords ("order food", "find job", etc.)
4. Default to main menu if no match

**Menu Mapping**:
```typescript
const MENU_TO_AGENT = {
  '1': 'waiter',
  '2': 'farmer',
  '3': 'business-broker',
  '4': 'real-estate',
  '5': 'jobs',
  '6': 'sales-sdr',
  '7': 'rides',
  '8': 'insurance',
  '9': null  // Profile - non-agent
};
```

**Output**:
- Create/update `whatsapp_conversations` with agent_id
- Return agent config from `ai_agents` table

### 3. Agent Runtime
**Location**: `wa-webhook/router/agent-runtime.ts`

**Responsibilities**:
- Load agent config (persona, system instructions, tools)
- Fetch recent conversation history (last 10 messages)
- Load user profile/preferences for context
- Call LLM (OpenAI/Gemini) with structured function calling
- Parse LLM response into intent structure

**Context Building**:
```typescript
interface AgentContext {
  agent: AgentConfig;
  user: UserProfile;
  conversation: {
    messages: Message[];
    savedLocations: Location[];
    recentEntities: any[];  // recent orders, trips, etc.
  };
}
```

**System Prompt Template**:
```
You are the {agent.name} for EasyMO, assisting via WhatsApp.

Persona: {agent.persona.tone_style}
Language: {user.preferred_language}

Guidelines:
- Keep messages VERY short (1-2 sentences)
- Use emoji-numbered options (1️⃣, 2️⃣, 3️⃣) for choices
- Ask ONE question at a time
- Reuse saved info (locations, preferences) when possible
- Parse user intent into structured JSON

Tools available: {agent.tools}
```

### 4. Intent Parsing
**Location**: `wa-webhook/router/intent-parser.ts`

**Responsibilities**:
- Extract structured data from LLM response
- Validate intent schema
- Store in `ai_agent_intents` table with status='pending'
- Include confidence score

**Intent Schema**:
```typescript
interface ParsedIntent {
  id: uuid;
  conversation_id: uuid;
  agent_id: uuid;
  message_id: uuid;
  intent_type: string;  // e.g., 'order_food', 'find_job', 'book_trip'
  intent_subtype?: string;  // e.g., 'order_food.confirm', 'find_job.search'
  raw_text: string;
  summary: string;  // human-readable summary
  structured_payload: {
    // Intent-specific fields
    // e.g., for 'order_food': { barId, menuItems: [...], deliveryLocation }
  };
  confidence: number;  // 0.0-1.0
  status: 'pending' | 'applied' | 'failed';
  created_at: timestamp;
}
```

### 5. Apply Intent Service
**Location**: `services/agent-core/src/apply-intent/`

**Responsibilities**:
- Poll `ai_agent_intents` where status='pending'
- Route by agent_id + intent_type
- Update domain tables (orders, trips, applications, etc.)
- Create match events if applicable
- Update intent status to 'applied'
- Trigger notifications/webhooks

**Routing Logic**:
```typescript
async function applyIntent(intent: ParsedIntent) {
  const handler = getIntentHandler(intent.agent_id, intent.intent_type);
  
  try {
    const result = await handler(intent);
    
    // Update domain tables
    // Create matches if needed
    // Trigger notifications
    
    await updateIntentStatus(intent.id, 'applied', result);
  } catch (error) {
    await updateIntentStatus(intent.id, 'failed', { error });
    await notifyAdmin(intent, error);
  }
}
```

**Example Handlers**:
- `waiter/order-food.ts` → Insert into `orders` table
- `jobs/find-job.ts` → Search `job_posts`, create `ai_agent_match_events`
- `rides/book-trip.ts` → Insert into `trips`, match driver, create `ai_agent_match_events`

### 6. Reply Generation
**Location**: `wa-webhook/router/reply-generator.ts`

**Responsibilities**:
- Format agent response for WhatsApp
- Add emoji-numbered options
- Use WhatsApp interactive buttons/lists when appropriate
- Send via WhatsApp Cloud API
- Store in `whatsapp_messages` (direction='outbound')

**Message Formatting**:
```typescript
interface ReplyOptions {
  text: string;
  buttons?: { id: string; title: string }[];
  listSections?: { title: string; rows: any[] }[];
  footer?: string;
}

function formatReply(agentResponse: string, options?: ReplyOptions): WhatsAppMessage {
  // Add emoji numbers if options provided
  // Use interactive message if appropriate
  // Keep concise and clear
}
```

## Error Handling

### Webhook Validation Failure
- Return 401 Unauthorized
- Log security event
- Alert admin

### Agent Detection Failure
- Default to main menu
- Send menu options
- Log for analysis

### LLM Call Failure
- Retry with exponential backoff (max 3 retries)
- Fallback to predefined response
- Log error with correlation ID
- Alert if rate > 5%

### Intent Application Failure
- Mark intent as 'failed'
- Notify admin
- Send user-friendly error message
- Store error details for debugging

## Observability

### Structured Logging
```typescript
import { logStructuredEvent } from '../_shared/observability.ts';

await logStructuredEvent('WEBHOOK_RECEIVED', {
  correlationId,
  userId,
  messageType,
  agentSlug: agent?.slug,
});

await logStructuredEvent('INTENT_PARSED', {
  correlationId,
  intentType,
  confidence,
  agentSlug,
});

await logStructuredEvent('INTENT_APPLIED', {
  correlationId,
  intentId,
  domainTable: 'orders',
  recordId,
});
```

### Metrics
```typescript
import { recordMetric } from '../_shared/observability.ts';

await recordMetric('webhook.received', 1, { agent: 'waiter' });
await recordMetric('intent.parsed', 1, { agent: 'waiter', type: 'order_food' });
await recordMetric('intent.applied', 1, { agent: 'waiter', success: true });
await recordMetric('llm.latency', durationMs, { provider: 'openai' });
```

### Correlation IDs
- Every request gets a unique correlation ID
- Passed through entire pipeline
- Included in all logs and metrics
- Stored in whatsapp_messages

## Security

### Webhook Signature Validation
```typescript
import { validateWhatsAppSignature } from './utils/wa_validate.ts';

const isValid = await validateWhatsAppSignature(
  req.body,
  req.headers.get('x-hub-signature-256'),
  process.env.WA_APP_SECRET
);

if (!isValid) {
  return new Response('Unauthorized', { status: 401 });
}
```

### Service Role Key Protection
- Never expose in client-side code
- Only in server-side edge functions
- Use `EASYMO_ADMIN_TOKEN` for admin APIs
- Validate in prebuild script

### PII Masking
```typescript
function maskPII(data: any) {
  return {
    ...data,
    phoneNumber: maskPhone(data.phoneNumber),
    location: data.location ? '[LOCATION]' : null,
  };
}
```

## Feature Flags

### Gradual Rollout
```typescript
// Environment variables
const FEATURE_UNIFIED_WEBHOOK = process.env.FEATURE_UNIFIED_WEBHOOK === 'true';
const FEATURE_INTENT_SYSTEM = process.env.FEATURE_INTENT_SYSTEM === 'true';
const FEATURE_WAITER_AGENT = process.env.FEATURE_WAITER_AGENT === 'true';

// Route based on flags
if (FEATURE_UNIFIED_WEBHOOK) {
  await processUnifiedWebhook(req);
} else {
  await legacyWebhookHandler(req);
}
```

### Per-Agent Flags
Enable agents one at a time:
- `FEATURE_WAITER_AGENT`
- `FEATURE_FARMER_AGENT`
- `FEATURE_BROKER_AGENT`
- etc.

## Testing

### Integration Tests
```typescript
describe('Unified WhatsApp Pipeline', () => {
  it('should normalize WhatsApp text message', async () => {
    const result = await normalizeEvent(mockWhatsAppTextEvent);
    expect(result.userId).toBeDefined();
    expect(result.messageType).toBe('text');
  });

  it('should detect agent from menu selection', async () => {
    const agent = await detectAgent('1️⃣', user);
    expect(agent.slug).toBe('waiter');
  });

  it('should parse waiter order intent', async () => {
    const intent = await parseIntent(mockOrderMessage, waiterAgent);
    expect(intent.intent_type).toBe('order_food');
    expect(intent.structured_payload.menuItems).toBeDefined();
  });

  it('should apply waiter order intent', async () => {
    const result = await applyIntent(mockOrderIntent);
    expect(result.orderId).toBeDefined();
    
    const order = await db.query('SELECT * FROM orders WHERE id = $1', [result.orderId]);
    expect(order.rows[0].status).toBe('pending');
  });

  it('should send WhatsApp reply', async () => {
    const sent = await sendReply(user.phoneNumber, 'Order confirmed! 🎉');
    expect(sent.messageId).toBeDefined();
  });
});
```

### Load Testing
- Simulate 100 concurrent webhook requests
- Measure latency at p50, p95, p99
- Target: < 500ms p95 for end-to-end pipeline

## Migration Plan

### Phase 1: Parallel Operation
- Deploy unified webhook alongside existing handlers
- Use feature flag to route small % of traffic
- Monitor metrics and errors
- Gradually increase %

### Phase 2: Full Migration
- Route all traffic through unified webhook
- Keep old handlers for rollback
- Monitor for 2 weeks

### Phase 3: Cleanup
- Remove old webhook handlers
- Clean up unused code
- Update documentation

## Performance Targets

- **Webhook Response**: < 200ms (signature validation + queuing)
- **Intent Parsing**: < 2s (LLM call)
- **Intent Application**: < 1s (DB updates)
- **Reply Delivery**: < 500ms (WhatsApp API)
- **End-to-End**: < 4s (webhook → reply sent)

## Next Steps

1. Implement unified webhook handler
2. Create agent detection logic
3. Build intent parser with LLM integration
4. Implement applyIntent service
5. Add comprehensive tests
6. Deploy with feature flags
7. Monitor and iterate

**Document Status**: ✅ Design Complete  
**Implementation Status**: 🚧 In Progress  
**Owner**: EasyMO Engineering Team
