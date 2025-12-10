# WhatsApp-First AI Agent Refactoring - Implementation Guide

**Status**: Detailed Implementation Plan  
**Created**: 2025-11-22  
**Purpose**: Step-by-step guide for refactoring EasyMO to WhatsApp-first architecture

## Executive Summary

This guide provides a phased approach to refactor the EasyMO codebase from fragmented webhook handlers to a unified, WhatsApp-first, AI-agent-centric architecture. The refactoring maintains backward compatibility and production stability through feature flags and gradual migration.

## Prerequisites

Before starting:
- ✅ Review `docs/architecture/agents-map.md` - Understand current state
- ✅ Review `docs/architecture/whatsapp-pipeline.md` - Understand target architecture
- ✅ Review `docs/architecture/profile-and-wallet.md` - Understand Profile module
- ✅ Review `docs/GROUND_RULES.md` - Follow observability, security, feature flag rules

## Phase 1: Foundation ✅ COMPLETE

**Deliverables**: Architecture documentation  
**Status**: Complete  
**Time**: 1 week

Outputs:
- `docs/architecture/agents-map.md` - Complete inventory
- `docs/architecture/whatsapp-pipeline.md` - Pipeline design
- `docs/architecture/profile-and-wallet.md` - Profile design

## Phase 2: Unified Webhook Pipeline

**Deliverables**: Single webhook handler with intent system  
**Estimated Time**: 3-4 weeks  
**Status**: Not Started

### 2.1 Create Core Pipeline Components (Week 1)

#### Task 2.1.1: Event Normalizer
**File**: `supabase/functions/wa-webhook/pipeline/normalizer.ts`

**Purpose**: Normalize WhatsApp events → `whatsapp_users`, `whatsapp_messages`

**Key Functions**:
```typescript
async function normalizeWhatsAppEvent(payload, correlationId): Promise<NormalizedEvent>
function validateWhatsAppSignature(payload, signature, secret): boolean
```

**Schema Updates**: None needed (tables exist)

**Testing**:
```bash
# Unit tests
deno test supabase/functions/wa-webhook/pipeline/normalizer.test.ts

# Test cases:
- Text message normalization
- Interactive button message
- Location message
- Invalid payload handling
- Signature validation
```

**Feature Flag**: `FEATURE_UNIFIED_NORMALIZER` (default: false)

**Rollback**: Keep existing normalization logic alongside

---

#### Task 2.1.2: Agent Detector
**File**: `supabase/functions/wa-webhook/pipeline/agent-detector.ts`

**Purpose**: Detect active agent from menu selection or context

**Key Functions**:
```typescript
async function detectAgent(userId, content, correlationId): Promise<AgentConfig | null>
async function getOrCreateConversation(userId, agentId): Promise<Conversation>
```

**Logic**:
1. Check for active conversation with agent
2. Check for menu number (1-9)
3. Check for agent keywords
4. Default to main menu

**Schema Updates**: None needed

**Testing**:
```bash
# Test cases:
- Menu selection "1️⃣" → waiter agent
- Active conversation continues with same agent
- Keyword "find job" → jobs agent
- No match → null (show home menu)
```

**Feature Flag**: `FEATURE_AGENT_DETECTION` (default: false)

---

#### Task 2.1.3: Agent Runtime
**File**: `supabase/functions/wa-webhook/pipeline/agent-runtime.ts`

**Purpose**: Call LLM with agent config + conversation context

**Key Functions**:
```typescript
async function runAgent(agent, user, conversation, message): Promise<AgentResponse>
async function buildAgentContext(agent, user, conversation): Promise<AgentContext>
```

**LLM Integration**:
- OpenAI GPT-4 for primary
- Gemini as fallback
- Structured function calling

**Schema Updates**: None needed

**Testing**:
```bash
# Test cases:
- Waiter agent responds to "I want pizza"
- Jobs agent responds to "find software engineer jobs"
- Agent uses saved locations
- Agent remembers recent orders/trips
```

**Feature Flag**: `FEATURE_AGENT_RUNTIME` (default: false)

---

#### Task 2.1.4: Intent Parser
**File**: `supabase/functions/wa-webhook/pipeline/intent-parser.ts`

**Purpose**: Parse LLM response → structured `ai_agent_intents`

