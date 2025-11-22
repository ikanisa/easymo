# EasyMO Agent Architecture Map

**Status**: Phase 1 - Inventory & Mapping  
**Last Updated**: 2025-11-22  
**Purpose**: Comprehensive mapping of codebase to new WhatsApp-first AI agent architecture

---

## Overview

This document maps all existing flows, handlers, and domain modules to the new 9-item WhatsApp Home Menu structure.

### New WhatsApp Home Menu (Target Architecture)

1. **Waiter Agent** - Restaurant/bar ordering via AI
2. **Farmer Agent** - Agricultural produce marketplace
3. **Business Broker Agent** - Business buying/selling
4. **Real Estate Agent** - Property rental/sales
5. **Jobs Agent** - Job seeking/posting
6. **Sales SDR Agent** - Cold calling/lead generation
7. **Rides Agent** - Transportation/mobility
8. **Insurance Agent** - Insurance policies/quotes
9. **Profile** - Non-agent workflows (QR, Wallet, Tokens, My Stuff, Saved Locations)

---

## Current State Summary

- **Edge Functions**: ~70 Supabase edge functions
- **Microservices**: 12 NestJS/Node services
- **Packages**: 16 shared packages
- **Migrations**: 536 SQL migration files
- **Agent Tables**: ✅ Already exist in schema
- **WhatsApp Tables**: ✅ Already exist in schema
- **Webhook Handlers**: ⚠️ 7 separate handlers need consolidation

---

## WhatsApp Webhook Handlers (Need Consolidation)

Current state has **7 separate webhook handlers** that need to be consolidated into a single unified pipeline:

1. **wa-webhook** - Main handler with domains/, flows/, router/
2. **wa-webhook-core** - Core routing logic
3. **wa-webhook-jobs** - Jobs-specific
4. **wa-webhook-mobility** - Rides/mobility-specific
5. **wa-webhook-property** - Property-specific  
6. **wa-webhook-wallet** - Wallet-specific
7. **wa-webhook-ai-agents** - AI agent routing config

**Target**: Single `wa-webhook` handler that:
- Normalizes all WhatsApp events
- Detects active agent from context
- Routes to unified agent runtime
- Stores intents in `ai_agent_intents` table
- Calls `applyIntent` service to update domain tables

---

## Agent Mapping Details

### 1. Waiter Agent 🍽️

**Domain**: Restaurant/bar ordering

**Existing Assets**:
- Functions: `waiter-ai-agent/`, `bars-lookup/`
- Tables: `bars`, `bar_numbers`, `menus`, `menu_items`, `orders`
- Docs: `WAITER_AI_IMPLEMENTATION_COMPLETE.md`

**Status**: ✅ Partial - Agent implemented, needs consolidation into central pipeline

**Migration Tasks**:
- [ ] Consolidate waiter-ai-agent into wa-webhook
- [ ] Define agent config (personas, system instructions, tools, tasks)
- [ ] Update system instructions for WhatsApp-first UX (concise, emoji-numbered)
- [ ] Migrate bar lookup to agent tools
- [ ] Test end-to-end: WhatsApp → intent → order → DB

---

### 2. Farmer Agent 🌾

**Domain**: Agricultural produce marketplace

**Existing Assets**:
- Tables: `produce_listings`, `farmers`, `farmer_profiles`
- Docs: `FARMER_AGENT_*.md` files

**Status**: ⚠️ Needs migration to unified framework

**Migration Tasks**:
- [ ] Define agent config (personas, system instructions, tools, tasks)
- [ ] Create agent tools for produce search/matching
- [ ] Implement WhatsApp flows for listing creation/search
- [ ] Set up knowledge base pointing to produce tables
- [ ] Migrate legacy flows to intent-based system

---

### 3. Business Broker Agent 💼

**Domain**: Business buying/selling, general commerce

**Existing Assets**:
- Functions: `agent-tools-general-broker/`, `business-lookup/`, `classify-business-tags/`, `ingest-businesses/`
- Services: `broker-orchestrator/`, `buyer-service/`, `vendor-service/`
- Tables: `businesses`, `business_profiles`, `business_listings`
- Docs: `GENERAL_BROKER_*.md`, `BUSINESS_DIRECTORY_*.md`

**Status**: ✅ Significant infrastructure exists, needs WhatsApp integration

**Migration Tasks**:
- [ ] Consolidate broker tools into central agent framework
- [ ] Define WhatsApp-first conversation flows
- [ ] Update system instructions for concise messaging
- [ ] Integrate broker-orchestrator with intent system
- [ ] Test business search/matching via WhatsApp

---

### 4. Real Estate Agent 🏠

**Domain**: Property rental/sales

**Existing Assets**:
- Functions: `agent-property-rental/`, `wa-webhook-property/`
- Tables: `properties`, `property_listings`, `landlords`, `rental_applications`
- Docs: `real_estate_agent_*.md`, `PROPERTY_RENTAL_DEEP_SEARCH.md`

**Status**: ✅ Partial - Active development, needs consolidation

