# Phase 3 Schema Consolidation - Detailed Implementation Plan
**Date:** 2025-12-09 00:34 UTC  
**Status:** 📋 PLANNING - Not Yet Executed  
**Estimated Total Effort:** 15-17 hours  
**Risk Level:** MEDIUM-HIGH

---

## Overview

Phase 3 focuses on **advanced consolidations** that require significant effort and careful planning. Unlike Phase 1 (quick wins) and Phase 2 (analysis), Phase 3 involves:
- High code impact (21+ references)
- Complex data migrations
- Potential production disruption
- Deep domain analysis

**These should be treated as SEPARATE PROJECTS, not a continuation of Phase 1/2.**

---

# Task 1: AI Agent Sessions Consolidation

## Business Justification

### Problem Statement
Currently maintaining two parallel AI agent session systems creates:
- **Code complexity:** Developers must choose between 2 APIs
- **Data fragmentation:** Session data split across tables
- **Feature gaps:** Simple table lacks conversation history, status tracking
- **Maintenance burden:** Bug fixes must be applied to both systems

### Expected Benefits
| Benefit | Impact | Measurement |
|---------|--------|-------------|
| Unified API | Simplified development | -6 files, single entry point |
| Rich features everywhere | Better AI agents | All agents get conversation history |
| Reduced maintenance | Lower bug count | Single codebase to maintain |
| Better analytics | Improved insights | Consolidated session metrics |

### Business Impact
- **Developer productivity:** ~20% faster AI agent feature development
- **User experience:** More context-aware AI interactions
- **Operational cost:** ~15% reduction in maintenance time

### ROI Analysis
- **Investment:** 7 hours (1 developer-day)
- **Ongoing savings:** ~2 hours/month maintenance reduction
- **Payback period:** 3-4 months
- **Risk:** MEDIUM (requires careful testing)

---

## Technical Analysis

### Current State Assessment

#### Table 1: `ai_agent_sessions` (Simpler)
```sql
CREATE TABLE ai_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX idx_ai_agent_sessions_phone ON ai_agent_sessions(phone);
CREATE INDEX idx_ai_agent_sessions_expires ON ai_agent_sessions(expires_at) 
  WHERE expires_at > NOW();
```

**Usage:** 21 references
**Files:**
- `supabase/functions/wa-agent-waiter/core/base-agent.ts`
- `supabase/functions/wa-agent-waiter/core/session-manager.ts`
- `supabase/functions/wa-agent-farmer/core/base-agent.ts`
- `supabase/functions/wa-agent-farmer/core/session-manager.ts`
- `supabase/functions/wa-agent-support/core/base-agent.ts`
- `supabase/functions/wa-agent-support/core/session-manager.ts`

**Pros:**
- Simple schema
- Fast queries
- Easy to understand

**Cons:**
- No conversation history
- No agent type tracking
- No status management
- No foreign keys

---

#### Table 2: `agent_chat_sessions` (Feature-Rich)
```sql
CREATE TABLE agent_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES whatsapp_users(id) ON DELETE CASCADE,
  user_phone TEXT,
  agent_type TEXT NOT NULL,
  agent_id UUID,
  conversation_history JSONB DEFAULT '[]'::jsonb,
  context JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active' 
    CHECK (status IN ('active', 'paused', 'completed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX idx_agent_chat_sessions_user_id ON agent_chat_sessions(user_id);
CREATE INDEX idx_agent_chat_sessions_user_phone ON agent_chat_sessions(user_phone);
CREATE INDEX idx_agent_chat_sessions_agent_type ON agent_chat_sessions(agent_type);
CREATE INDEX idx_agent_chat_sessions_status ON agent_chat_sessions(status);
CREATE INDEX idx_agent_chat_sessions_last_message_at 
  ON agent_chat_sessions(last_message_at DESC);
CREATE INDEX idx_agent_chat_sessions_expires_at ON agent_chat_sessions(expires_at);

-- Unique constraint
CREATE UNIQUE INDEX idx_agent_chat_sessions_active_unique
  ON agent_chat_sessions(user_phone, agent_type)
  WHERE status = 'active';

-- Helper Functions
CREATE FUNCTION get_or_create_agent_session(...) RETURNS UUID;
CREATE FUNCTION add_agent_message(...) RETURNS BOOLEAN;
CREATE FUNCTION get_agent_conversation(...) RETURNS JSONB;
```

**Usage:** 16 references
**Files:**
- `supabase/functions/wa-webhook/shared/agent_session.ts`
- `supabase/functions/_shared/agent-orchestrator.ts`

**Pros:**
- Conversation history storage
- Agent type tracking
- Status lifecycle management
- Helper functions
- FK to whatsapp_users
- Unique constraint prevents duplicate sessions