**Key Functions**:
```typescript
async function parseIntent(agentResponse, conversation): Promise<ParsedIntent>
async function storeIntent(intent): Promise<string> // Returns intent ID
```

**Intent Schema** (already exists in DB):
```typescript
interface ParsedIntent {
  conversation_id: string;
  agent_id: string;
  message_id: string;
  intent_type: string;
  intent_subtype?: string;
  raw_text: string;
  summary: string;
  structured_payload: any;
  confidence: number;
  status: 'pending';
}
```

**Schema Updates**: None needed

**Testing**:
```bash
# Test cases:
- "Order pizza and fries" → order_food intent with items
- "Book trip to CBD tomorrow" → book_trip intent with location/time
- "Find 2BR apartment" → search_property intent with criteria
```

**Feature Flag**: `FEATURE_INTENT_PARSING` (default: false)

---

#### Task 2.1.5: Apply Intent Service
**File**: `services/agent-core/src/apply-intent/index.ts`

**Purpose**: Poll `ai_agent_intents`, update domain tables

**Key Functions**:
```typescript
async function processIntents(): void // Background worker
async function applyIntent(intent): Promise<ApplyResult>
function getIntentHandler(agentId, intentType): IntentHandler
```

**Intent Handlers**:
- `handlers/waiter/order-food.ts` → Insert into `orders`
- `handlers/jobs/find-job.ts` → Search `job_posts`, create matches
- `handlers/rides/book-trip.ts` → Insert into `trips`, match driver
- etc.

**Schema Updates**: None needed

**Testing**:
```bash
# Integration tests
pnpm --filter @easymo/agent-core test

# Test cases:
- Order intent creates order in DB
- Job search intent creates matches
- Trip booking intent creates trip + match event
- Failed intent updates status to 'failed'
```

**Feature Flag**: `FEATURE_APPLY_INTENT` (default: false)

**Deployment**: New microservice or background job

---

#### Task 2.1.6: Reply Generator
**File**: `supabase/functions/wa-webhook/pipeline/reply-generator.ts`

**Purpose**: Format agent response for WhatsApp, send message

**Key Functions**:
```typescript
async function generateReply(agentResponse, conversation): Promise<WhatsAppMessage>
async function sendWhatsAppMessage(phoneNumber, message): Promise<string>
```

**Message Formatting**:
- Add emoji numbers for options
- Use interactive buttons/lists when appropriate
- Keep messages concise (1-2 sentences)

**Schema Updates**: None needed

**Testing**:
```bash
# Test cases:
- Format text reply with emoji options
- Create interactive button message
- Create list message for search results
- Handle WhatsApp API errors
```

**Feature Flag**: `FEATURE_REPLY_GENERATION` (default: false)

---

### 2.2 Integration & Testing (Week 2)

#### Task 2.2.1: End-to-End Pipeline Test
**File**: `supabase/functions/wa-webhook/pipeline/integration.test.ts`

**Test Flow**:
```typescript
describe('Unified Pipeline', () => {
  it('should process waiter order end-to-end', async () => {
    // 1. Send WhatsApp message: "I want pizza"
    const event = await sendTestMessage('+250788123456', 'I want pizza');
    
    // 2. Verify normalization
    const message = await getWhatsAppMessage(event.messageId);
    expect(message).toBeDefined();
    
    // 3. Verify agent detection
    const conversation = await getConversation(event.userId);
    expect(conversation.agent_id).toBe(waiterAgentId);
    
    // 4. Verify intent creation
    const intent = await waitForIntent(conversation.id);
    expect(intent.intent_type).toBe('order_food');
    
    // 5. Verify intent application
    await waitForIntentApplied(intent.id);
    const order = await getOrder(intent.structured_payload.orderId);
    expect(order).toBeDefined();
    
    // 6. Verify reply sent
    const reply = await getLatestReply(event.userId);
    expect(reply.body).toContain('order');
  });
});
```

**Run**: `deno test --allow-env --allow-net supabase/functions/wa-webhook/pipeline/integration.test.ts`

---

#### Task 2.2.2: Feature Flag Implementation
**File**: `supabase/functions/wa-webhook/config.ts`