**Migration Tasks**:
- [ ] Consolidate property webhooks into central wa-webhook
- [ ] Update agent config for WhatsApp-first UX
- [ ] Migrate property search to agent tools
- [ ] Ensure semantic search integration
- [ ] Test property shortlisting via WhatsApp

---

### 5. Jobs Agent 💼

**Domain**: Job seeking/posting

**Existing Assets**:
- Functions: `job-board-ai-agent/`, `wa-webhook-jobs/`, `job-sources-sync/`
- Tables: `job_posts`, `job_seekers`, `job_applications`, `job_matches`
- Docs: `JOB_BOARD_*.md` files (extensive)

**Status**: ✅ Well-developed, needs integration with central pipeline

**Migration Tasks**:
- [ ] Consolidate job webhooks into central wa-webhook
- [ ] Update system instructions for WhatsApp-first
- [ ] Ensure job matching uses ai_agent_match_events
- [ ] Migrate job application flow to intent system
- [ ] Test end-to-end job search/apply via WhatsApp

---

### 6. Sales SDR Agent 📞

**Domain**: Cold calling, lead generation

**Existing Assets**:
- Functions: `agent-negotiation/` (possibly), `campaign-dispatcher/`, `ai-contact-queue/`
- Services: `agent-core/` (contains lead management)
- Tables: `leads`, `campaigns`, `call_logs` (Agent-Core DB)

**Status**: ⚠️ Needs significant work - newer agent

**Migration Tasks**:
- [ ] Define full agent config from scratch
- [ ] Create WhatsApp-first cold calling flows
- [ ] Integrate voice-bridge for actual calls
- [ ] Set up lead scoring and matching
- [ ] Implement conversation-to-call handoff

---

### 7. Rides Agent 🚗

**Domain**: Transportation/mobility, trip scheduling

**Existing Assets**:
- Functions: `agent-schedule-trip/`, `wa-webhook-mobility/`, `recurring-trips-scheduler/`, `vehicle-ocr/`
- Tables: `trips`, `drivers`, `driver_presence`, `vehicles`, `stations`
- Docs: `RIDES_*.md` files

**Status**: ✅ Partial - Critical service, needs consolidation

**Migration Tasks**:
- [ ] Consolidate mobility webhooks into central wa-webhook
- [ ] Update agent config for WhatsApp-first
- [ ] Migrate trip scheduling to intent system
- [ ] Ensure driver matching uses ai_agent_match_events
- [ ] Test trip booking/tracking via WhatsApp

---

### 8. Insurance Agent 🛡️

**Domain**: Insurance policies/quotes

**Existing Assets**:
- Functions: `insurance-ocr/`, `send-insurance-admin-notifications/`
- Tables: `insurance_policies`, `insurance_quotes`, `insurance_claims`
- Docs: `INSURANCE_*.md`, `RIDES_INSURANCE_AGENTS_COMPLETE.md`

**Status**: ⚠️ Early stage - needs significant work

**Migration Tasks**:
- [ ] Define full agent config
- [ ] Create WhatsApp-first insurance flows
- [ ] Set up quote matching system
- [ ] Integrate OCR as agent tool
- [ ] Implement policy management via WhatsApp

---

### 9. Profile (Non-Agent Workflows) 👤

**Domain**: User profile, wallet, tokens, saved data

**Existing Assets**:
- Functions: `momo-*`, `revolut-*`, `qr-*`, `wa-webhook-wallet/`, `admin-*`
- Tables: `profiles`, `wallets`, `tokens`, `transactions`, `saved_locations`, `user_preferences`
- Apps: `admin-app/` (Next.js)

**Components**:
1. **MoMo QR Code**: View/manage personal QR
2. **Wallet & Tokens**: Balance, history, earn/use/cash-out  
3. **My Stuff**:
   - My Businesses (→ Business Broker)
   - My Vehicles (→ Rides)
   - My Properties (→ Real Estate)
   - My Jobs (→ Jobs)
   - My Listings (→ Farmer)
   - My Insurance Policies (→ Insurance)
   - My Trips (→ Rides)
4. **Saved Locations**: Home, Work, Favorites (used by all agents)

**Migration Tasks**:
- [ ] Extract wallet/QR logic to dedicated module
- [ ] Ensure Profile APIs are pure CRUD (no agent logic)
- [ ] Create "My Stuff" aggregation views
- [ ] Implement agent helper endpoints for profile access
- [ ] Keep admin-* functions separate (staff tools)

---

## Database Schema Status

### ✅ Core Agent Tables (Already Exist)
- `ai_agents` - Agent registry (8 agents)
- `ai_agent_personas` - Agent personalities/tone
- `ai_agent_system_instructions` - System prompts/guardrails
- `ai_agent_tools` - Tool definitions (DB, HTTP, Maps, etc.)
- `ai_agent_tasks` - High-level agent tasks
- `ai_agent_knowledge_bases` - Knowledge base registry
- `ai_agent_intents` - Parsed user intents (**core of new system**)
- `ai_agent_match_events` - Matching events (job ↔ seeker, driver ↔ rider, etc.)

