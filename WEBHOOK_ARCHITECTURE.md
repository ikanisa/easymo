# WhatsApp Webhook Enhancement - Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    WhatsApp Cloud API                            │
│                    (Incoming Messages)                           │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase Edge Function: wa-webhook                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  index.ts (Main Handler)                                  │  │
│  │  - Correlation ID generation                              │  │
│  │  - Health check endpoints                                 │  │
│  │  - Metrics endpoints                                      │  │
│  └────────────┬──────────────────────────────────────────────┘  │
│               │                                                   │
│               ▼                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  router/pipeline.ts (Request Processing)                  │  │
│  │  - Signature verification                                 │  │
│  │  - Rate limiting                                          │  │
│  │  - Payload validation                                     │  │
│  └────────────┬──────────────────────────────────────────────┘  │
│               │                                                   │
│               ▼                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Feature Flag: WA_ENHANCED_PROCESSING                     │  │
│  │  ┌─────────────────┐         ┌────────────────────────┐  │  │
│  │  │ Original Flow   │  OR     │ Enhanced Flow (NEW)    │  │  │
│  │  │ processor.ts    │         │ enhanced_processor.ts  │  │  │
│  │  └─────────────────┘         └────────────┬───────────┘  │  │
│  └──────────────────────────────────────────┼──────────────┘  │
└──────────────────────────────────────────────┼─────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Enhanced Processing Pipeline (NEW)                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  1. Idempotency Check                                     │  │
│  │     - Query: processed_webhook_messages                   │  │
│  │     - Return if duplicate                                 │  │
│  └────────────┬──────────────────────────────────────────────┘  │
│               ▼                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  2. Get/Create Conversation                               │  │
│  │     - Query: webhook_conversations                        │  │
│  │     - Create if new                                       │  │
│  └────────────┬──────────────────────────────────────────────┘  │
│               ▼                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  3. Acquire Distributed Lock                              │  │
│  │     - Call: acquire_conversation_lock()                   │  │
│  │     - If locked: Send to DLQ for retry                    │  │
│  └────────────┬──────────────────────────────────────────────┘  │
│               ▼                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  4. Process with Timeout Protection                       │  │
│  │     - Promise.race with 10s timeout                       │  │
│  │     - Route to appropriate handler                        │  │
│  │       ├─ Mobility (wa-webhook-mobility)                   │  │
│  │       ├─ Jobs (wa-webhook-jobs)                           │  │
│  │       ├─ Property (wa-webhook-property)                   │  │
│  │       ├─ Marketplace (wa-webhook-marketplace)             │  │
│  │       ├─ Wallet (wa-webhook-wallet)                       │  │
│  │       └─ AI Agents (wa-webhook-ai-agents)                 │  │
│  └────────────┬──────────────────────────────────────────────┘  │
│               │                                                   │
│        Success│                              Error                │
│               ▼                                   ▼               │
│  ┌──────────────────────────┐      ┌─────────────────────────┐  │
│  │  5a. Record Success      │      │  5b. Add to DLQ         │  │
│  │  - processed_webhook_    │      │  - webhook_dlq          │  │
│  │    messages              │      │  - Retry schedule       │  │
│  │  - Update state          │      │  - Exponential backoff  │  │
│  └──────────┬───────────────┘      └─────────────────────────┘  │
│             │                                                     │
│             ▼                                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  6. Release Lock                                          │  │
│  │     - Call: release_conversation_lock()                   │  │
│  │     - Update last_activity_at                             │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Database Layer (Supabase)                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  State Management Tables                                  │  │
│  │  ├─ webhook_conversations (with locking columns)         │  │
│  │  ├─ processed_webhook_messages (idempotency)             │  │
│  │  ├─ webhook_dlq (failed messages)                        │  │
│  │  └─ conversation_state_transitions (audit)               │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  AI Agent Tables                                          │  │
│  │  ├─ agent_contexts (conversation memory)                 │  │
│  │  └─ agent_sessions (session tracking)                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Monitoring Views                                         │  │
│  │  ├─ webhook_conversation_health                          │  │
│  │  ├─ stuck_webhook_conversations                          │  │
│  │  ├─ webhook_agent_performance                            │  │
│  │  ├─ webhook_message_processing_metrics                   │  │
│  │  └─ webhook_dlq_summary                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Helper Functions                                         │  │
│  │  ├─ acquire_conversation_lock()                          │  │
│  │  ├─ release_conversation_lock()                          │  │
│  │  ├─ cleanup_stuck_webhook_conversations() [pg_cron]      │  │
│  │  ├─ check_webhook_system_health()                        │  │
│  │  └─ get_webhook_performance_stats()                      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              AI Agent Orchestrator (Optional)                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ai-agent-orchestrator.ts                                 │  │
│  │  1. Load context from agent_contexts                      │  │
│  │  2. Truncate if over token limit (4000 default)           │  │
│  │  3. Call AI service with retry (3 attempts)               │  │
│  │  4. Save updated context                                  │  │
│  │  5. Update session metrics                                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Background Jobs (pg_cron)                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Every 5 minutes:                                         │  │
│  │  - cleanup_stuck_webhook_conversations()                  │  │
│  │    - Release locks older than 2 minutes                   │  │
│  │    - Mark conversations as 'timeout' after 5 minutes      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Example