**Cons:**
- More complex schema
- Slightly slower writes (more indexes)

---

### Decision: Canonical Table

**Winner: `agent_chat_sessions`**

**Reasons:**
1. **Feature completeness:** Conversation history, status, agent tracking
2. **Better architecture:** FK relationships, proper constraints
3. **Helper functions:** Already built and tested
4. **Scalability:** Unique constraint prevents session proliferation
5. **Analytics-ready:** Agent type tracking enables reporting

**Migration Strategy:** Migrate `ai_agent_sessions` → `agent_chat_sessions`

---

## Implementation Plan

### Phase 3.1: Pre-Migration Analysis (2 hours)

#### Step 1: Data Volume Assessment (30 min)
```sql
-- Check current data volumes
SELECT 
  'ai_agent_sessions' as table_name,
  count(*) as total_rows,
  count(*) FILTER (WHERE expires_at > NOW()) as active_sessions,
  max(created_at) as last_created,
  pg_size_pretty(pg_total_relation_size('ai_agent_sessions')) as table_size
FROM ai_agent_sessions
UNION ALL
SELECT 
  'agent_chat_sessions',
  count(*),
  count(*) FILTER (WHERE expires_at > NOW() AND status = 'active'),
  max(created_at),
  pg_size_pretty(pg_total_relation_size('agent_chat_sessions'))
FROM agent_chat_sessions;
```

**Expected Output:**
- Total rows in each table
- Active session counts
- Last activity timestamps
- Storage size

**Decision Point:** If `ai_agent_sessions` has >10k rows, plan for batch migration.

---

#### Step 2: Schema Compatibility Check (30 min)
```sql
-- Find any sessions that would fail FK constraint
SELECT 
  ais.id,
  ais.phone,
  ais.created_at,
  CASE 
    WHEN wu.id IS NULL THEN 'NO_USER_MATCH'
    ELSE 'OK'
  END as migration_status
FROM ai_agent_sessions ais
LEFT JOIN whatsapp_users wu ON wu.wa_id = ais.phone OR wu.phone_number = ais.phone
WHERE wu.id IS NULL
LIMIT 10;
```

**Decision Point:** If >10% of sessions have no user match, add nullable user_id column.

---

#### Step 3: Code Reference Inventory (1 hour)

Create detailed mapping:

```bash
# Find all references
grep -r "ai_agent_sessions" supabase/functions/ --include="*.ts" -n > /tmp/ai_session_refs.txt

# Categorize by operation type
grep "\.from('ai_agent_sessions')" /tmp/ai_session_refs.txt | \
  sed 's/.*\.\(select\|insert\|update\|delete\|upsert\).*/\1/' | \
  sort | uniq -c
```

**Expected Categories:**
- SELECT: ~10 references
- INSERT: ~5 references
- UPDATE: ~4 references
- DELETE: ~2 references

**Create Checklist:**
```markdown
- [ ] wa-agent-waiter/core/base-agent.ts (SELECT, INSERT)
- [ ] wa-agent-waiter/core/session-manager.ts (SELECT, UPDATE, DELETE)
- [ ] wa-agent-farmer/core/base-agent.ts (SELECT, INSERT)
- [ ] wa-agent-farmer/core/session-manager.ts (SELECT, UPDATE, DELETE)
- [ ] wa-agent-support/core/base-agent.ts (SELECT, INSERT)
- [ ] wa-agent-support/core/session-manager.ts (SELECT, UPDATE, DELETE)
```

---

### Phase 3.2: Migration Script Development (2 hours)

#### Migration File: `20251210000000_consolidate_ai_agent_sessions.sql`