**Flags**:
```typescript
export const FEATURES = {
  UNIFIED_WEBHOOK: Deno.env.get('FEATURE_UNIFIED_WEBHOOK') === 'true',
  UNIFIED_NORMALIZER: Deno.env.get('FEATURE_UNIFIED_NORMALIZER') === 'true',
  AGENT_DETECTION: Deno.env.get('FEATURE_AGENT_DETECTION') === 'true',
  AGENT_RUNTIME: Deno.env.get('FEATURE_AGENT_RUNTIME') === 'true',
  INTENT_PARSING: Deno.env.get('FEATURE_INTENT_PARSING') === 'true',
  APPLY_INTENT: Deno.env.get('FEATURE_APPLY_INTENT') === 'true',
  REPLY_GENERATION: Deno.env.get('FEATURE_REPLY_GENERATION') === 'true',
  
  // Per-agent flags
  WAITER_AGENT: Deno.env.get('FEATURE_WAITER_AGENT') === 'true',
  FARMER_AGENT: Deno.env.get('FEATURE_FARMER_AGENT') === 'true',
  BROKER_AGENT: Deno.env.get('FEATURE_BROKER_AGENT') === 'true',
  REAL_ESTATE_AGENT: Deno.env.get('FEATURE_REAL_ESTATE_AGENT') === 'true',
  JOBS_AGENT: Deno.env.get('FEATURE_JOBS_AGENT') === 'true',
  SALES_SDR_AGENT: Deno.env.get('FEATURE_SALES_SDR_AGENT') === 'true',
  RIDES_AGENT: Deno.env.get('FEATURE_RIDES_AGENT') === 'true',
  INSURANCE_AGENT: Deno.env.get('FEATURE_INSURANCE_AGENT') === 'true',
};
```

**Usage**:
```typescript
if (FEATURES.UNIFIED_WEBHOOK) {
  return await processUnifiedPipeline(req);
} else {
  return await legacyRouter(req);
}
```

---

### 2.3 Gradual Rollout (Weeks 3-4)

#### Week 3: Canary Deployment

**Steps**:
1. Deploy with all feature flags OFF
2. Enable `FEATURE_UNIFIED_NORMALIZER` for 1% of traffic
3. Monitor logs, metrics, errors
4. Gradually increase to 10%, 25%, 50%
5. Enable full pipeline for test users only

**Monitoring**:
```sql
-- Query success rate
SELECT
  COUNT(*) FILTER (WHERE status = 'applied') * 100.0 / COUNT(*) AS success_rate
FROM ai_agent_intents
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Query latency
SELECT
  percentile_cont(0.5) WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int) AS p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int) AS p95
FROM ai_agent_intents
WHERE created_at > NOW() - INTERVAL '1 hour';
```

**Rollback**: Set feature flags to false

---

#### Week 4: Full Migration

**Steps**:
1. Enable all feature flags
2. Route all traffic through unified pipeline
3. Keep old webhooks running (no deletion yet)
4. Monitor for 1 week
5. If stable, proceed to Phase 3

**Success Criteria**:
- [ ] Error rate < 1%
- [ ] p95 latency < 4s
- [ ] Intent application success rate > 95%
- [ ] No increase in support tickets
- [ ] All 7 AI agents working correctly (mobility/insurance use workflows)

---

## Phase 3: Profile & Wallet Extraction

**Deliverables**: Dedicated Profile module  
**Estimated Time**: 2-3 weeks  
**Status**: Not Started

### 3.1 Create Profile Package (Week 1)

#### Task 3.1.1: Package Setup
```bash
mkdir -p packages/profile/src/{wallet,stuff,locations,qr,helpers}
cd packages/profile
pnpm init
```

**package.json**:
```json
{
  "name": "@easymo/profile",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  },
  "dependencies": {
    "@easymo/commons": "workspace:*",
    "@supabase/supabase-js": "^2.39.3"
  }
}
```

---

#### Task 3.1.2: Wallet Module
**Files**:
- `packages/profile/src/wallet/balance.ts`
- `packages/profile/src/wallet/transactions.ts`
- `packages/profile/src/wallet/cashout.ts`
- `packages/profile/src/wallet/tokens.ts`

**APIs**:
```typescript
export async function getWalletBalance(userId: string): Promise<WalletBalance>
export async function getTransactionHistory(userId: string, limit: number): Promise<Transaction[]>
export async function requestCashout(userId: string, amount: number, momoNumber: string): Promise<CashoutRequest>
export async function earnTokens(userId: string, ruleId: string, metadata: any): Promise<TokenEarn>
export async function useTokens(userId: string, amount: number, orderId?: string): Promise<TokenUse>
```

