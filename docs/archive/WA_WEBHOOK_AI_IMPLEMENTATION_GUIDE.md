# WA-Webhook AI Agent Enhancement Implementation Guide

**Version**: 2.0.0  
**Date**: 2025-11-13  
**Status**: READY FOR IMPLEMENTATION

## Overview

This guide provides step-by-step instructions for implementing the enhanced AI agent system in the
wa-webhook edge function. All enhancements are **additive-only** and respect the existing codebase.

## Prerequisites

### Required Environment Variables

```bash
# OpenAI (Required)
OPENAI_API_KEY=sk-...

# External Tool APIs (Optional but Recommended)
TAVILY_API_KEY=tvly-...              # For web search
PERPLEXITY_API_KEY=pplx-...          # For deep research
OPENWEATHER_API_KEY=...              # For weather
EXCHANGERATE_API_KEY=...             # For currency (optional, has fallback)

# Feature Flags
AI_AGENTS_ENABLED=true               # Master switch
LOG_LEVEL=info                       # debug, info, warn, error
```

### Database Requirements

1. PostgreSQL with `pgvector` extension
2. Supabase project with service role access
3. Applied migration: `20251113000000_ai_agent_enhanced_infrastructure.sql`

## Implementation Steps

### Step 1: Apply Database Migration

```bash
cd supabase
supabase db push --include-all
```

**Verify**:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name LIKE 'agent_%';

-- Should return:
-- agent_configurations
-- agent_conversations
-- agent_messages
-- agent_embeddings
-- agent_metrics
-- agent_tool_executions
```

### Step 2: Verify New Files

Check that all new files are in place:

```bash
cd supabase/functions/wa-webhook/shared

# Core enhancements
ls -la connection_pool.ts          # NEW: Database connection pooling
ls -la advanced_rate_limiter.ts    # NEW: Advanced rate limiting
ls -la enhanced_tools.ts            # NEW: External API tools
ls -la ai_agent_config.ts          # NEW: Centralized configuration

# Enhanced existing files (check for new methods)
ls -la memory_manager.ts           # ENHANCED: Vector embeddings
ls -la agent_context.ts            # EXISTING: Context building
ls -la openai_client.ts            # EXISTING: OpenAI integration
ls -la tool_manager.ts             # EXISTING: Tool execution
```

### Step 3: Update Tool Manager

The tool manager needs to register enhanced tools:

```typescript
// In shared/tool_manager.ts, add after constructor:

import { registerEnhancedTools } from "./enhanced_tools.ts";

constructor() {
  this.registerBuiltinTools();

  // Register enhanced external API tools
  registerEnhancedTools((tool) => this.registerTool(tool));
}
```

### Step 4: Integrate Connection Pooling

Update router/processor.ts to use connection pooling:

```typescript
// At the top of the file
import { withPooledConnection, getConnectionPool } from "../shared/connection_pool.ts";

// Replace direct supabase calls with pooled connections
// Example:
const result = await withPooledConnection(async (client) => {
  return await client.from("users").select("*").eq("id", userId).single();
});

// Check pool health in health endpoint
const poolStats = getConnectionPool().getStats();
```

### Step 5: Enable Advanced Rate Limiting

Update router/ai_agent_handler.ts to use advanced rate limiter:

```typescript
// At the top
import { getRateLimiter } from "../shared/advanced_rate_limiter.ts";

// Replace existing rate limiter
const rateLimiter = getRateLimiter();

// In tryAIAgentHandler function
const rateLimitResult = await rateLimiter.checkLimit(msg.from, correlationId);

if (!rateLimitResult.allowed) {
  await logStructuredEvent("RATE_LIMIT_BLOCKED", {
    correlation_id: correlationId,
    phone_number: msg.from,
    blacklisted: rateLimitResult.blacklisted,
    retry_after: rateLimitResult.retryAfter,
  });

  // Send rate limit message to user
  await sendText(
    ctx.supabase,
    msg.from,
    rateLimitResult.blacklisted
      ? "Your account has been temporarily suspended due to excessive requests. Please try again later."
      : `Too many requests. Please wait ${rateLimitResult.retryAfter} seconds.`
  );

  return true; // Handled
}
```

### Step 6: Enhance Memory with Embeddings

Update the AI agent handler to use enhanced memory:

```typescript
// In router/ai_agent_handler.ts, in prepareMessagesWithHistory function

