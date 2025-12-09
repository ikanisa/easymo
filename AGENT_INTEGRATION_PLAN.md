# WhatsApp Agent Production Integration Plan

**Date**: 2025-12-09  
**Goal**: Integrate all AI agents with wa-webhook-core and separate them from WhatsApp workflows

## Current Status

### ✅ Already Integrated
- `wa-webhook-core` - Main routing hub
- `wa-webhook-buy-sell` - Buy/Sell workflow (has embedded AI - needs separation)
- `wa-webhook-property` - Property workflow  
- `wa-webhook-jobs` - Jobs workflow
- `wa-webhook-waiter` - Waiter workflow
- `wa-agent-waiter` - Waiter AI agent (registered)
- `wa-agent-farmer` - Farmer AI agent (registered)
- `wa-agent-support` - Support AI agent (registered)
- `wa-agent-call-center` - Call center AI agent (registered)

### ⚠️ Needs Integration
1. **agent-property-rental** - Not in route-config.ts
2. **wa-webhook-buy-sell AI separation** - AI agent mixed with workflow
3. **Production deployment** - All agents need deployment verification

## Integration Tasks

### Task 1: Add agent-property-rental to Routing
**File**: `supabase/functions/_shared/route-config.ts`

Add to `ROUTING_CONFIG`:
```typescript
{
  service: "agent-property-rental",
  keywords: ["property", "rental", "rent", "house", "apartment", "lease"],
  menuKeys: ["property_agent", "rental_agent", "property"],
  priority: 2,
}
```

Add to `ROUTED_SERVICES`:
```typescript
"agent-property-rental",
```

Add to `STATE_SERVICE_PATTERNS`:
```typescript
{ patterns: ["property_agent_", "rental_agent_"], service: "agent-property-rental" },
```

### Task 2: Separate Buy/Sell AI Agent from Workflow
**Current**: wa-webhook-buy-sell has both workflow AND AI agent mixed
**Goal**: Strict separation

**Option A**: Create new `agent-buy-sell` function
**Option B**: Use feature flag to switch between workflow/agent modes in wa-webhook-buy-sell

**Recommendation**: Option A for clean separation

### Task 3: Verify Agent Endpoints
All agents must follow pattern:
```
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/{agent-name}
```

Verify:
- ✅ `agent-property-rental` 
- ✅ `wa-webhook-property`
- ✅ `wa-webhook-jobs`
- ⚠️ `wa-webhook-waiter` vs `wa-agent-waiter` (name conflict?)

### Task 4: Update wa-webhook-core Router
Ensure router correctly routes to:
- WhatsApp workflows for structured interactions
- AI agents for conversational mode

### Task 5: Add Observability (GROUND_RULES)
All agents must have:
- Structured logging with correlation IDs
- Event metrics
- PII masking
- Health checks

## Directory Structure

```
supabase/functions/
├── wa-webhook-core/           # Main router
├── _shared/
│   ├── route-config.ts        # ⚠️  UPDATE: Add agent-property-rental
│   └── ...
├── wa-webhook-buy-sell/       # Buy/Sell workflow (no AI)
├── agent-buy-sell/            # 🆕 Buy/Sell AI agent (NEW)
├── wa-webhook-property/       # Property workflow
├── agent-property-rental/     # Property AI agent
├── wa-webhook-jobs/           # Jobs workflow
├── agent-jobs/                # 🆕 Jobs AI agent (if needed)
├── wa-webhook-waiter/         # Waiter workflow
└── wa-agent-waiter/           # Waiter AI agent
```

## Strict Separation Rules

### WhatsApp Workflows (wa-webhook-*)
- Menu-driven interactions
- Button-based navigation
- List selections
- Quick replies
- Structured data collection

### AI Agents (agent-* or wa-agent-*)
- Natural language conversations
- OpenAI integration
- Context-aware responses
- Learning from interactions
- NO menu systems

### Integration Point
`wa-webhook-core` routes based on:
1. User preference (workflow vs agent)
2. Keywords/menu selection
3. Session state
4. Feature flags

## Implementation Order

1. ✅ Add `agent-property-rental` to route-config.ts
2. ✅ Create `agent-buy-sell` function (separate from workflow)
3. ✅ Update ROUTED_SERVICES list
4. ✅ Deploy all agents to production
5. ✅ Add observability to all agents
6. ✅ Test routing from wa-webhook-core
7. ✅ Add feature flags for agent/workflow switching

## Testing Checklist

- [ ] agent-property-rental responds to keywords
- [ ] agent-buy-sell separate from wa-webhook-buy-sell
- [ ] wa-webhook-core routes correctly
- [ ] All agents have health checks
- [ ] Observability working (logs, metrics)
- [ ] No PII in logs
- [ ] Feature flags working
- [ ] Production URLs working

## Production URLs

```
# Core Router
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core

# Workflows
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-buy-sell
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-property
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-jobs
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-waiter

# AI Agents
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/agent-property-rental
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/agent-buy-sell (NEW)
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-agent-waiter
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-agent-support
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-agent-farmer
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-agent-call-center
```

---

**Next**: Execute integration updates