**Tests**: `packages/profile/src/wallet/*.test.ts`

---

#### Task 3.1.3: My Stuff Module
**Files**:
- `packages/profile/src/stuff/businesses.ts`
- `packages/profile/src/stuff/vehicles.ts`
- `packages/profile/src/stuff/properties.ts`
- `packages/profile/src/stuff/jobs.ts`
- `packages/profile/src/stuff/listings.ts`
- `packages/profile/src/stuff/policies.ts`
- `packages/profile/src/stuff/trips.ts`

**API Pattern** (generic):
```typescript
export async function getMyStuff(
  userId: string,
  category: 'businesses' | 'vehicles' | 'properties' | 'jobs' | 'listings' | 'policies' | 'trips',
  options?: { limit?: number; offset?: number }
): Promise<{ items: EntitySummary[]; total: number; agentSlug: string }>
```

**Tests**: `packages/profile/src/stuff/*.test.ts`

---

#### Task 3.1.4: Saved Locations Module
**Files**:
- `packages/profile/src/locations/saved.ts`
- `packages/profile/src/locations/recent.ts`

**APIs**:
```typescript
export async function getSavedLocations(userId: string): Promise<SavedLocation[]>
export async function saveLocation(userId: string, data: SaveLocationData): Promise<SavedLocation>
export async function updateLocation(locationId: string, data: Partial<SaveLocationData>): Promise<SavedLocation>
export async function deleteLocation(locationId: string): Promise<void>
export async function getRecentLocations(userId: string, limit: number): Promise<SavedLocation[]>
```

**Tests**: `packages/profile/src/locations/*.test.ts`

---

### 3.2 Migrate Wallet Functions (Week 2)

#### Task 3.2.1: Consolidate MoMo Functions
**Current**: `momo-allocator/`, `momo-charge/`, `momo-webhook/`  
**Target**: Use `@easymo/profile` package

**Steps**:
1. Update functions to call `@easymo/profile` APIs
2. Test with feature flag
3. Deprecate old implementations

---

#### Task 3.2.2: Consolidate QR Functions
**Current**: `qr-resolve/`, `qr_info/`  
**Target**: Use `@easymo/profile` package

---

#### Task 3.2.3: Remove wa-webhook-wallet
**Current**: Separate webhook handler  
**Target**: Use main `wa-webhook` with Profile menu

**Steps**:
1. Add Profile menu item (9) to agent detector
2. Route Profile flows through main webhook
3. Deprecate `wa-webhook-wallet/`

---

### 3.3 Agent Helper APIs (Week 3)

#### Task 3.3.1: Create Helper Endpoints
**File**: `packages/profile/src/helpers/agent-context.ts`

**APIs** (internal only, not exposed publicly):
```typescript
export async function getUserPreferences(userId: string): Promise<UserPreferences>
export async function getRecentEntities(userId: string, category: string, limit: number): Promise<any[]>
export async function getUserContext(userId: string, agentSlug: string): Promise<AgentUserContext>
```

**Security**: Only callable by agent-core service (validate service token)

---

#### Task 3.3.2: Integration with Agent Runtime
**Update**: `supabase/functions/wa-webhook/pipeline/agent-runtime.ts`

**Change**:
```typescript
async function buildAgentContext(agent, user, conversation) {
  const userContext = await getUserContext(user.id, agent.slug);
  
  return {
    agent,
    user,
    conversation,
    savedLocations: userContext.savedLocations,
    recentOrders: userContext.recentOrders,
    recentTrips: userContext.recentTrips,
    preferences: userContext.preferences,
  };
}
```

---

## Phase 4: Agent-Specific Migration

**Deliverables**: All 7 AI agents using unified pipeline; mobility/insurance handled via workflows  
**Estimated Time**: 6-8 weeks (1 week per agent)  
**Status**: Not Started

### Migration Order & Timeline

1. **Waiter Agent** (Week 1) - Most complete, good reference
2. **Jobs Agent** (Week 2) - Well-developed, clear domain
3. **Rides Agent** (Week 3) - Critical service, well-understood
4. **Real Estate Agent** (Week 4) - Active development, semantic search
5. **Farmer Agent** (Week 5) - Simpler domain, good learning case
6. **Business Broker Agent** (Week 6) - Complex, extensive infrastructure
7. **Insurance Agent** (Week 7) - Newer, less legacy code
8. **Sales SDR Agent** (Week 8) - New agent, clean slate

