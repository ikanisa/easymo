# EasyMO Agent Architecture Map

**Last Updated:** December 13, 2025  
**Status:** ✅ Production Ready - DEPLOYED (Rwanda Only)

## Executive Summary

EasyMO is a **WhatsApp-first platform** focused exclusively on the **Rwanda market**. The platform combines AI-powered natural language agents with workflow-based services.

### Top-Level Product Structure

**WhatsApp Home Menu (Workflows + AI):**

1. **Buy & Sell Agent** (AI) - Marketplace for products and business services (pharmacy, hardware, groceries, business discovery)
2. **Mobility Workflow** - Button-based ride booking and scheduling (no AI agent)
3. **Insurance Workflow** - Button-based insurance quotes and certificate management (no AI agent)
4. **Profile Service** - User profile management
5. **Wallet Service** - Mobile money integration (USSD-based)

**1 AI Agent + 2 Workflow Services + 2 Core Services = Complete Product**

### Removed Services (2025-12-13)

The following agents and services have been **permanently removed** from the platform:

- ❌ **Waiter Agent** - Restaurant/bar service (deleted)
- ❌ **Farmer Agent** - Agricultural marketplace (deleted)
- ❌ **Real Estate Agent** - Property listings (deleted)
- ❌ **Jobs Agent** - Job marketplace (deleted)
- ❌ **Sales SDR Agent** - Internal sales (deleted)
- ❌ **Support Agent** - Routing and help desk (deleted)

---

## Architectural Principles

### 1. One Shared WhatsApp Pipeline

All agents use the same normalized data flow:

```
WhatsApp Message → whatsapp_users
                 → whatsapp_conversations
                 → whatsapp_messages
                 → ai_agent_intents
                 → ai_agent_match_events
```

**Tables:**

- `whatsapp_users` - Normalized WhatsApp user registry
- `whatsapp_conversations` - Active conversation contexts
- `whatsapp_messages` - Message history with correlation IDs
- `ai_agent_intents` - Parsed user intentions
- `ai_agent_match_events` - Match/notification triggers

### 2. Unified AI Agent Abstraction

The Buy & Sell agent is defined using the standard agent structure:

```
ai_agents (master registry)
  ↓
ai_agent_personas (tone, languages)
  ↓
ai_agent_system_instructions (prompts, guardrails)
  ↓
ai_agent_tools (registered functions)
  ↓
ai_agent_tasks (named actions)
  ↓
ai_agent_knowledge_bases (data sources)
```

### 3. Standard Agent Pattern

**The Buy & Sell agent follows this flow:**

1. **Natural Language Input** → Creates `ai_agent_intents` row
2. **Apply Intent Function** → Updates domain tables (products, vendors, transactions, etc.)
3. **Agent Response** → Short message + emoji-numbered options (1️⃣ 2️⃣ 3️⃣)

**Domain updates happen via:**

- Database queries and inserts
- Semantic search (pgvector where applicable)
- Match events for notifications

**Response format:**

- Very short messages (1-2 sentences max)
- Emoji-numbered options to minimize typing
- Optional WhatsApp interactive buttons/lists
- Compact, contextual results

---

## Agent Details

### Buy & Sell Agent 🛒

**Category:** Marketplace  
**Purpose:** Product listings, business discovery, vendor matching, marketplace transactions

**Files:**

- Edge Function: `supabase/functions/buy-sell-agent/`
- Database: Buy/sell tables in main schema

**Domain Tables:**

- `marketplace_products` - Product listings
- `marketplace_vendors` - Vendor/business directory
- `marketplace_categories` - Product/service taxonomy
- `marketplace_transactions` - Purchase history
- `marketplace_inquiries` - Interest tracking

**Intent Types:**

- `search_product` - Find products/services by criteria
- `view_vendor` - Get details for specific business
- `make_inquiry` - Express purchase interest
- `browse_category` - Explore product categories

**Example Flow:**