// After getting conversation history
const messages = await memory.getConversationHistory(phoneNumber, 10);

// Get relevant memories from long-term storage
const relevantMemories = await memory.retrieveRelevantMemories(
  context.currentMessage,
  5, // top 5 results
  0.7, // similarity threshold
  context.correlationId
);

if (relevantMemories.length > 0) {
  const memoryContext = relevantMemories
    .map((m) => `[Memory: ${m.similarity.toFixed(2)}] ${m.content}`)
    .join("\n");

  messages.unshift({
    role: "system",
    content: `Relevant context from past interactions:\n${memoryContext}`,
  });
}

// After successful interaction, extract and store important info
const extracted = await memory.extractImportantInfo(
  [
    { role: "user", content: context.currentMessage },
    { role: "assistant", content: response.text },
  ],
  context.correlationId
);

// Store important facts in long-term memory
for (const fact of extracted.facts) {
  await memory.saveLongTermMemory(fact, {
    phone_number: context.phoneNumber,
    type: "fact",
    conversation_id: agentContext.conversationId,
  });
}

for (const preference of extracted.preferences) {
  await memory.saveLongTermMemory(preference, {
    phone_number: context.phoneNumber,
    type: "preference",
    conversation_id: agentContext.conversationId,
  });
}
```

### Step 7: Add Monitoring and Metrics

Create a metrics collection function:

```typescript
// In router/ai_agent_handler.ts