### ✅ WhatsApp Tables (Already Exist)
- `whatsapp_users` - All WhatsApp users (phone is primary ID)
- `whatsapp_conversations` - User × Agent × Context threads
- `whatsapp_messages` - Raw inbound/outbound messages

### ⚠️ Domain Tables (Need Audit)
Review for unused columns, align with intent system:
- Waiter: `bars`, `bar_numbers`, `menus`, `menu_items`, `orders`
- Farmer: `produce_listings`, `farmers`
- Broker: `businesses`, `business_profiles`
- Real Estate: `properties`, `property_listings`, `landlords`
- Jobs: `job_posts`, `job_seekers`, `job_applications`, `job_matches`
- Rides: `trips`, `drivers`, `driver_presence`, `vehicles`, `stations`
- Insurance: `insurance_policies`, `insurance_quotes`, `insurance_claims`
- Profile: `profiles`, `wallets`, `tokens`, `transactions`, `saved_locations`

---

## Legacy Code for Deprecation

### High Priority (Remove After Migration)
1. ❌ **Separate webhook handlers**: wa-webhook-jobs, wa-webhook-mobility, wa-webhook-property, wa-webhook-wallet
   - Route through central wa-webhook instead
   
2. ❌ **Legacy agent functions**: waiter-ai-agent, job-board-ai-agent, agent-property-rental, agent-schedule-trip
   - Replace with unified agent framework
   
3. ❌ **Wizard-style flows**: Multi-step wizards that don't use intent system
   - Replace with natural language parsing

### Medium Priority (Evaluate & Consolidate)
1. ⚠️ **Duplicate lookup functions**: bars-lookup, business-lookup
   - May consolidate into agent tools
   
2. ⚠️ **Old scheduling logic**: schedule_pickup, recurring-trips-scheduler
   - May be redundant with intent-based scheduling

### Low Priority (Keep)
1. ✅ **Admin functions**: All admin-* functions (staff tools, not customer-facing)
2. ✅ **Infrastructure**: notification-worker, data-retention, housekeeping
3. ✅ **Payment integration**: momo-*, revolut-* (Profile wallet)

---

## Migration Strategy

### Phase-by-Phase Approach

**Phase 1: Inventory** (✅ Current)
- Map all code to agent structure
- Identify legacy code for deprecation
- Document dependencies

**Phase 2: Agent Framework Consolidation**
- Implement unified webhook pipeline
- Create applyIntent service
- Set up feature flags
- Add integration tests

**Phase 3: Profile & Wallet Refactor**
- Extract Profile module
- Create "My Stuff" views
- Implement agent helper APIs

**Phase 4: Agent-Specific Migration**
Order: Waiter → Jobs → Rides → Real Estate → Farmer → Broker → Insurance → Sales SDR

**Phase 5: Cleanup & Safety**
- Remove legacy code
- Comprehensive testing
- Production validation

### Gradual Rollout with Feature Flags

Use feature flags to switch traffic gradually:

```typescript
// Example feature flag usage
const useUnifiedWebhook = process.env.FEATURE_UNIFIED_WEBHOOK === 'true';
const useIntentSystem = process.env.FEATURE_INTENT_SYSTEM === 'true';

if (useUnifiedWebhook) {
  // New: Route through central pipeline
  await processWebhookRequest(req);
} else {
  // Legacy: Old webhook handler
  await legacyWebhookHandler(req);
}
```

---

## Next Actions (Phase 2)

### Critical Path
1. **Create unified webhook pipeline** (`wa-webhook/index.ts`)
   - Normalize all WhatsApp events
   - Detect active agent
   - Call agent runtime
   - Store intents

2. **Implement applyIntent service** (`services/agent-core/apply-intent.ts`)
   - Route intents by agent + intent_type
   - Update domain tables
   - Create match events
   - Trigger notifications

3. **Set up feature flags**
   - `FEATURE_UNIFIED_WEBHOOK`
   - `FEATURE_INTENT_SYSTEM`
   - Per-agent flags: `FEATURE_WAITER_AGENT`, etc.

4. **Create integration tests**
   - Test: WhatsApp message → webhook → agent → intent → DB → reply
   - Cover all 8 agents
   - Validate data integrity

---

## Success Metrics

### Phase 1 ✅
- [x] All functions mapped
- [x] Legacy code identified
- [x] Dependencies documented

### Phase 2 (In Progress)
- [ ] Unified webhook operational
- [ ] applyIntent service deployed
- [ ] Feature flags in place
- [ ] Integration tests passing

### Phase 3 (Pending)
- [ ] Profile module extracted
- [ ] "My Stuff" views live
- [ ] Agent helpers working

### Phase 4 (Pending)
- [ ] All 8 agents migrated
- [ ] Legacy webhooks deprecated
- [ ] Natural language UX verified

### Phase 5 (Pending)
- [ ] Dead code removed
- [ ] Tests comprehensive
- [ ] Production validated

---

**Document Status**: ✅ Complete for Phase 1  
**Next Review**: Start of Phase 2  
**Owner**: EasyMO Engineering Team
