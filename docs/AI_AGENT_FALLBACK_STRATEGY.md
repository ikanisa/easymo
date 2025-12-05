# AI Agent and WhatsApp Flow Coexistence Strategy

## Problem Statement

The EasyMO platform has **two parallel user interaction systems**:

1. **Traditional WhatsApp Flows** - Menu-driven navigation (numbered options)
2. **AI Agents** - Natural language conversations (emoji-numbered responses)

Both systems serve the same domains but with different UX patterns, creating potential conflicts.

## Resolution: AI Agents as Primary, Flows as Fallback

### Architecture Decision

**AI Agents are the primary interface**, with WhatsApp Flows maintained as a fallback mechanism.

### Why AI Agents First?

1. **Better UX**: Natural conversation vs rigid menu navigation
2. **More Flexible**: Can handle varied user inputs
3. **Scalable**: Same agent handles multiple scenarios
4. **Modern**: Aligns with conversational AI trends
5. **Efficient**: Reduces user friction and steps

### Fallback Scenarios

WhatsApp Flows activate in these cases:

| Scenario | Fallback Action | Example |
|----------|----------------|---------|
| AI Agent unavailable | Show traditional menu | Gemini API down → Show numbered menu |
| Feature flag disabled | Use flow-based navigation | `agent.rides = false` → Show "See Drivers" menu |
| User explicitly requests | Switch to menu mode | User: "show menu" → Display traditional options |
| Error threshold exceeded | Graceful degradation | 3 AI errors → Fall back to flows |
| Unsupported language | Use menu with translation | Language not in Gemini → Use i18n flows |

## Implementation Strategy

### 1. Feature Flags Control

All AI agents are controlled by feature flags in `_shared/feature-flags.ts`:

```typescript
const flags: Record<FeatureFlag, boolean> = {
  'agent.waiter': true,          // Enable Waiter AI
  'agent.rides': true,           // Enable Rides AI
  'agent.farmer': true,          // Enable Farmer AI
  'agent.jobs': true,            // Enable Jobs AI
  'agent.insurance': true,       // Enable Insurance AI
  'agent.real_estate': true,     // Enable Real Estate AI
  'agent.sales': true,           // Enable Sales AI
  'agent.business_broker': true, // Enable Business Broker AI
};
```

### 2. Router Logic

The WhatsApp webhook router checks feature flags before routing to AI agents:

```typescript
// In router/text.ts or ai_agent_handler.ts
const isAgentEnabled = await fetchFeatureFlag(`agent.${agentType}`);

if (isAgentEnabled) {
  // Route to AI agent
  return await runAgentHandler(ctx, agentType, query);
} else {
  // Fall back to traditional flow
  return await handleTraditionalFlow(ctx, flowType);
}
```

### 3. Graceful Degradation

When AI agents fail, automatically fall back to flows:

```typescript
export async function runWaiterAgent(ctx: RouterContext, query: string) {
  try {
    const agent = new WaiterAgent(ctx.supabase);
    const response = await agent.execute(query, { userId: ctx.from });
    await sendAgentResponse(ctx, response);
    return true;
  } catch (error) {
    console.error("WaiterAgent error:", error);
    
    // Increment error counter
    await trackAgentError(ctx, 'waiter');
    
    // Check if should fall back
    if (await shouldFallbackToFlow(ctx, 'waiter')) {
      // Fall back to traditional dine-in flow
      await sendText(ctx.from, "Let me show you our menu the traditional way...");
      await showTraditionalMenu(ctx);
      return true;
    }
    
    // Otherwise retry with simplified response
    await sendAgentMessage(ctx, '❌', 
      "I'm having trouble right now. Please try again in a moment."
    );
    return false;
  }
}
```

### 4. Error Tracking

Track agent errors to determine when to fall back:

```typescript
// In state/store.ts or similar
export async function trackAgentError(
  ctx: RouterContext, 
  agentType: string
): Promise<void> {
  const key = `agent_errors:${ctx.from}:${agentType}`;
  
  // Increment error count in Redis/state
  const errorCount = await incrementErrorCount(key);
  
  // Reset after 1 hour
  await setExpiry(key, 3600);
  
  // Log for monitoring
  await logStructuredEvent('AGENT_ERROR', {
    agentType,
    userId: ctx.from,
    errorCount,
    correlationId: ctx.correlationId
  });
}

export async function shouldFallbackToFlow(
  ctx: RouterContext,
  agentType: string
): Promise<boolean> {
  const key = `agent_errors:${ctx.from}:${agentType}`;
  const errorCount = await getErrorCount(key);
  
  // Fall back after 3 consecutive errors
  return errorCount >= 3;
}
```

## Migration Path

### Phase 1: Parallel Operation (Current)
- Both systems active
- Feature flags control which is primary
- Users can access either through menu

### Phase 2: AI Agent Priority (Target)
- AI agents handle all new conversations
- Flows available through explicit menu option
- Monitor AI success rates

### Phase 3: Full Migration (Future)
- AI agents fully replace flows for most use cases
- Flows deprecated for new features
- Maintain flows only for critical fallback

## User Experience Examples

### Example 1: Successful AI Agent Interaction

```
User: "I want a pizza"

AI Agent: 🍕 Found 3 pizza options:

1️⃣ Pizza Margherita - 5000 RWF
   Italian pizza, 30 min prep

2️⃣ Pepperoni Pizza - 6000 RWF
   Spicy pepperoni, 25 min

3️⃣ Vegetarian Special - 5500 RWF
   Fresh veggies, 30 min

[✅ Select] [🔍 Search Again] [🏠 Home]

User: "1"

AI Agent: ✅ You selected Pizza Margherita - 5000 RWF
How many would you like to order?

[1] [2] [3] [🔄 Change] [🏠 Home]
```