```
User: "I need medicine near Kicukiro"
→ Intent: search_product { category: "pharmacy", location: "Kicukiro" }
→ Query: marketplace_vendors WHERE category = 'pharmacy' AND district = 'Kicukiro'
→ Response: "Found 2 pharmacies:
            1️⃣ MediPlus Pharmacy - 800m, Open till 9pm
            2️⃣ City Pharmacy - 1.2km, 24/7"
```

**Key Features:**

- Natural language product search
- Business/vendor discovery
- Category browsing (pharmacy, hardware, groceries, etc.)
- Location-based search
- Multi-language support (English, French, Kinyarwanda comprehension)

---

## Workflow Services (Non-AI)

### Mobility Service 🚗

**Type:** Button-based workflow (no AI agent)  
**Purpose:** Ride booking and scheduling

**Features:**
- Interactive button menus
- Location selection
- Driver matching
- Trip tracking
- Payment integration

### Insurance Service 🛡️

**Type:** Button-based workflow (no AI agent)  
**Purpose:** Insurance quotes and certificate management

**Features:**
- Quote requests via buttons
- Certificate uploads
- Policy management
- Admin notifications


---

## File Structure Map

### Core Infrastructure

#### WhatsApp Pipeline

```
supabase/functions/wa-webhook/
├── index.ts                    # Main webhook handler
├── router.config.ts            # Feature toggles & templates
└── function.json

supabase/functions/buy-sell-agent/
├── index.ts                    # Buy & Sell AI agent
└── function.json

supabase/functions/_shared/
├── agent-orchestrator.ts       # Agent routing & execution
├── observability.ts            # Structured logging
└── whatsapp-client.ts          # Message sending
```

#### Database Schema

```
supabase/migrations/
├── 20251122073000_ai_agent_ecosystem_schema.sql      # Core agent tables
├── 20251122073100_seed_ai_agents_complete.sql        # Agent definitions (updated)
├── 20251213_delete_obsolete_agents.sql               # Remove waiter/farmer/jobs/real estate/sdr/support
└── [mobility and insurance migrations]               # Workflow-based services
```

### Legacy Code Status

#### ✅ Active (Current services)

- `buy-sell-agent` → Buy & Sell AI agent
- `wa-webhook-mobility` → Mobility workflows (button-based, no AI)
- `wa-webhook-insurance` → Insurance workflows (button-based, no AI)

#### ❌ Deleted (Removed 2025-12-13)

- ~~`wa-webhook-jobs`~~ → Jobs agent (deleted)
- ~~`wa-webhook-marketplace`~~ → Business Broker agent (deleted)
- ~~`wa-webhook-property`~~ → Real Estate agent (deleted)
- ~~`waiter-ai-agent`~~ → Waiter agent (deleted)
- ~~`farmer-ai-agent`~~ → Farmer agent (deleted)
- ~~`sales-sdr-agent`~~ → Sales SDR agent (deleted)
- ~~`support-agent`~~ → Support agent (deleted)

#### 🔒 Keep (Core utilities)

- `supabase/functions/_shared/` - Shared libraries
- `admin-app/` - Admin dashboard
- Profile/Wallet modules

---

## Data Flow Architecture

### Standard Request-Response Cycle

```
┌─────────────────────────────────────────────────────────────┐
│ 1. WhatsApp Message Arrives                                 │
│    POST /wa-webhook-core                                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Normalize & Store                                         │
│    - Insert whatsapp_users                                   │
│    - Insert whatsapp_conversations                           │
│    - Insert whatsapp_messages                                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Route to Agent                                            │
│    AgentOrchestrator.processMessage()                        │
│    - Check menu choice / context                             │
│    - Load ai_agents row                                      │
│    - Load persona, system instructions                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Parse Intent                                              │
│    - Call OpenAI/Gemini with agent config                    │
│    - Extract intent_type + params                            │
│    - Insert ai_agent_intents (status: "pending")             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Apply Intent                                              │
│    apply_intent_{agent_name}(intent_id, user_id, ...)        │
│    - Query/update domain tables                              │
│    - Run semantic search (if applicable)                     │
│    - Create matches → ai_agent_match_events                  │
│    - Update intent status: "applied"                         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Generate Response                                         │
│    - Agent reads DB results                                  │
│    - Format short message + emoji options                    │
│    - Send via WhatsApp Business API                          │
│    - Store response in whatsapp_messages                     │
└─────────────────────────────────────────────────────────────┘
```

