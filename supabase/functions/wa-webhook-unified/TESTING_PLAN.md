# Phase 3: Integration & Testing Plan

## Overview
Complete integration testing, feature flag setup, and production readiness for unified AI agent service.

---

## 1. Cross-Domain Integration

### Agent Handoffs ✅
**Implementation:**
- Agents can request handoff via `handoffTo` in response
- Orchestrator handles seamless in-memory switching
- Session updates to track agent changes

**Test Scenarios:**
```
Marketplace → Jobs: "I'm selling furniture" → "Actually, I need a job"
Jobs → Property: "Looking for work" → "I need a place to live"
Property → Marketplace: "Need apartment" → "Also selling my furniture"
```

### Unified Search
**Features:**
- Search across all domains (products, jobs, properties, produce)
- Single query returns relevant results from multiple agents
- Ranked by relevance and proximity

**Implementation:**
```sql
-- Unified search function
CREATE FUNCTION unified_search(
  search_term TEXT,
  user_lat NUMERIC,
  user_lng NUMERIC,
  domains TEXT[]
) RETURNS TABLE (...)
```

### Shared User Preferences
**Features:**
- Saved locations (home, work)
- Preferred categories
- Budget ranges
- Communication preferences

**Schema:**
```sql
CREATE TABLE user_preferences (
  user_phone TEXT PRIMARY KEY,
  saved_locations JSONB,
  preferred_categories TEXT[],
  budget_ranges JSONB,
  preferences JSONB
);
```

---

## 2. Feature Flags

### Configuration Levels
1. **Global**: `unifiedServiceEnabled` (on/off switch)
2. **Rollout**: `rolloutPercent` (0-100%)
3. **Per-Agent**: Individual agent enable/disable
4. **Per-Feature**: Specific feature toggles

### Rollout Strategy
```
Week 1: 1% (canary)
Week 2: 10% (early adopters)
Week 3: 50% (half traffic)
Week 4: 100% (full rollout)
```

### Rollback Plan
- Monitor error rates, latency, user complaints
- If issues detected: reduce rollout % or disable
- Legacy services remain deployed during transition
- Can rollback in <5 minutes

---

## 3. Testing Strategy

### Unit Tests
**Coverage:**
- Each agent's `process()` method
- Tool execution functions
- Flow state management
- Intent classification

**Example:**
```typescript
Deno.test("MarketplaceAgent: create listing", async () => {
  const agent = new MarketplaceAgent(deps);
  const result = await agent.executeTool("create_listing", {...});
  assertEquals(result.success, true);
});
```

### Integration Tests
**Coverage:**
- Orchestrator routing
- Session management
- Agent handoffs
- Database operations

**Example:**
```typescript
Deno.test("Orchestrator: route to correct agent", async () => {
  const orchestrator = new UnifiedOrchestrator(supabase);
  await orchestrator.processMessage(message, correlationId);
  // Verify correct agent was selected
});
```

### E2E Tests
**Scenarios:**
1. Complete job search flow
2. Complete property listing flow
3. Cross-domain handoff
4. Session persistence
5. Multi-step conversations

**Files:**
- [e2e.test.ts](file:///Users/jeanbosco/workspace/easymo-/supabase/functions/wa-webhook-unified/__tests__/e2e.test.ts)

### Load Testing
**Metrics:**
- Concurrent users: 100, 500, 1000
- Messages per second: 10, 50, 100
- Response time: p50, p95, p99
- Error rate: <0.1%

**Tools:**
- k6 or Artillery for load generation
- Monitor database connections
- Track memory usage

### Backward Compatibility Tests
**Verify:**
- Legacy views return correct data
- Existing queries still work
- No breaking changes to API contracts

---

## 4. Observability

### Metrics Dashboard
**Key Metrics:**
- Messages processed per agent
- Average response time
- Error rates by agent
- Session creation/completion rates
- Agent handoff frequency
- Flow completion rates

### Logging
**Structured Events:**
- `ORCHESTRATOR_PROCESSING`
- `ORCHESTRATOR_AGENT_SWITCH`
- `ORCHESTRATOR_HANDOFF`
- `AGENT_FLOW_START`
- `AGENT_FLOW_COMPLETE`
- `AGENT_TOOL_EXECUTION`

### Alerting
**Thresholds:**
- Error rate > 1%
- Response time p95 > 3s
- Database connection pool > 80%
- Session creation failures

---

## 5. Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Database migration applied
- [ ] Environment variables configured
- [ ] Feature flags set to 0%
- [ ] Monitoring dashboards ready
- [ ] Rollback plan documented

### Deployment Steps
1. Apply database migration
2. Deploy unified service (disabled)
3. Smoke test health endpoint
4. Enable at 1% rollout
5. Monitor for 24 hours
6. Gradually increase rollout

### Post-Deployment
- [ ] Monitor error rates
- [ ] Check latency metrics
- [ ] Verify session creation
- [ ] Test agent handoffs
- [ ] Collect user feedback

---

## 6. Success Criteria

### Performance
- ✅ Response time p95 < 2s
- ✅ Error rate < 0.5%
- ✅ Session creation success > 99%
- ✅ Agent handoff < 5ms

### Functionality
- ✅ All 10 agents working
- ✅ Hybrid flows functioning
- ✅ Cross-domain handoffs smooth
- ✅ Session persistence reliable

### User Experience
- ✅ No user-reported regressions
- ✅ Faster response times
- ✅ Seamless agent switching
- ✅ Context maintained across messages

---

## 7. Risk Mitigation

### Identified Risks
1. **Performance degradation** → Load testing, monitoring
2. **Data migration issues** → Backward-compatible views
3. **Agent routing errors** → Comprehensive testing
4. **Session state bugs** → Unit tests, E2E tests

### Mitigation Strategies
- Feature flags for quick rollback
- Legacy services remain deployed
- Gradual rollout (1% → 100%)
- 24/7 monitoring during rollout
- On-call engineer during deployment

---

## Timeline

**Week 4 (Current):**
- Day 1-2: Testing implementation
- Day 3-4: Feature flags & monitoring
- Day 5: Deployment preparation

**Week 5: Rollout**
- Day 1: Deploy at 1%
- Day 2-3: Monitor, increase to 10%
- Day 4: Increase to 50%
- Day 5: Increase to 100%
- Day 6-7: Deprecate legacy services