### Happy Path (No Errors)
```
1. WhatsApp → wa-webhook → Enhanced Processor
2. Check idempotency → Not duplicate
3. Get conversation → Found or created
4. Acquire lock → Success
5. Process message → Success (150ms)
6. Record processed message
7. Release lock
8. Return 200 OK
```

### Error Path (With Recovery)
```
1. WhatsApp → wa-webhook → Enhanced Processor
2. Check idempotency → Not duplicate
3. Get conversation → Found or created
4. Acquire lock → Success
5. Process message → Timeout (> 10s)
6. Add to DLQ with retry_count=0, next_retry_at=NOW()+1min
7. Release lock
8. Return 500 Error
9. [After 1 minute] DLQ worker retries → Success
10. Update resolution_status='resolved'
```

### Duplicate Message (Idempotency)
```
1. WhatsApp → wa-webhook → Enhanced Processor
2. Check idempotency → Already processed
3. Return 200 OK (skip processing)
```

### Lock Contention (Race Condition)
```
1. WhatsApp → wa-webhook → Enhanced Processor
2. Check idempotency → Not duplicate
3. Get conversation → Found
4. Acquire lock → Failed (another process has lock)
5. Add to DLQ with next_retry_at=NOW()+30s
6. Return 202 Accepted
7. [After 30s] Lock released → Retry succeeds
```

## Monitoring Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Dashboard  │────▶│  Monitoring      │◀───▶│  Alerting   │
│  (Grafana)  │     │  Views & Funcs   │     │  (Webhooks) │
└─────────────┘     └──────────────────┘     └─────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Health Checks  │
                    │  - Stuck convos │
                    │  - High errors  │
                    │  - DLQ buildup  │
                    │  - Stale locks  │
                    └─────────────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────┐
│  1. Edge Function Authentication            │
│     - WhatsApp signature verification        │
│     - Supabase service role key              │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│  2. Row Level Security (RLS)                │
│     - Enabled on all 6 new tables           │
│     - Service role bypass for edge funcs    │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│  3. Audit Trail                             │
│     - conversation_state_transitions        │
│     - All state changes logged              │
└─────────────────────────────────────────────┘
```

## Feature Flag Architecture

```
┌──────────────────────────────────────────────┐
│  Environment Variable                        │
│  WA_ENHANCED_PROCESSING=true/false           │
└─────────────────┬────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌─────────────┐     ┌─────────────────┐
│  Original   │     │  Enhanced       │
│  Processor  │     │  Processor      │
│  (Stable)   │     │  (New)          │
└─────────────┘     └─────────────────┘

Rollout Strategy:
1. Disabled (default) → 0% traffic
2. Test users only → ~1% traffic
3. Gradual rollout → 10% → 50% → 100%
4. Monitor at each step
5. Rollback if issues (instant)
```

## Performance Characteristics

```
┌─────────────────────────────────────────────┐
│  Latency Breakdown (Enhanced Processing)    │
├─────────────────────────────────────────────┤
│  Idempotency Check:     ~5ms                │
│  Lock Acquisition:      ~10ms               │
│  Message Processing:    ~100ms (varies)     │
│  State Update:          ~10ms               │
│  Lock Release:          ~5ms                │
├─────────────────────────────────────────────┤
│  Total Overhead:        ~30ms               │
│  Original Processing:   ~100ms              │
│  Enhanced Processing:   ~130ms              │
└─────────────────────────────────────────────┘
```

---

**Legend:**
- `┌─┐` = Component boundary
- `→` = Data flow
- `◀─▶` = Bidirectional
- `├─` = Sub-component
- `▼` = Sequential flow