### Per-Agent Checklist

For each agent, complete:

- [ ] Define agent config in `ai_agents` table (slug, name, description)
- [ ] Create persona in `ai_agent_personas` (tone, languages, traits)
- [ ] Write system instructions in `ai_agent_system_instructions`
- [ ] Define tools in `ai_agent_tools` (DB functions, HTTP endpoints, etc.)
- [ ] Define tasks in `ai_agent_tasks` (high-level actions)
- [ ] Define knowledge bases in `ai_agent_knowledge_bases`
- [ ] Create intent handlers in `services/agent-core/src/apply-intent/handlers/{agent}/`
- [ ] Update agent detector with menu mapping
- [ ] Test end-to-end flow
- [ ] Enable per-agent feature flag
- [ ] Migrate existing users gradually
- [ ] Deprecate old agent implementation

---

## Phase 5: Cleanup & Finalization

**Deliverables**: Production-ready, clean codebase  
**Estimated Time**: 2-3 weeks  
**Status**: Not Started

### 5.1 Remove Legacy Code (Week 1)

- [ ] Delete deprecated webhook handlers: wa-webhook-{jobs,mobility,property,wallet}
- [ ] Delete legacy agent functions: waiter-ai-agent, job-board-ai-agent, etc.
- [ ] Remove unused database columns (after data migration)
- [ ] Clean up old configuration files

### 5.2 Comprehensive Testing (Week 2)

- [ ] Unit tests for all pipeline components
- [ ] Integration tests for all 7 agents
- [ ] End-to-end tests for critical flows
- [ ] Load testing (100 concurrent users)
- [ ] Security testing (penetration testing)
- [ ] Run CodeQL security scan

### 5.3 Documentation & Deployment (Week 3)

- [ ] Update README.md with new architecture
- [ ] Document all APIs (OpenAPI spec)
- [ ] Create runbooks for common issues
- [ ] Train support team on new system
- [ ] Final production deployment
- [ ] Monitor for 1 week post-launch
- [ ] Celebrate! 🎉

---

## Risk Mitigation

### Production Safety

- **No Big Bang**: Gradual migration with feature flags
- **Backward Compatibility**: Old system runs alongside new
- **Monitoring**: Comprehensive logging, metrics, alerts
- **Rollback**: Easy feature flag toggles
- **Testing**: Extensive testing at every phase

### Data Safety

- **No Destructive Changes**: Additive schema changes only
- **Migrations**: Careful data migrations with backups
- **Transactions**: All multi-table updates use transactions
- **Audit Trail**: All changes logged

### Team Coordination

- **Code Reviews**: All PRs reviewed by 2+ engineers
- **Weekly Syncs**: Team alignment on progress
- **Pair Programming**: Complex components done in pairs
- **Documentation**: Keep architecture docs updated

---

## Success Metrics

### Technical Metrics

- [ ] Error rate < 0.5%
- [ ] P95 latency < 4s for webhook → reply
- [ ] Intent application success > 95%
- [ ] Test coverage > 80%
- [ ] Zero security vulnerabilities (CodeQL)

### Business Metrics

- [ ] No increase in support tickets
- [ ] User satisfaction maintained/improved
- [ ] Faster feature development (post-refactor)
- [ ] Improved agent response quality

---

## Timeline Summary

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: Foundation | 1 week | ✅ Complete |
| Phase 2: Unified Pipeline | 4 weeks | 🚧 Not Started |
| Phase 3: Profile Extraction | 3 weeks | ⏸️ Not Started |
| Phase 4: Agent Migration | 8 weeks | ⏸️ Not Started |
| Phase 5: Cleanup | 3 weeks | ⏸️ Not Started |
| **Total** | **19 weeks (~4.5 months)** | |

---

## Getting Started

1. **Review**: Read all architecture docs
2. **Team Meeting**: Assign phases to team members
3. **Setup**: Create feature flag infrastructure
4. **Spike**: Small proof-of-concept for pipeline
5. **Iterate**: Start Phase 2, task by task

---

**Document Owner**: EasyMO Engineering Team  
**Last Updated**: 2025-11-22  
**Next Review**: Weekly during active development