async function recordAgentMetrics(
  supabase: SupabaseClient,
  agentType: string,
  conversationId: string,
  response: any,
  latencyMs: number,
  success: boolean,
  error?: string
): Promise<void> {
  try {
    await supabase.from("agent_metrics").insert({
      agent_type: agentType,
      conversation_id: conversationId,
      tokens_prompt: response.usage?.prompt_tokens || 0,
      tokens_completion: response.usage?.completion_tokens || 0,
      tokens_total: response.usage?.total_tokens || 0,
      cost_usd: response.cost_usd || 0,
      latency_ms: latencyMs,
      llm_latency_ms: response.llm_latency_ms,
      tool_execution_ms: response.tool_execution_ms,
      success,
      error_message: error,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to record agent metrics:", error);
  }
}

// Call after each agent interaction
await recordAgentMetrics(
  ctx.supabase,
  agentType,
  agentContext.conversationId,
  response,
  Date.now() - startTime,
  true
);
```

### Step 8: Add Health Check Endpoint

Update index.ts to include health check:

```typescript
import { getConnectionPool } from "./shared/connection_pool.ts";
import { getRateLimiter } from "./shared/advanced_rate_limiter.ts";
import { getOpenAIClient } from "./shared/openai_client.ts";

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  // Health check endpoint
  if (url.pathname === "/health" && req.method === "GET") {
    const pool = getConnectionPool();
    const rateLimiter = getRateLimiter();

    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "2.0.0",
      checks: {
        database: {
          healthy: pool.isHealthy(),
          stats: pool.getStats(),
        },
        rateLimiter: {
          healthy: rateLimiter.isHealthy(),
          stats: rateLimiter.getStats(),
        },
        openai: {
          configured: !!Deno.env.get("OPENAI_API_KEY"),
        },
        tools: {
          webSearch: !!Deno.env.get("TAVILY_API_KEY"),
          deepResearch: !!Deno.env.get("PERPLEXITY_API_KEY"),
          weather: !!Deno.env.get("OPENWEATHER_API_KEY"),
        },
      },
    };

    const allHealthy = Object.values(health.checks).every((check) =>
      typeof check === "object" ? check.healthy !== false : check
    );

    return new Response(JSON.stringify(health, null, 2), {
      status: allHealthy ? 200 : 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Existing webhook processing
  const cid = crypto.randomUUID();
  try {
    const result = await processWebhookRequest(req);

    if (result.type === "response") {
      return result.response;
    }

    return await handlePreparedWebhook(supabase, result);
  } catch (err) {
    console.error("wa_webhook.unhandled", { cid, error: String(err) });
    return new Response("ok", { status: 200 });
  }
});
```

## Testing

### Test 1: Health Check

```bash
curl https://your-project.supabase.co/functions/v1/wa-webhook/health
```

Expected response:

```json
{
  "status": "healthy",
  "version": "2.0.0",
  "checks": {
    "database": { "healthy": true },
    "rateLimiter": { "healthy": true },
    "openai": { "configured": true },
    "tools": {
      "webSearch": true,
      "deepResearch": false,
      "weather": false
    }
  }
}
```

### Test 2: Basic AI Interaction

Send a WhatsApp message: "Hi, how can I check my balance?"

Expected flow:

1. Message received → Pipeline → Processor
2. AI Agent Handler checks eligibility → TRUE
3. Feature flag check → ENABLED
4. Rate limit check → PASSED
5. Build agent context → SUCCESS
6. Check memory for relevant context
7. Call OpenAI with tools
8. Execute tool if needed
9. Return response
10. Save interaction and metrics

### Test 3: Tool Execution

Send: "What's the weather in Kigali?"

Expected:

1. AI agent recognizes weather query
2. Calls `get_weather` tool
3. Tool executes (requires OPENWEATHER_API_KEY)
4. Returns weather information
5. AI formats response
6. User receives: "The weather in Kigali is currently 22°C with partly cloudy skies."

### Test 4: Web Search

Send: "What are the latest news about Rwanda?"

Expected:

1. AI agent recognizes information need
2. Calls `web_search` tool (requires TAVILY_API_KEY)
3. Tool searches web
4. Returns top results
5. AI summarizes findings
6. User receives concise answer with sources

### Test 5: Rate Limiting

Send 150 requests in 1 minute from same number:

Expected:

1. First 100 requests: Processed normally
2. Requests 101-110: Rate limited, returns retry-after
3. Request 111+: Blacklisted for 1 hour

### Test 6: Memory Recall

Conversation:

1. User: "I prefer traveling in the morning"
2. AI: "Noted! You prefer morning trips."
3. (10 minutes later)
4. User: "Show me trips to Musanze"
5. AI: "I see you prefer morning travel. Here are morning trips to Musanze..."

Expected: AI recalls preference from earlier in conversation using memory.

## Monitoring

### Key Metrics to Track

1. **Performance Metrics**

   ```sql
   SELECT * FROM agent_performance_analytics
   WHERE time_bucket > NOW() - INTERVAL '24 hours'
   ORDER BY time_bucket DESC;
   ```

2. **Tool Usage**

   ```sql
   SELECT * FROM tool_usage_analytics
   WHERE time_bucket > NOW() - INTERVAL '24 hours'
   ORDER BY total_executions DESC;
   ```

3. **Cost Tracking**

   ```sql
   SELECT
     agent_type,
     DATE(created_at) as date,
     SUM(cost_usd) as daily_cost,
     AVG(tokens_total) as avg_tokens,
     COUNT(*) as request_count
   FROM agent_metrics
   WHERE created_at > NOW() - INTERVAL '7 days'
   GROUP BY agent_type, DATE(created_at)
   ORDER BY date DESC, agent_type;
   ```

4. **Error Rates**
   ```sql
   SELECT
     agent_type,
     COUNT(*) as total,
     COUNT(*) FILTER (WHERE success = true) as successful,
     COUNT(*) FILTER (WHERE success = false) as failed,
     ROUND(100.0 * COUNT(*) FILTER (WHERE success = false) / COUNT(*), 2) as error_rate_pct
   FROM agent_metrics
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY agent_type;
   ```

## Rollback Plan

If issues arise:

### Immediate Rollback

```bash
# Disable AI agents via feature flag
UPDATE feature_flags
SET enabled = false
WHERE flag_name = 'ai_agents_enabled';
```

### Full Rollback

```sql
BEGIN;

-- Drop new tables (data will be lost!)
DROP TABLE IF EXISTS agent_tool_executions CASCADE;
DROP TABLE IF EXISTS agent_metrics CASCADE;
DROP TABLE IF EXISTS agent_embeddings CASCADE;
DROP TABLE IF EXISTS agent_messages CASCADE;
DROP TABLE IF EXISTS agent_conversations CASCADE;
DROP TABLE IF EXISTS agent_configurations CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS match_agent_embeddings CASCADE;
DROP FUNCTION IF EXISTS update_agent_updated_at CASCADE;

-- Drop views
DROP VIEW IF EXISTS agent_performance_analytics CASCADE;
DROP VIEW IF EXISTS tool_usage_analytics CASCADE;

COMMIT;
```

## Troubleshooting

### Issue: "Connection pool timeout"

**Solution**: Increase pool size or maxSize in config

```typescript
connectionPool: {
  maxSize: 30, // Increase from 20
}
```

### Issue: "Rate limit blacklist too aggressive"

**Solution**: Adjust thresholds

```typescript
rateLimit: {
  blacklistThreshold: 20, // Increase from 10
  windowMs: 120000, // Increase to 2 minutes
}
```

### Issue: "OpenAI API errors"

**Solution**: Check API key, implement fallback

```typescript
model: {
  defaultModel: "gpt-4o-mini",
  fallbackModel: "gpt-3.5-turbo", // Fallback on errors
}
```

### Issue: "Memory search returns no results"

**Solution**: Check embedding generation and vector index

```sql
-- Verify embeddings exist
SELECT COUNT(*) FROM agent_embeddings;

-- Check vector index
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'agent_embeddings';

-- Rebuild if needed
REINDEX INDEX idx_agent_embeddings_vector;
```

## Performance Optimization

### 1. Cache Frequently Used Data

```typescript
// Cache user profiles
const profile = await cache.getOrSet(
  `profile:${phoneNumber}`,
  async () => await fetchUserProfile(phoneNumber),
  600 // 10 minutes
);
```

### 2. Batch Database Operations

```typescript
// Instead of multiple inserts
await Promise.all([saveMetric1(), saveMetric2(), saveMetric3()]);
```

### 3. Limit Token Usage

```typescript
// Truncate long conversations
const recentMessages = conversationHistory.slice(-10);
```

### 4. Use Streaming for Long Responses

```typescript
// Implement streaming for better UX
const stream = openai.streamChat({...});
for await (const chunk of stream) {
  // Send partial updates
}
```

## Security Checklist

- [ ] All API keys stored in environment variables
- [ ] Webhook signature verification enabled
- [ ] Rate limiting active and tested
- [ ] PII masking in logs
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (using parameterized queries)
- [ ] CORS properly configured
- [ ] Error messages don't leak sensitive info
- [ ] Blacklist mechanism tested
- [ ] Connection pool properly configured

## Success Criteria

- [ ] All health checks pass
- [ ] Response time < 2s (p95)
- [ ] Error rate < 1%
- [ ] Tool execution success > 95%
- [ ] Memory recall working
- [ ] Rate limiting effective
- [ ] Cost per conversation < $0.01
- [ ] User satisfaction > 4.5/5

## Next Steps

After successful deployment:

1. **Monitor for 48 hours** - Watch metrics, errors, costs
2. **Collect user feedback** - Are responses helpful?
3. **Optimize prompts** - Improve based on real interactions
4. **Add more tools** - Based on user needs
5. **Fine-tune parameters** - Adjust temperature, max_tokens, etc.
6. **Scale gradually** - Increase user base incrementally
7. **Document learnings** - Keep implementation notes updated

## Support

For issues or questions:

- Review logs: Check structured events in Supabase logs
- Check metrics: Query agent_metrics and agent_performance_analytics
- Test tools: Use health endpoint to verify configuration
- Review code: All enhancements are in `shared/` directory

---

**Implementation Status**: ✅ READY  
**Estimated Time**: 2-4 hours  
**Risk Level**: LOW (additive-only, feature-flagged)