```sql
-- ============================================================================
-- CONSOLIDATE AI AGENT SESSIONS
-- ============================================================================
-- Purpose: Migrate ai_agent_sessions → agent_chat_sessions
-- Risk: MEDIUM (updates 21 code references)
-- Rollback: Restore from backup, revert code
-- ============================================================================

BEGIN;

-- =====================================================
-- STEP 1: Verify Preconditions
-- =====================================================
DO $$
DECLARE
  v_ai_count INTEGER;
  v_chat_count INTEGER;
BEGIN
  SELECT count(*) INTO v_ai_count FROM ai_agent_sessions;
  SELECT count(*) INTO v_chat_count FROM agent_chat_sessions;
  
  RAISE NOTICE 'Current state: ai_agent_sessions=%  agent_chat_sessions=%', 
    v_ai_count, v_chat_count;
  
  IF v_ai_count = 0 THEN
    RAISE NOTICE 'ai_agent_sessions is empty - safe to drop';
    RETURN;
  END IF;
  
  IF v_ai_count > 10000 THEN
    RAISE WARNING 'Large dataset detected (% rows) - consider batch migration', v_ai_count;
  END IF;
END $$;

-- =====================================================
-- STEP 2: Add Temporary Columns (for backfill)
-- =====================================================
ALTER TABLE agent_chat_sessions 
  ADD COLUMN IF NOT EXISTS migrated_from_simple BOOLEAN DEFAULT false;

-- =====================================================
-- STEP 3: Migrate Active Sessions
-- =====================================================
INSERT INTO agent_chat_sessions (
  user_phone,
  agent_type,
  context,
  status,
  created_at,
  updated_at,
  last_message_at,
  expires_at,
  migrated_from_simple
)
SELECT 
  ais.phone as user_phone,
  'generic' as agent_type, -- Default, will be updated by app logic
  ais.context,
  CASE 
    WHEN ais.expires_at > NOW() THEN 'active'
    ELSE 'expired'
  END as status,
  ais.created_at,
  ais.updated_at,
  ais.updated_at as last_message_at,
  ais.expires_at,
  true as migrated_from_simple
FROM ai_agent_sessions ais
WHERE NOT EXISTS (
  -- Avoid duplicates
  SELECT 1 FROM agent_chat_sessions acs
  WHERE acs.user_phone = ais.phone
    AND acs.status = 'active'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- STEP 4: Verify Migration
-- =====================================================
DO $$
DECLARE
  v_migrated_count INTEGER;
  v_source_count INTEGER;
BEGIN
  SELECT count(*) INTO v_migrated_count 
  FROM agent_chat_sessions 
  WHERE migrated_from_simple = true;
  
  SELECT count(*) INTO v_source_count 
  FROM ai_agent_sessions;
  
  RAISE NOTICE 'Migration result: migrated=%  source=%', 
    v_migrated_count, v_source_count;
  
  IF v_migrated_count < (v_source_count * 0.9) THEN
    RAISE WARNING 'Less than 90%% of sessions migrated - review conflicts';
  END IF;
END $$;

-- =====================================================
-- STEP 5: Create Compatibility View (temporary)
-- =====================================================
-- This allows old code to continue working during transition
CREATE OR REPLACE VIEW ai_agent_sessions_compat AS
SELECT 
  id,
  user_phone as phone,
  context,
  created_at,
  updated_at,
  expires_at
FROM agent_chat_sessions
WHERE migrated_from_simple = true;

GRANT SELECT ON ai_agent_sessions_compat TO service_role, authenticated, anon;

RAISE NOTICE '====================================================================';
RAISE NOTICE 'MIGRATION PHASE 1 COMPLETE';
RAISE NOTICE '====================================================================';
RAISE NOTICE 'Next steps:';
RAISE NOTICE '1. Deploy updated Edge Functions';
RAISE NOTICE '2. Monitor for errors';
RAISE NOTICE '3. After 24h, run phase 2 to drop ai_agent_sessions';
RAISE NOTICE '====================================================================';

COMMIT;
```

**Testing Strategy:**
```bash
# Test on local Supabase first
supabase db reset
supabase db push

# Verify migration
supabase db execute "SELECT count(*) FROM agent_chat_sessions WHERE migrated_from_simple = true;"
```

---

### Phase 3.3: Code Updates (3 hours)

#### File 1: Create Shared Session Manager (1 hour)

**New file:** `supabase/functions/_shared/ai-session-manager.ts`

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AISession {
  id: string;
  userPhone: string;
  agentType: string;
  context: Record<string, unknown>;
  status: 'active' | 'paused' | 'completed' | 'expired';
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

/**
 * Get or create AI agent session
 * Uses agent_chat_sessions table (consolidated)
 */
export async function getOrCreateSession(
  client: SupabaseClient,
  userPhone: string,
  agentType: string,
  options: {
    userId?: string;
    agentId?: string;
  } = {}
): Promise<AISession | null> {
  // Try to find active session
  const { data: existing, error: findError } = await client
    .from('agent_chat_sessions')
    .select('*')
    .eq('user_phone', userPhone)
    .eq('agent_type', agentType)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existing) {
    // Update last_message_at
    await client
      .from('agent_chat_sessions')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', existing.id);

    return mapToAISession(existing);
  }

  // Create new session
  const { data: newSession, error: createError } = await client
    .from('agent_chat_sessions')
    .insert({
      user_phone: userPhone,
      user_id: options.userId,
      agent_type: agentType,
      agent_id: options.agentId,
      status: 'active',
      context: {},
      conversation_history: [],
    })
    .select()
    .single();

  if (createError || !newSession) {
    console.error('Failed to create session:', createError);
    return null;
  }

  return mapToAISession(newSession);
}

/**
 * Add message to conversation history
 */
