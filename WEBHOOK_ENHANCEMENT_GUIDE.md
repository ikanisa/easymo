# WhatsApp Webhook Enhancement - Implementation Guide

## Overview

This enhancement adds critical reliability and error recovery features to the WhatsApp webhook processing pipeline:

- **Idempotency Tracking**: Duplicate message detection using `processed_webhook_messages` table
- **Dead Letter Queue (DLQ)**: Failed messages captured for retry and analysis
- **Distributed Locking**: Conversation-level locks prevent race conditions
- **AI Agent Orchestration**: Context-aware AI agent management
- **Monitoring & Observability**: Real-time health checks and metrics
- **Timeout Protection**: Automatic timeout handling for long-running operations

## Architecture

### Database Schema

**New Tables Created:**
- `webhook_conversations` - Tracks conversation state and locking
- `processed_webhook_messages` - Idempotency tracking
- `webhook_dlq` - Dead letter queue for failed messages
- `agent_contexts` - AI agent conversation memory
- `agent_sessions` - AI agent session tracking
- `conversation_state_transitions` - Audit trail for state changes

**Monitoring Views:**
- `webhook_conversation_health` - Overall health metrics
- `stuck_webhook_conversations` - Detect conversations needing intervention
- `webhook_agent_performance` - AI agent performance stats
- `webhook_message_processing_metrics` - Processing time percentiles
- `webhook_dlq_summary` - DLQ status overview

**Helper Functions:**
- `acquire_conversation_lock()` - Acquire distributed lock
- `release_conversation_lock()` - Release distributed lock
- `cleanup_stuck_webhook_conversations()` - Cleanup job
- `check_webhook_system_health()` - Health check endpoint
- `get_webhook_performance_stats()` - Performance metrics

### Shared Utilities

**`_shared/webhook-utils.ts`**
Core webhook processing utilities:
- Idempotency checking
- Lock management
- DLQ operations
- Timeout handling
- Conversation state management

**`_shared/ai-agent-orchestrator.ts`**
AI agent management:
- Context loading and saving
- Token limit management
- Context truncation (sliding window)
- Retry logic with exponential backoff
- Session metrics

**`router/enhanced_processor.ts`**
Enhanced webhook processor with feature flag:
- Wraps existing processor
- Adds DLQ, locking, timeout protection
- Backward compatible (disabled by default)

## Migration Guide

### Step 1: Apply Database Migrations

```bash
# Apply the schema migrations
supabase db push

# Verify migrations applied successfully
psql $DATABASE_URL -c "SELECT * FROM webhook_conversation_health;"
```

### Step 2: Enable Enhanced Processing (Optional)

The enhanced processing is **disabled by default** to ensure zero breaking changes.

To enable:

```bash
# Set in Supabase Edge Function environment variables
WA_ENHANCED_PROCESSING=true
```

This can be enabled gradually:
1. Test in development first
2. Enable for a subset of users (via routing)
3. Monitor metrics before full rollout

### Step 3: Monitor Health

```sql
-- Check system health
SELECT * FROM check_webhook_system_health();

-- View processing metrics
SELECT * FROM get_webhook_performance_stats(24);

-- Check for stuck conversations
SELECT * FROM stuck_webhook_conversations;

-- View DLQ status
SELECT * FROM webhook_dlq_summary;
```

### Step 4: Set Up Cleanup Job (Recommended)

The migration includes a cleanup function. Schedule it with pg_cron:

```sql
-- Already included in migration, but verify:
SELECT * FROM cron.job 
WHERE jobname = 'cleanup-stuck-conversations';

-- Manual cleanup if needed:
SELECT cleanup_stuck_webhook_conversations();
```

## Usage Examples

### Check Idempotency

```typescript
import { checkIdempotency } from "../_shared/webhook-utils.ts";

const alreadyProcessed = await checkIdempotency(
  supabase,
  whatsappMessageId,
  correlationId
);

if (alreadyProcessed) {
  return new Response("Already processed", { status: 200 });
}
```

### Acquire Conversation Lock

```typescript
import { acquireConversationLock, releaseConversationLock } from "../_shared/webhook-utils.ts";

const lockId = crypto.randomUUID();
const locked = await acquireConversationLock(
  supabase,
  conversationId,
  lockId,
  correlationId
);

if (!locked) {
  // Another process is handling this conversation
  await queueForRetry(message);
  return;
}

try {
  // Process message
  await processMessage(message);
} finally {
  // Always release lock
  await releaseConversationLock(supabase, conversationId, lockId, correlationId);
}
```

### Use AI Agent Orchestrator

```typescript
import { AIAgentOrchestrator } from "../_shared/ai-agent-orchestrator.ts";

const orchestrator = new AIAgentOrchestrator(supabase, correlationId);

const result = await orchestrator.processMessage(
  conversationId,
  userMessage,
  'job_board' // agent type
);

console.log(result.response); // AI response
```

### Add to Dead Letter Queue

```typescript
import { addToDeadLetterQueue } from "../_shared/webhook-utils.ts";

try {
  await processMessage(message);
} catch (error) {
  await addToDeadLetterQueue(
    supabase,
    message,
    error,
    messageId,
    correlationId,
    retryCount
  );
}
```

## Monitoring Dashboard

### Key Metrics to Monitor

1. **Processing Health**
   ```sql
   SELECT * FROM webhook_conversation_health;
   ```
   - Watch for high `error_count`
   - Monitor `locked_count` for lock contention