### Example 2: Fallback to Traditional Flow

```
User: "I want a pizza"

[AI Agent encounters error]

System: Let me show you our menu options:

1. See Restaurants
2. Order Food
3. Make Reservation
0. Home

Please reply with a number (1-3)
```

### Example 3: Explicit Menu Request

```
User: "show menu" or "menu"

System: 📱 Main Menu:

1️⃣ Rides & Transport
2️⃣ Food & Dining
3️⃣ Jobs
4️⃣ Real Estate
5️⃣ Insurance
6️⃣ Business Directory
7️⃣ Farming
8️⃣ Wallet
0️⃣ Settings

Reply with number or ask me anything!
```

## Monitoring & Observability

### Key Metrics

Track these metrics to determine AI agent health:

```typescript
// Agent usage metrics
metrics.increment('agent.invocation', 1, { agent: 'waiter', source: 'whatsapp' });
metrics.increment('agent.success', 1, { agent: 'waiter' });
metrics.increment('agent.fallback', 1, { agent: 'waiter', reason: 'error' });

// Response time
metrics.histogram('agent.response_time_ms', durationMs, { agent: 'waiter' });

// User satisfaction proxy
metrics.increment('agent.conversation.complete', 1, { agent: 'waiter' });
metrics.increment('agent.conversation.abandoned', 1, { agent: 'waiter' });
```

### Alerts

Set up alerts for:
- Agent error rate > 10%
- Fallback rate > 20%
- Response time > 5 seconds
- API quota exhaustion

## Configuration

### Environment Variables

```bash
# Feature flags override
FEATURE_AI_AGENTS_ENABLED=true

# Individual agent flags (optional overrides)
FEATURE_AGENT_WAITER=true
FEATURE_AGENT_RIDES=true
FEATURE_AGENT_FARMER=true
FEATURE_AGENT_JOBS=true
FEATURE_AGENT_INSURANCE=true
FEATURE_AGENT_REAL_ESTATE=true
FEATURE_AGENT_SALES=true
FEATURE_AGENT_BUSINESS_BROKER=true

# Fallback thresholds
AGENT_ERROR_THRESHOLD=3
AGENT_FALLBACK_DURATION_SECONDS=3600

# AI Provider Configuration
# ⚠️ MANDATORY MODELS: GPT-5 (OpenAI) and Gemini-3 (Google)
OPENAI_API_KEY=your_openai_key_here
GEMINI_API_KEY=your_gemini_key_here
# Models are automatically configured to use GPT-5 and Gemini-3
GEMINI_TIMEOUT_MS=10000
```

### Database Configuration

Feature flags can also be stored in database for dynamic control:

```sql
CREATE TABLE feature_flags (
  flag_name TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_for_users TEXT[], -- Optional: per-user rollout
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable AI agents
INSERT INTO feature_flags (flag_name, enabled) VALUES
  ('agent.waiter', true),
  ('agent.rides', true),
  ('agent.farmer', true),
  ('agent.jobs', true),
  ('agent.insurance', true),
  ('agent.real_estate', true),
  ('agent.sales', true),
  ('agent.business_broker', true);
```

## Testing Strategy

### Test Both Paths

Every feature must have tests for both AI agent and fallback flows:

```typescript
describe('Waiter Agent', () => {
  it('should handle pizza order via AI agent', async () => {
    await setFeatureFlag('agent.waiter', true);
    const response = await runWaiterAgent(ctx, 'I want pizza');
    expect(response).toContain('🍕');
    expect(response).toContain('1️⃣');
  });
  
  it('should fall back to traditional menu when agent disabled', async () => {
    await setFeatureFlag('agent.waiter', false);
    const response = await handleWaiterRequest(ctx, 'I want pizza');
    expect(response).toContain('1. See Restaurants');
  });
  
  it('should fall back after consecutive errors', async () => {
    await setFeatureFlag('agent.waiter', true);
    
    // Simulate 3 errors
    for (let i = 0; i < 3; i++) {
      await simulateAgentError(ctx, 'waiter');
    }
    
    const response = await runWaiterAgent(ctx, 'I want pizza');
    expect(response).toContain('traditional menu');
  });
});
```

## Rollout Plan

### Week 1: Internal Testing
- Enable all AI agents for staff numbers only
- Monitor error rates and user feedback
- Fix critical issues

### Week 2-3: Beta Rollout (10% of users)
- Randomly select 10% of users for AI agents
- Others continue with traditional flows
- Collect satisfaction metrics

### Week 4: Gradual Expansion (50% of users)
- Increase to 50% if metrics are positive
- Continue monitoring and optimization

### Week 5+: Full Rollout
- Enable for all users
- Keep flows as permanent fallback
- Deprecate old menu system from new features

## Benefits Summary

### For Users
- ✅ Natural conversation instead of rigid menus
- ✅ Faster task completion
- ✅ More flexible and forgiving input
- ✅ Visual emoji-enhanced responses
- ✅ Still works if AI fails (fallback)

### For Development Team
- ✅ Single agent handles multiple scenarios
- ✅ Easier to add new features
- ✅ Better error handling and recovery
- ✅ Clear migration path
- ✅ Gradual rollout with feature flags

### For Business
- ✅ Better user engagement
- ✅ Higher conversion rates
- ✅ Scalable to new domains
- ✅ Modern, competitive UX
- ✅ Lower support costs (better UX)

## Next Steps

1. ✅ Create chat interface utilities
2. ✅ Update all 8 agents with instructions
3. ⏳ Implement fallback logic in router
4. ⏳ Add error tracking and metrics
5. ⏳ Test all failure scenarios
6. ⏳ Document rollout procedures
7. ⏳ Train support team on both systems
8. ⏳ Begin internal testing