export async function addMessage(
  client: SupabaseClient,
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<boolean> {
  const message = {
    role,
    content,
    timestamp: new Date().toISOString(),
    metadata,
  };

  const { error } = await client.rpc('add_agent_message', {
    p_session_id: sessionId,
    p_role: role,
    p_content: content,
    p_metadata: metadata,
  });

  return !error;
}

/**
 * Update session context
 */
export async function updateContext(
  client: SupabaseClient,
  sessionId: string,
  context: Record<string, unknown>
): Promise<boolean> {
  const { error } = await client
    .from('agent_chat_sessions')
    .update({ 
      context,
      updated_at: new Date().toISOString() 
    })
    .eq('id', sessionId);

  return !error;
}

/**
 * End session
 */
export async function endSession(
  client: SupabaseClient,
  sessionId: string,
  status: 'completed' | 'expired' = 'completed'
): Promise<boolean> {
  const { error } = await client
    .from('agent_chat_sessions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  return !error;
}

function mapToAISession(row: any): AISession {
  return {
    id: row.id,
    userPhone: row.user_phone,
    agentType: row.agent_type,
    context: row.context || {},
    status: row.status,
    conversationHistory: row.conversation_history || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}
```

**Testing:**
```typescript
// Test file: _shared/ai-session-manager.test.ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { getOrCreateSession, addMessage } from "./ai-session-manager.ts";

Deno.test("getOrCreateSession - creates new session", async () => {
  const session = await getOrCreateSession(
    mockClient,
    "+250788123456",
    "waiter"
  );
  
  assertEquals(session?.userPhone, "+250788123456");
  assertEquals(session?.agentType, "waiter");
  assertEquals(session?.status, "active");
});

Deno.test("getOrCreateSession - reuses existing session", async () => {
  // Create first session
  const session1 = await getOrCreateSession(mockClient, "+250788123456", "waiter");
  
  // Try to create again
  const session2 = await getOrCreateSession(mockClient, "+250788123456", "waiter");
  
  assertEquals(session1?.id, session2?.id);
});
```

---

#### File 2-7: Update Agent Files (2 hours)

**Pattern for each file:**

```typescript
// BEFORE (wa-agent-waiter/core/session-manager.ts)
import type { SupabaseClient } from "@supabase/supabase-js";

async function getSession(client: SupabaseClient, phone: string) {
  const { data } = await client
    .from('ai_agent_sessions')
    .select('*')
    .eq('phone', phone)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  
  return data;
}

async function createSession(client: SupabaseClient, phone: string) {
  const { data } = await client
    .from('ai_agent_sessions')
    .insert({ phone, context: {} })
    .select()
    .single();
  
  return data;
}

// AFTER
import { 
  getOrCreateSession, 
  addMessage, 
  updateContext 
} from "../../../_shared/ai-session-manager.ts";

async function getSession(client: SupabaseClient, phone: string) {
  return await getOrCreateSession(client, phone, 'waiter');
}

async function createSession(client: SupabaseClient, phone: string) {
  return await getOrCreateSession(client, phone, 'waiter');
}
```

**Files to update:**
1. `wa-agent-waiter/core/session-manager.ts` (30 min)
2. `wa-agent-waiter/core/base-agent.ts` (15 min)
3. `wa-agent-farmer/core/session-manager.ts` (30 min)
4. `wa-agent-farmer/core/base-agent.ts` (15 min)
5. `wa-agent-support/core/session-manager.ts` (30 min)
6. `wa-agent-support/core/base-agent.ts` (15 min)

**Total:** ~2 hours (including testing)

---

### Phase 3.4: Testing & Validation (2 hours)

#### Unit Tests (1 hour)

```bash
# Run unit tests for each updated file
deno test supabase/functions/_shared/ai-session-manager.test.ts
deno test supabase/functions/wa-agent-waiter/core/session-manager.test.ts
deno test supabase/functions/wa-agent-farmer/core/session-manager.test.ts
deno test supabase/functions/wa-agent-support/core/session-manager.test.ts
```

**Success Criteria:**
- [ ] All existing tests pass
- [ ] New session manager tests pass
- [ ] Session creation works
- [ ] Session reuse works
- [ ] Conversation history persists

---

#### Integration Tests (1 hour)

**Test Scenarios:**

1. **Waiter Agent - New Session**
```bash
# Send message to waiter
curl -X POST https://api.yourapp.com/wa-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+250788123456",
    "message": "I want to order food"
  }'

# Verify session created
SELECT * FROM agent_chat_sessions 
WHERE user_phone = '+250788123456' 
  AND agent_type = 'waiter';
-- Expected: 1 row, status = 'active'
```

2. **Farmer Agent - Existing Session**
```bash
# Send first message
curl -X POST ... -d '{"from": "+250788999999", "message": "market prices"}'

# Send second message (should reuse session)
curl -X POST ... -d '{"from": "+250788999999", "message": "rice price"}'

# Verify single session with 2 messages
SELECT 
  id,
  user_phone,
  agent_type,
  jsonb_array_length(conversation_history) as message_count
FROM agent_chat_sessions
WHERE user_phone = '+250788999999';
-- Expected: message_count = 2
```

3. **Support Agent - Context Persistence**
```bash
# Initiate support
curl -X POST ... -d '{"from": "+250788777777", "message": "help"}'

# Update context
curl -X POST ... -d '{"from": "+250788777777", "message": "password reset"}'

# Verify context updated
SELECT context FROM agent_chat_sessions 
WHERE user_phone = '+250788777777' AND agent_type = 'support';
-- Expected: context contains 'password_reset'
```

**Success Criteria:**
- [ ] All agents create sessions correctly
- [ ] Session reuse works (no duplicate sessions)
- [ ] Conversation history accumulates
- [ ] Context updates persist
- [ ] Sessions expire correctly (24h)

---

### Phase 3.5: Deployment (1 hour)

#### Pre-Deployment Checklist

```markdown
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Database migration tested locally
- [ ] Code committed to git
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
- [ ] Off-hours deployment scheduled (2-4 AM EAT)
```

---

#### Deployment Steps

**Step 1: Deploy Edge Functions (30 min)**
```bash
# Deploy updated agent functions
supabase functions deploy wa-agent-waiter
supabase functions deploy wa-agent-farmer
supabase functions deploy wa-agent-support

# Verify deployment
supabase functions list | grep wa-agent
```

**Step 2: Apply Database Migration (15 min)**
```bash
# Apply migration
supabase db push

# Verify migration
supabase db execute "
  SELECT 
    count(*) FILTER (WHERE migrated_from_simple = true) as migrated,
    count(*) as total
  FROM agent_chat_sessions;
"
```

**Step 3: Monitor (15 min)**
```bash
# Watch Edge Function logs
tail -f <edge_function_logs> | grep -i "session\|agent"

# Check for errors
grep -i "error\|fail" <edge_function_logs> | tail -20

# Verify session creation
watch -n 5 "supabase db execute \"
  SELECT 
    agent_type,
    count(*) as sessions,
    count(*) FILTER (WHERE created_at > NOW() - INTERVAL '5 minutes') as recent
  FROM agent_chat_sessions
  GROUP BY agent_type;
\""
```

---

### Phase 3.6: Cleanup (30 min)

**After 24-48 hours of stable operation:**

```sql
-- Migration: 20251212000000_drop_ai_agent_sessions.sql

BEGIN;

-- Verify no recent activity on old table
DO $$
DECLARE
  v_recent_count INTEGER;
BEGIN
  SELECT count(*) INTO v_recent_count
  FROM ai_agent_sessions
  WHERE created_at > NOW() - INTERVAL '48 hours';
  
  IF v_recent_count > 0 THEN
    RAISE EXCEPTION 'Recent activity detected on ai_agent_sessions - abort drop';
  END IF;
END $$;

-- Drop compatibility view
DROP VIEW IF EXISTS ai_agent_sessions_compat;

-- Drop old table
DROP TABLE IF EXISTS ai_agent_sessions CASCADE;

-- Clean up migration flag
ALTER TABLE agent_chat_sessions DROP COLUMN IF EXISTS migrated_from_simple;

RAISE NOTICE 'Cleanup complete - ai_agent_sessions removed';

COMMIT;
```

---

## Risk Assessment & Mitigation

### High-Risk Areas

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Session loss during migration | LOW | HIGH | Compatibility view, gradual rollout |
| Agent functionality breaks | MEDIUM | HIGH | Comprehensive testing, rollback plan |
| Performance degradation | LOW | MEDIUM | Load testing, index optimization |
| Data migration failures | LOW | HIGH | Transaction wrapper, validation checks |

### Rollback Plan

**If deployment fails:**

1. **Immediate (< 5 min):**
```bash
# Revert Edge Functions
git revert HEAD
supabase functions deploy wa-agent-waiter
supabase functions deploy wa-agent-farmer
supabase functions deploy wa-agent-support
```

2. **Database (< 10 min):**
```sql
-- Compatibility view keeps old code working
-- No immediate database rollback needed

-- If necessary, recreate ai_agent_sessions from agent_chat_sessions
CREATE TABLE ai_agent_sessions AS
SELECT 
  id,
  user_phone as phone,
  context,
  created_at,
  updated_at,
  expires_at
FROM agent_chat_sessions
WHERE migrated_from_simple = true;
```

---

## Success Metrics

### Technical Metrics
- [ ] Zero session creation failures
- [ ] <5% increase in session query latency
- [ ] 100% of agents using new table
- [ ] Zero data loss (all sessions migrated)

### Business Metrics
- [ ] No customer-reported issues
- [ ] AI agent response times unchanged
- [ ] Conversation context maintained across messages
- [ ] Developer feedback positive

---

## Timeline

### Week 1: Preparation
- **Day 1-2:** Phase 3.1 - Analysis (2h)
- **Day 3:** Phase 3.2 - Migration script (2h)
- **Day 4-5:** Phase 3.3 - Code updates (3h)

### Week 2: Testing
- **Day 1-2:** Phase 3.4 - Testing (2h)
- **Day 3:** Review & adjustments
- **Day 4:** Pre-deployment checklist

### Week 3: Deployment
- **Day 1:** Deploy to staging
- **Day 2-3:** Staging validation
- **Day 4:** Production deployment (off-hours)
- **Day 5-7:** Monitoring

### Week 4: Cleanup
- **Day 1-3:** Monitor stability
- **Day 4:** Cleanup migration (Phase 3.6)

**Total Calendar Time:** 4 weeks  
**Total Development Effort:** 7 hours

---

# Task 2: Webhook/Audit Logs Deep Analysis

## Business Justification

### Problem Statement
Currently maintaining 10+ logging tables creates:
- **Query complexity:** Developers must know which log table to query
- **Incomplete audits:** Data scattered across multiple tables
- **Storage inefficiency:** Overlapping data, redundant indexes
- **Compliance risk:** Hard to prove complete audit trail

### Expected Benefits
| Benefit | Impact | Measurement |
|---------|--------|-------------|
| Unified audit trail | Complete visibility | Single query for all events |
| Compliance readiness | Reduced audit time | SOC2/GDPR audit evidence |
| Storage optimization | Cost reduction | ~20-30% storage savings |
| Faster debugging | Reduced MTTR | Single log source |

### Business Impact
- **Compliance:** Faster audit response (hours vs days)
- **Operations:** ~30% faster incident investigation
- **Cost:** Estimated $500-1000/year storage savings

### ROI Analysis
- **Investment:** 8-10 hours (1.5 developer-days)
- **Ongoing savings:** ~4 hours/month in log queries
- **Payback period:** 2-3 months
- **Risk:** MEDIUM (complex data migration)

---

## Phase 3.7: Discovery & Mapping (3 hours)

### Step 1: Table Inventory (1 hour)

**Create comprehensive map:**

```sql
-- Analyze all webhook/audit tables
SELECT 
  schemaname,
  tablename,
  n_tup_ins as total_inserts,
  n_tup_upd as total_updates,
  n_tup_del as total_deletes,
  n_live_tup as current_rows,
  n_dead_tup as dead_rows,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_stat_user_tables
WHERE tablename IN (
  'webhook_logs',
  'webhook_delivery_log',
  'webhook_routing_logs',
  'webhook_stats',
  'processed_webhooks',
  'webhook_nonces',
  'audit_logs',
  'system_logs',
  'security_audit_log',
  'agent_error_logs',
  'trip_status_audit'
)
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Expected Output:**
```
tablename               | rows   | size   | purpose
------------------------|--------|--------|------------------
webhook_logs            | 50k    | 45 MB  | General webhook events
webhook_delivery_log    | 30k    | 25 MB  | Delivery tracking
audit_logs              | 100k   | 80 MB  | User actions
system_logs             | 200k   | 150 MB | System events
security_audit_log      | 10k    | 8 MB   | Security events
...
```

---

### Step 2: Schema Analysis (1 hour)

**Compare webhook tables:**

```sql
-- Extract schemas for comparison
SELECT 
  'webhook_logs' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'webhook_logs'
UNION ALL
SELECT 
  'webhook_delivery_log',
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'webhook_delivery_log'
ORDER BY table_name, ordinal_position;
```

**Create Venn diagram:**
```
webhook_logs                webhook_delivery_log
┌────────────────────┐     ┌────────────────────┐
│ • webhook_id       │     │ • delivery_id      │
│ • event_type       │◄────┤ • webhook_id       │
│ • payload          │     │ • recipient        │
│ • created_at       │     │ • status           │
│                    │     │ • delivered_at     │
│                    │     │ • retry_count      │
└────────────────────┘     └────────────────────┘
   Common: webhook_id, created_at
   Unique: event_type vs delivery_id
   Overlap: ~40% of columns
```

**Decision Matrix:**

| Comparison | Verdict | Rationale |
|------------|---------|-----------|
| `webhook_logs` vs `webhook_delivery_log` | **MERGE** | 40% overlap, delivery is subset |
| `webhook_routing_logs` vs `webhook_logs` | **KEEP SEPARATE** | Different granularity |
| `webhook_stats` | **KEEP SEPARATE** | Aggregated data, different query pattern |
| `processed_webhooks` | **KEEP SEPARATE** | Idempotency, different lifecycle |

---

### Step 3: Usage Pattern Analysis (1 hour)

**Query log tables for patterns:**

```bash
# Find all webhook log queries in code
grep -r "webhook_logs\|webhook_delivery_log" supabase/functions/ \
  --include="*.ts" -B2 -A5 > /tmp/webhook_query_patterns.txt

# Categorize queries
cat /tmp/webhook_query_patterns.txt | grep -oE "\.(select|insert|update|delete)" | sort | uniq -c

# Common query patterns
grep -oE "WHERE.*" /tmp/webhook_query_patterns.txt | sort | uniq -c | head -10
```

**Expected Patterns:**

1. **Webhook Logs:**
```typescript
// Pattern 1: Log incoming webhook
await supabase.from('webhook_logs').insert({
  event_type: 'incoming',
  payload: data,
  source: 'whatsapp'
});

// Pattern 2: Query recent events
await supabase.from('webhook_logs')
  .select('*')
  .eq('event_type', 'error')
  .gte('created_at', yesterday);
```

2. **Delivery Log:**
```typescript
// Pattern 1: Track delivery attempt
await supabase.from('webhook_delivery_log').insert({
  webhook_id: id,
  recipient: phone,
  status: 'sent'
});

// Pattern 2: Check delivery status
await supabase.from('webhook_delivery_log')
  .select('status')
  .eq('webhook_id', id)
  .single();
```

**Consolidation Opportunity:**
```typescript
// Unified webhook_events table
await supabase.from('webhook_events').insert({
  event_type: 'delivery_attempt', // Combines both purposes
  webhook_id: id,
  recipient: phone,
  status: 'sent',
  payload: data
});
```

---

## Phase 3.8: Consolidation Design (2 hours)

### Unified Schema Design

**New table: `webhook_events`**

```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event classification
  event_category TEXT NOT NULL, -- 'incoming', 'delivery', 'error', 'routing'
  event_type TEXT NOT NULL,     -- Specific event subtype
  
  -- Core webhook data
  webhook_id TEXT,               -- External webhook ID
  source TEXT,                   -- 'whatsapp', 'twilio', etc.
  destination TEXT,              -- Recipient if applicable
  
  -- Payload
  payload JSONB,                 -- Full event payload
  headers JSONB,                 -- HTTP headers if applicable
  
  -- Status tracking
  status TEXT,                   -- 'pending', 'sent', 'delivered', 'failed'
  retry_count INTEGER DEFAULT 0,
  
  -- Error handling
  error_code TEXT,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Indexes for common queries
CREATE INDEX idx_webhook_events_category ON webhook_events(event_category);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_webhook_id ON webhook_events(webhook_id);
CREATE INDEX idx_webhook_events_status ON webhook_events(status) WHERE status != 'delivered';
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at DESC);
CREATE INDEX idx_webhook_events_source ON webhook_events(source);

-- Composite index for common filtering
CREATE INDEX idx_webhook_events_category_status 
  ON webhook_events(event_category, status, created_at DESC);
```

**Migration mapping:**

```sql
-- webhook_logs → webhook_events
INSERT INTO webhook_events (
  event_category,
  event_type,
  webhook_id,
  source,
  payload,
  status,
  created_at
)
SELECT 
  'incoming' as event_category,
  event_type,
  webhook_id,
  source,
  payload,
  COALESCE(status, 'completed') as status,
  created_at
FROM webhook_logs;

-- webhook_delivery_log → webhook_events
INSERT INTO webhook_events (
  event_category,
  event_type,
  webhook_id,
  destination,
  status,
  retry_count,
  error_message,
  created_at,
  delivered_at
)
SELECT 
  'delivery' as event_category,
  'delivery_attempt' as event_type,
  webhook_id,
  recipient as destination,
  status,
  retry_count,
  error_message,
  created_at,
  delivered_at
FROM webhook_delivery_log;
```

---

### Audit Logs Consolidation

**Similarly for audit tables:**

```sql
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event classification
  event_category TEXT NOT NULL, -- 'user_action', 'system', 'security'
  event_type TEXT NOT NULL,     -- 'login', 'payment', 'trip_status_change'
  
  -- Actor
  user_id UUID REFERENCES profiles(user_id),
  actor_type TEXT,              -- 'user', 'system', 'admin'
  actor_ip TEXT,
  
  -- Target
  resource_type TEXT,           -- 'trip', 'payment', 'user'
  resource_id UUID,
  
  -- Action
  action TEXT NOT NULL,         -- 'create', 'update', 'delete', 'view'
  
  -- Details
  changes JSONB,                -- Before/after for updates
  metadata JSONB DEFAULT '{}',
  
  -- Status
  status TEXT DEFAULT 'success', -- 'success', 'failed', 'unauthorized'
  error_message TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_events_category ON audit_events(event_category);
CREATE INDEX idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX idx_audit_events_resource ON audit_events(resource_type, resource_id);
CREATE INDEX idx_audit_events_created ON audit_events(created_at DESC);
CREATE INDEX idx_audit_events_action ON audit_events(action);

-- Compliance index (never delete security events)
CREATE INDEX idx_audit_events_security ON audit_events(created_at DESC) 
  WHERE event_category = 'security';
```

---

## Phase 3.9: Implementation (3 hours)

### Migration Script

**File:** `20251215000000_consolidate_webhook_audit_logs.sql`

```sql
BEGIN;

-- Create new unified tables
\i create_webhook_events.sql
\i create_audit_events.sql

-- Migrate data (with progress logging)
DO $$
DECLARE
  v_webhook_logs_count INTEGER;
  v_delivery_log_count INTEGER;
  v_audit_logs_count INTEGER;
BEGIN
  -- Migrate webhook_logs
  INSERT INTO webhook_events (...) SELECT ... FROM webhook_logs;
  GET DIAGNOSTICS v_webhook_logs_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % rows from webhook_logs', v_webhook_logs_count;
  
  -- Migrate webhook_delivery_log
  INSERT INTO webhook_events (...) SELECT ... FROM webhook_delivery_log;
  GET DIAGNOSTICS v_delivery_log_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % rows from webhook_delivery_log', v_delivery_log_count;
  
  -- Migrate audit_logs
  INSERT INTO audit_events (...) SELECT ... FROM audit_logs;
  GET DIAGNOSTICS v_audit_logs_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % rows from audit_logs', v_audit_logs_count;
END $$;

-- Create compatibility views
CREATE VIEW webhook_logs_compat AS 
  SELECT * FROM webhook_events WHERE event_category = 'incoming';

CREATE VIEW webhook_delivery_log_compat AS
  SELECT * FROM webhook_events WHERE event_category = 'delivery';

COMMIT;
```

---

### Code Updates (Similar to AI Sessions)

**Pattern:**
```typescript
// BEFORE
await supabase.from('webhook_logs').insert({ ... });

// AFTER
await supabase.from('webhook_events').insert({ 
  event_category: 'incoming',
  ...
});
```

**Estimated effort:** 2 hours (fewer references than AI sessions)

---

## Phase 3.10: Testing & Deployment (2 hours)

**Similar to AI Sessions Phase 3.4-3.5**

---

## Combined Timeline

### Total Effort Breakdown

| Task | Analysis | Development | Testing | Deployment | Total |
|------|----------|-------------|---------|------------|-------|
| AI Sessions | 2h | 5h | 2h | 1h | **10h** |
| Webhook Logs | 3h | 3h | 1h | 1h | **8h** |
| Audit Logs | 2h | 2h | 1h | 1h | **6h** |
| **Total** | **7h** | **10h** | **4h** | **3h** | **24h** |

### Recommended Phasing

**Option 1: Sequential (Lower Risk)**
- Week 1-4: AI Sessions (10h)
- Week 5-6: Webhook Logs (8h)
- Week 7-8: Audit Logs (6h)
- **Total:** 8 weeks, 24h effort

**Option 2: Parallel (Faster)**
- Week 1-2: Analysis for all tasks (7h)
- Week 3-4: Development for all tasks (10h)
- Week 5: Testing for all tasks (4h)
- Week 6: Staggered deployments (3h)
- **Total:** 6 weeks, 24h effort (higher risk)

**Recommendation:** **Option 1 (Sequential)** - Lessons learned from each consolidation improve subsequent ones.

---

## Success Criteria

### Overall Project
- [ ] Zero production incidents
- [ ] <5% performance degradation
- [ ] 100% data migrated
- [ ] All tests passing
- [ ] Documentation updated

### Per-Task
- [ ] Code references updated
- [ ] Old tables dropped
- [ ] Storage reduction achieved
- [ ] Query performance maintained or improved

---

## Cost-Benefit Summary

### Investment
- **Developer time:** 24 hours (~3 developer-days)
- **Risk:** MEDIUM (managed through testing & rollback plans)
- **Disruption:** LOW (gradual rollout, compatibility views)

### Returns
- **Storage savings:** ~$500-1000/year
- **Maintenance reduction:** ~6 hours/month
- **Improved developer productivity:** ~20% faster feature development
- **Better compliance:** Faster audit response

### Break-Even
- **Payback period:** 2-4 months
- **5-year NPV:** Positive (savings >> investment)

---

**Status:** 📋 DETAILED PLAN READY  
**Next Step:** Prioritize and schedule Task 1 (AI Sessions)  
**Document:** Phase 3 Implementation Plan v1.0  
**Date:** 2025-12-09 00:34 UTC
