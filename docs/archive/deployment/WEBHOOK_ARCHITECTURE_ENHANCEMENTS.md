# WhatsApp Webhook Architecture Enhancements

## Overview

This document describes the critical fixes implemented to address fragmented state management, missing error recovery, and service orchestration issues in the WhatsApp webhook system.

## Problem Statement

The original webhook system had several critical issues:

1. **No Conversation State Persistence** - Conversations lost context between messages
2. **Missing Retry Logic** - Failed webhook deliveries were silently lost
3. **No Message Deduplication** - WhatsApp duplicate messages were processed multiple times
4. **No Circuit Breaker** - Downstream service failures cascaded without protection
5. **Missing Agent Service Orchestration** - AI agents called directly without health checks or fallbacks
6. **No Conversation Memory** - AI interactions had no memory between messages

## Solution Architecture

### 1. Database Schema Enhancements

#### AI Conversation Memory Table
```sql
CREATE TABLE ai_conversation_memory (
  id UUID PRIMARY KEY,
  user_phone TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  conversation_history JSONB DEFAULT '[]',
  context JSONB DEFAULT '{}',
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  session_id UUID
);
```

**Purpose**: Stores AI agent conversation history and context for continuity across messages.

**Usage**:
```typescript
import { getOrCreateConversationMemory, updateConversationMemory } from "./utils/message-deduplication.ts";

// Get conversation memory
const memory = await getOrCreateConversationMemory(userPhone, "waiter-ai");

// Update with new message
await updateConversationMemory(memory.id, {
  role: "user",
  content: "I want to order pasta"
});
```

#### Message Queue Table
```sql
CREATE TABLE message_queue (
  id UUID PRIMARY KEY,
  message_id TEXT UNIQUE NOT NULL,
  user_phone TEXT NOT NULL,
  message_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  priority INTEGER DEFAULT 5
);
```

**Purpose**: Reliable message processing queue with exponential backoff retry logic.

**Features**:
- Priority-based processing (1=highest, 10=lowest)
- Automatic retry with exponential backoff (1s, 2s, 4s, 8s...)
- Lock-based concurrency control
- Dead letter queue integration for max retries

**Usage**:
```typescript
import { enqueueMessage } from "./utils/message-deduplication.ts";

await enqueueMessage(
  messageId,
  userPhone,
  "text",
  { text: "Hello" },
  correlationId,
  5 // priority
);
```

#### Workflow State Tracking Table
```sql
CREATE TABLE workflow_states (
  id UUID PRIMARY KEY,
  user_phone TEXT NOT NULL,
  workflow_type TEXT NOT NULL,
  current_step TEXT NOT NULL,
  workflow_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  timeout_at TIMESTAMPTZ
);
```

**Purpose**: Tracks multi-step workflow states (orders, payments, job applications, etc.)

**Workflow Types**:
- `order` - Order placement workflows (15 min timeout)
- `payment` - Payment processing (10 min timeout)
- `job_application` - Job application submissions (30 min timeout)
- `property_inquiry` - Property rental inquiries (1 hour timeout)
- `ride_request` - Ride booking (5 min timeout)
- `insurance_claim` - Insurance claims (1 hour timeout)

### 2. Error Handling & Recovery

#### WorkflowError Class
```typescript
class WorkflowError extends Error {
  constructor(
    message: string,
    public code: string,
    public context: Record<string, unknown>,
    public recoverable: boolean = true,
    public retryable: boolean = true
  ) {}
}
```

**Purpose**: Structured error class with recovery metadata.

**Usage**:
```typescript
import { WorkflowError, withErrorBoundary } from "../../_shared/error-handler.ts";

const result = await withErrorBoundary(
  async () => {
    const response = await processPayment(amount);
    if (!response.success) {
      throw new WorkflowError(
        "Payment failed",
        "PAYMENT_FAILED",
        { amount, userId },
        true,  // recoverable
        true   // retryable
      );
    }
    return response;
  },
  {
    operationName: "process_payment",
    userId: user.id,
    correlationId,
    messageId: message.id
  }
);
```

#### Error Boundary Pattern
The `withErrorBoundary` function provides automatic error handling:
- Logs errors with full context
- Automatically queues retryable errors
- Integrates with observability system
- Tracks correlation IDs across operations

### 3. Service Discovery & Circuit Breakers

#### ServiceRegistry Class
```typescript
import { ServiceRegistry } from "@easymo/commons";

const registry = new ServiceRegistry();

// Register AI agent service
registry.register({
  name: "waiter-ai",
  url: "https://waiter-ai.example.com",
  healthCheckUrl: "https://waiter-ai.example.com/health",
  timeout: 120000, // 2 minutes for AI operations
  retryPolicy: {
    maxRetries: 3,
    backoffMs: 1000
  }
});

// Start periodic health checks
registry.startHealthChecks();

// Discover and use service
const endpoint = await registry.discoverService("waiter-ai");
const response = await registry.request("waiter-ai", "/api/process", {
  method: "POST",
  body: JSON.stringify(data)
});
```