2. **Stuck Conversations**
   ```sql
   SELECT COUNT(*) FROM stuck_webhook_conversations;
   ```
   - Alert if count > 5

3. **DLQ Buildup**
   ```sql
   SELECT COUNT(*) FROM webhook_dlq WHERE resolution_status = 'pending';
   ```
   - Alert if count > 10

4. **Processing Latency**
   ```sql
   SELECT avg_processing_ms, p95_processing_ms, p99_processing_ms
   FROM webhook_message_processing_metrics
   ORDER BY hour DESC
   LIMIT 1;
   ```
   - Alert if p95 > 2000ms

### Health Check Endpoint

```bash
# Check webhook health
curl https://your-project.supabase.co/functions/v1/wa-webhook/health

# View metrics
curl https://your-project.supabase.co/functions/v1/wa-webhook/metrics

# Prometheus format
curl -H "Accept: text/plain" \
  https://your-project.supabase.co/functions/v1/wa-webhook/metrics
```

## Performance Considerations

### Database Indexes

All high-traffic queries have indexes:
- `webhook_conversations(user_id, status, updated_at)`
- `processed_webhook_messages(whatsapp_message_id)`
- `webhook_dlq(next_retry_at, resolution_status)`
- Partial indexes for active conversations

### Lock Timeout

Locks auto-expire after 2 minutes to prevent permanent deadlocks.

### Context Truncation

AI agent contexts are automatically truncated to fit token limits (default 4000 tokens).

### Cleanup Job

Stuck conversations are automatically cleaned up every 5 minutes.

## Troubleshooting

### Issue: Messages Not Being Processed

1. Check idempotency table:
   ```sql
   SELECT * FROM processed_webhook_messages 
   WHERE whatsapp_message_id = 'YOUR_MESSAGE_ID';
   ```

2. Check if message is in DLQ:
   ```sql
   SELECT * FROM webhook_dlq 
   WHERE whatsapp_message_id = 'YOUR_MESSAGE_ID';
   ```

### Issue: Conversations Stuck in Processing

1. Check for stale locks:
   ```sql
   SELECT * FROM webhook_conversations 
   WHERE locked_at < NOW() - INTERVAL '2 minutes';
   ```

2. Manually clean up:
   ```sql
   SELECT cleanup_stuck_webhook_conversations();
   ```

### Issue: High DLQ Count

1. Check error patterns:
   ```sql
   SELECT error, COUNT(*) 
   FROM webhook_dlq 
   GROUP BY error 
   ORDER BY COUNT(*) DESC;
   ```

2. Manually retry messages:
   ```sql
   -- Update next_retry_at to trigger immediate retry
   UPDATE webhook_dlq 
   SET next_retry_at = NOW()
   WHERE resolution_status = 'pending';
   ```

## Rollback Plan

If issues occur, disable enhanced processing:

```bash
# Disable in Supabase environment variables
WA_ENHANCED_PROCESSING=false
```

The system will immediately fall back to the original processor. No data loss occurs.

To fully rollback migrations (not recommended):

```sql
-- Drop new tables (WARNING: loses data)
DROP TABLE IF EXISTS conversation_state_transitions CASCADE;
DROP TABLE IF EXISTS agent_sessions CASCADE;
DROP TABLE IF EXISTS agent_contexts CASCADE;
DROP TABLE IF EXISTS processed_webhook_messages CASCADE;
DROP TABLE IF EXISTS webhook_dlq CASCADE;
DROP TABLE IF EXISTS webhook_conversations CASCADE;

-- Drop views
DROP VIEW IF EXISTS webhook_conversation_health;
DROP VIEW IF EXISTS stuck_webhook_conversations;
DROP VIEW IF EXISTS webhook_agent_performance;
DROP VIEW IF EXISTS webhook_message_processing_metrics;
DROP VIEW IF EXISTS webhook_dlq_summary;
```

## Future Enhancements

### Planned Features
- [ ] Automatic DLQ retry worker
- [ ] Kafka integration for async processing
- [ ] Circuit breaker for external services
- [ ] Real-time alerting via webhooks
- [ ] AI agent A/B testing framework
- [ ] Conversation analytics dashboard

### AI Agent Integration

The AI Agent Orchestrator is ready to use but needs AI service integration:

```typescript
// In _shared/ai-agent-orchestrator.ts, update callAIService():
private async callAIService(
  message: string,
  context: ConversationContext,
  config: AgentConfig
): Promise<string> {
  // Replace with actual AI provider (OpenAI, Anthropic, etc.)
  const response = await fetch('YOUR_AI_ENDPOINT', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('AI_API_KEY')}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: config.systemPrompt },
        ...context.messages,
        { role: 'user', content: message }
      ],
      max_tokens: config.maxTokens,
      temperature: config.temperature
    })
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}
```

## Ground Rules Compliance

✅ **Observability**: All functions use structured logging with correlation IDs
✅ **Security**: RLS policies on all tables, no secrets in client vars
✅ **Error Handling**: Graceful degradation with DLQ
✅ **Performance**: Indexes on all high-traffic queries
✅ **Testing**: Feature flags allow gradual rollout
✅ **Monitoring**: Health check views and functions
✅ **Audit Trail**: State transitions fully logged

## Support

For issues or questions:
1. Check monitoring views for system health
2. Review Supabase logs with correlation ID
3. Check DLQ for failed messages
4. Review docs/GROUND_RULES.md for coding standards