### Personalization Strategy

**Per-User Profile (Shared across all agents):**

- Saved locations (Home, Work, favorites)
- Language preference
- Owned entities (businesses, vehicles, properties, etc.)

**Per-Agent "Taste" Model:**

- Waiter: cuisines liked, typical spend
- Rides: usual routes, preferred vehicle type
- Real Estate: budget bands, location types
- Jobs: skills, job categories, pay expectations

**Implementation:**

- Agent system instructions include: _"Always retrieve this user's profile before asking questions.
  If you can safely infer the answer from history, do it."_
- Result: **Agents ask fewer questions over time**

---

## Conversation UX Rules (All Agents)

### 1. Short Messages Only

- 1-2 sentences max
- No essays

### 2. Always Give Immediate Options

Every message ends with:

- Emoji-numbered options (1️⃣ 2️⃣ 3️⃣)
- Or clear single action (✅ Confirm / ❌ Cancel)

### 3. Always Show Context in Lists

Bad:

```
1. Property A
2. Property B
```

Good:

```
1️⃣ 2BR in Kicukiro – 350k – available Dec 1
2️⃣ 2BR in Kanombe – 380k – available now
```

### 4. One Intent Per Turn

If user says three things at once, agent picks the main one and clarifies.

### 5. Prediction, Not Just Reaction

Use past behavior to pre-fill likely values:

```
"You usually go from Home to Work at 8am.
 1️⃣ Do that again
 2️⃣ Change time
 3️⃣ New route"
```

**Enforcement:** These rules are codified in `ai_agent_system_instructions` for all agents.

---

## Testing & Validation

### Integration Tests

Located in: `tests/agents/`

**Coverage:**

- ✅ Waiter agent: Browse bars, view menu, place order
- ✅ Farmer agent: List produce, search, match buyers
- ✅ Business Broker: Find services, save favorites
- ✅ Real Estate: Search properties, list property, inquire
- ✅ Jobs: Search jobs, post job, apply
- ✅ Support: Route requests, escalate

### End-to-End Flow Tests

```bash
# Test full webhook → agent → DB → reply cycle
pnpm test:agents

# Test specific agent
pnpm test:agent:waiter
```

### Staging Validation

```bash
# Deploy to staging
./deploy-to-staging.sh

# Run smoke tests
./test-webhook-workflow.sh
```

---

## Migration Status

### ✅ Phase 1: Core Infrastructure (Complete)

- [x] AI agent ecosystem schema
- [x] WhatsApp pipeline normalization
- [x] Agent orchestrator implementation
- [x] Seed agent definitions

### ✅ Phase 2: Agent Migration (Complete - 8/8)

- [x] Waiter agent
- [x] Farmer agent
- [x] Business Broker agent
- [x] Real Estate agent
- [x] Jobs agent
- [x] Sales SDR agent
- [x] Rides agent
- [x] Insurance agent

### ✅ Phase 3: Profile & Wallet Isolation (Complete)

- [x] Extract Profile module
- [x] Implement "My Stuff" views
- [x] Saved Locations integration
- [x] Wallet/Tokens CRUD APIs

### 🔄 Phase 4: Legacy Cleanup (In Progress)

- [ ] Remove old webhook handlers
- [ ] Delete wizard-style flows
- [ ] Archive unused components
- [ ] Clean up domain services

### 📋 Phase 5: Production Rollout (Pending)