**Features**:
- Automatic health checking (30 second intervals)
- Circuit breaker protection per endpoint
- Load balancing based on endpoint health
- Automatic recovery detection
- Fallback support

#### Circuit Breaker Configuration
```typescript
import { WEBHOOK_CONFIG } from "../../_shared/webhook-config.ts";

// Standard circuit breaker (50% failure threshold)
WEBHOOK_CONFIG.circuitBreaker = {
  failureThreshold: 50,
  resetTimeoutMs: 60000,
  halfOpenRequests: 3,
  volumeThreshold: 5,
  timeoutMs: 30000
};

// AI agent circuit breaker (more lenient)
WEBHOOK_CONFIG.aiAgentCircuitBreaker = {
  failureThreshold: 60,
  resetTimeoutMs: 120000,
  halfOpenRequests: 2,
  volumeThreshold: 3,
  timeoutMs: 120000
};
```

### 4. Message Deduplication

#### Database-Backed Deduplication
```typescript
import { isNewMessage, markMessageProcessed } from "./utils/message-deduplication.ts";

// Check if message is new
const isNew = await isNewMessage(messageId, correlationId);
if (!isNew) {
  return new Response("duplicate", { status: 200 });
}

// Process message...

// Mark as processed
await markMessageProcessed(
  messageId,
  correlationId,
  conversationId,
  payload,
  processingTimeMs
);
```

**Features**:
- Database-backed deduplication (5 minute window)
- Graceful degradation on errors (fail open)
- Processing time tracking
- Correlation ID tracking

### 5. Webhook Configuration

#### Centralized Configuration
All webhook settings are centralized in `supabase/functions/_shared/webhook-config.ts`:

```typescript
import { WEBHOOK_CONFIG, calculateRetryDelay } from "../../_shared/webhook-config.ts";

// Timeouts
WEBHOOK_CONFIG.timeouts.default;    // 30 seconds
WEBHOOK_CONFIG.timeouts.aiAgent;    // 120 seconds
WEBHOOK_CONFIG.timeouts.payment;    // 60 seconds

// Retry with exponential backoff
const delay = calculateRetryDelay(attemptNumber);
// Returns: 1000ms, 2000ms, 4000ms, 8000ms... (with jitter)

// Deduplication
WEBHOOK_CONFIG.deduplication.enabled;    // true
WEBHOOK_CONFIG.deduplication.windowMs;   // 300000 (5 minutes)
```

## Monitoring & Observability

### Health Check Queries

Run monitoring queries to track system health:
```bash
psql $DATABASE_URL -f monitoring/webhook-health-checks.sql
```

Key metrics:
1. **Stuck Workflows** - Workflows active > 30 minutes
2. **Message Queue Health** - Queue depth and retry statistics
3. **Dead Letter Queue** - Failed messages needing attention
4. **AI Agent Performance** - Usage and latency metrics
5. **Error Rates** - Hourly error rate trends
6. **Circuit Breaker Status** - Services with high error counts

### Database Views

Pre-built monitoring views:
- `message_queue_health` - Queue status by state
- `workflow_health` - Workflow completion rates
- `ai_agent_usage` - Agent activity statistics

```sql
-- Check message queue health
SELECT * FROM message_queue_health;

-- Check workflow health
SELECT * FROM workflow_health
WHERE workflow_type = 'order';

-- Check AI agent usage
SELECT * FROM ai_agent_usage
ORDER BY total_conversations DESC;
```

### Helper Functions

Database helper functions for operational tasks:

```sql
-- Cleanup stale locks (run periodically)
SELECT cleanup_stale_message_locks();

-- Cleanup old messages (run daily)
SELECT cleanup_old_messages();

-- Cleanup stuck conversations (run every 5 minutes)
SELECT cleanup_stuck_webhook_conversations();

-- Get system health summary
SELECT * FROM check_webhook_system_health();
```

## Testing

### Automated Testing Script

```bash
# Test the webhook workflow
./test-webhook-workflow.sh

# With custom webhook URL
WEBHOOK_URL=https://your-webhook.com ./test-webhook-workflow.sh
```

Tests performed:
1. Message deduplication
2. AI agent timeout handling
3. Normal workflow processing
4. Retry mechanism
5. Rate limiting
6. Multi-step workflows

### Manual Testing

```bash
# Send test message
curl -X POST http://localhost:54321/functions/v1/wa-webhook \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: $(uuidgen)" \
  -d '{
    "message_id": "test123",
    "from": "+250788000000",
    "text": "Hello",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
  }'
```

## Integration Guide

### 1. Database Migration

Apply the new migration:
```bash
supabase db push
```