- [ ] Deploy to staging
- [ ] Enable feature flags gradually
- [ ] Monitor metrics
- [ ] Full traffic cutover
- [ ] Remove feature flags

---

## Feature Flags

**Location:** `supabase/functions/wa-webhook-core/router.ts`

```typescript
featureToggles: {
  listingAlerts: false,      // Proactive notifications
  buyerMatches: false,       // Auto-match triggers
  paymentReminders: false,   // Payment follow-ups
}
```

**Rollout Strategy:**

1. Deploy with flags OFF
2. Test on staging
3. Enable for 10% users
4. Monitor error rates & latency
5. Gradual ramp to 100%
6. Remove flags after 2 weeks stable

---

## Observability & Monitoring

### Structured Logging

All events logged as JSON with correlation IDs:

```typescript
await logStructuredEvent("USER_CREATED", {
  userId,
  method: "whatsapp",
  correlationId,
});
```

### Key Metrics

- `agent.request.count` - Requests per agent
- `agent.intent.parse.duration` - LLM latency
- `agent.intent.apply.duration` - DB operation time
- `agent.response.success_rate` - Reply delivery %

### Error Tracking

- Failed intent parsing → Retry with simpler prompt
- DB errors → Log + return graceful fallback
- WhatsApp API errors → Queue for retry

**Dashboard:** Admin panel shows real-time agent health.

---

## Next Steps

### Immediate (Week 1)

1. **Deploy to staging** (30 min)

   ```bash
   ./deploy-to-staging.sh
   ```

2. **Enable feature flag** (5 min)
   - Set `featureToggles.agentMode: true` for test users

3. **Smoke test all agents** (1 hour)
   - Send test messages for each of 7 agents
   - Verify intent parsing + DB updates + responses

### Short-term (Week 2-3)

4. **Enhance apply_intent functions**
   - Add real semantic search (pgvector)
   - Optimize queries with proper indexes
   - Add match notification triggers

5. **Gradual rollout**
   - 10% users → 25% → 50% → 100%
   - Monitor error rates daily

6. **Legacy cleanup**
   - Archive old webhook handlers
   - Remove unused domain services
   - Update documentation

### Long-term (Month 2+)

7. **Advanced personalization**
   - Train per-user preference models
   - Implement "taste vectors" for better matching
   - Add conversation memory (last 10 messages)

8. **Multi-modal support**
   - Voice messages (speech-to-text)
   - Image understanding (property photos, docs)
   - Location-aware suggestions

9. **Performance optimization**
   - Cache common queries
   - Pre-compute match candidates
   - Background intent processing for slow operations

---

## Success Metrics

**Before Refactor:**

- 12+ separate webhook handlers
- Hard-coded conversation flows
- No shared agent framework
- ~3000+ lines of duplicated logic

**After Refactor:**

- 1 unified webhook handler
- 7 agents using identical pattern (mobility/insurance moved to workflows)
- ~90% code reduction in agent logic
- Standard, testable, maintainable

**User Experience:**

- Faster responses (intent caching)
- Fewer questions asked (personalization)
- Consistent UX across all services
- Clear, emoji-numbered options

---

## Conclusion

The EasyMO refactor successfully transforms a complex, feature-sprawled system into a **clean,
boringly-standard, WhatsApp-first platform** powered by AI agents.

**Key Achievements:** ✅ Single standard for all agents  
✅ No more per-feature spaghetti code  
✅ Easy to extend (just add new agent + intent functions)  
✅ Easy to debug (all messages go through same pipeline)  
✅ Easy to reason about (Profile only mirrors what agents manage)

**Maintenance Burden:**

- **Before:** Add new feature = new webhook + new flows + new DB logic
- **After:** Add new feature = new agent row + new intent function

This is the foundation for world-class conversational commerce on WhatsApp.

---

**Document Maintainer:** Architecture Team  
**Last Updated:** 2025-11-22  
**Next Review:** 2025-12-01