This creates:
- `ai_conversation_memory` table
- `message_queue` table
- `workflow_states` table
- Helper functions
- Monitoring views

### 2. Update Webhook Handler

Add deduplication check:
```typescript
import { isNewMessage, markMessageProcessed } from "./utils/message-deduplication.ts";

// In your message handler
const isNew = await isNewMessage(msg.id, correlationId);
if (!isNew) {
  console.log("Duplicate message, skipping");
  continue;
}

// Process message...

await markMessageProcessed(msg.id, correlationId);
```

### 3. Add Error Boundaries

Wrap critical operations:
```typescript
import { withErrorBoundary } from "../../_shared/error-handler.ts";

const result = await withErrorBoundary(
  async () => processMessage(message),
  {
    operationName: "process_message",
    userId: message.from,
    correlationId,
    messageId: message.id
  }
);
```

### 4. Use Conversation Memory

For AI agents:
```typescript
import { 
  getOrCreateConversationMemory, 
  updateConversationMemory 
} from "./utils/message-deduplication.ts";

// Get memory
const memory = await getOrCreateConversationMemory(
  userPhone,
  "waiter-ai",
  sessionId
);

// Use history in AI call
const response = await callAI({
  messages: memory.conversation_history,
  newMessage: userMessage
});

// Update memory
await updateConversationMemory(memory.id, {
  role: "assistant",
  content: response.text
});
```

### 5. Configure Service Registry

For microservices:
```typescript
import { initializeServiceRegistry } from "@easymo/commons";

const registry = initializeServiceRegistry({
  services: [
    {
      name: "waiter-ai",
      url: Deno.env.get("WAITER_AI_URL")!,
      healthCheckUrl: Deno.env.get("WAITER_AI_URL")! + "/health",
      timeout: 120000,
      retryPolicy: { maxRetries: 3, backoffMs: 1000 }
    },
    // ... more services
  ],
  healthCheckIntervalMs: 30000
});
```

## Performance Considerations

### Database Indexes

All critical queries are indexed:
- `idx_ai_memory_user_phone` - User phone lookups
- `idx_message_queue_status` - Queue processing
- `idx_workflow_states_active` - Active workflow queries
- `idx_processed_messages_whatsapp_id` - Deduplication checks

### Cleanup Operations

Run these periodically (via cron or scheduled jobs):
```sql
-- Daily cleanup (old messages)
SELECT cleanup_old_messages();

-- Hourly cleanup (stale locks)
SELECT cleanup_stale_message_locks();

-- Every 5 minutes (stuck conversations)
SELECT cleanup_stuck_webhook_conversations();
```

### Message Retention

- **Completed messages**: Retained for 7 days
- **Conversation memory**: Retained for 7 days of inactivity
- **Workflow states**: Retained until completion + 7 days
- **DLQ entries**: Retained indefinitely (manual cleanup)

## Troubleshooting

### High Message Queue Depth

```sql
-- Check queue status
SELECT * FROM message_queue_health;

-- Check for stuck messages
SELECT * FROM message_queue
WHERE status = 'processing'
  AND locked_at < NOW() - INTERVAL '5 minutes';

-- Manually cleanup stale locks
SELECT cleanup_stale_message_locks();
```

### Circuit Breaker Open

```sql
-- Check service health
SELECT agent_type, COUNT(*) as high_error_count
FROM webhook_conversations
WHERE error_count >= 3
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY agent_type;
```

Check the service logs and health endpoint. Circuit breaker will automatically attempt recovery after 60 seconds (configurable).

### Workflow Timeouts

```sql
-- Check stuck workflows
SELECT * FROM workflow_states
WHERE status = 'active'
  AND started_at < NOW() - INTERVAL '30 minutes';

-- Manually timeout workflows
UPDATE workflow_states
SET status = 'timeout', completed_at = NOW()
WHERE id = 'workflow-id';
```

## Security Considerations

1. **Row Level Security** - All new tables have RLS enabled with service role bypass
2. **PII Masking** - Phone numbers are masked in logs
3. **Error Context** - Sensitive data excluded from error contexts
4. **Correlation IDs** - Used for tracing without exposing user data

## Ground Rules Compliance

✅ **Observability** - Structured logging with correlation IDs  
✅ **Security** - RLS policies, PII masking, no secrets in logs  
✅ **Reliability** - Circuit breakers, retry logic, graceful degradation  
✅ **Performance** - Indexed queries, cleanup operations, caching  
✅ **Quality** - Error boundaries, monitoring views, health checks  

## References

- [Ground Rules](../docs/GROUND_RULES.md)
- [Service Discovery Package](../packages/commons/src/service-discovery.ts)
- [Error Handler Module](./supabase/functions/_shared/error-handler.ts)
- [Webhook Config](./supabase/functions/_shared/webhook-config.ts)
- [Monitoring Queries](./monitoring/webhook-health-checks.sql)
