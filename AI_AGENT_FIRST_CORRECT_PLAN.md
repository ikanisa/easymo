# EasyMO AI-Agent-First Revamp - CORRECT Plan
**Date:** 2025-11-05  
**Status:** Recovery from incorrect removal  
**Critical:** Previous commit 70d6661 was REVERTED due to incorrect removals

---

## ❌ MISTAKES MADE (Now Fixed)

I incorrectly removed critical services that are REQUIRED for AI-agent-first implementation:

### Services That Were WRONGLY Removed (Now Restored):
1. ✅ **vendor-service** - NEEDED for pharmacies, quincailleries, shops vendors
2. ✅ **buyer-service** - NEEDED for agent negotiation on behalf of users  
3. ✅ **ranking-service** - NEEDED to rank and match best vendors
4. ✅ **attribution-service** - NEEDED to track agent interactions
5. ✅ **wallet-service** - NEEDED for MOMO QR Code & Tokens (keep as-is per requirements)

### Domains That Were WRONGLY Removed (Now Restored):
1. ✅ **marketplace domain** - Core infrastructure for pharmacies/quincailleries/shops
2. ✅ **wallet domain** - Needed for referral codes, earn/redeem features
3. ✅ **voucher flows** - Tokens/vouchers to be kept combined with MOMO QR

---

## ✅ CORRECT UNDERSTANDING OF REQUIREMENTS

### Features to KEEP and Make AI-Agent-First:

#### 1. **Nearby Drivers** ⭐ AI AGENT
- **Current:** Manual matching via `match_drivers_for_trip_v2()`
- **Target:** AI agent negotiates prices with drivers, collects 3 quotes in 5 minutes
- **Services Needed:** ✅ Keep all mobility services

#### 2. **Nearby Passengers** 
- **Current:** Geographic lookup
- **Target:** Keep as-is (no AI agent needed)
- **Services Needed:** ✅ Keep mobility services

#### 3. **Schedule Trip** ⭐ AI AGENT
- **Current:** Manual scheduling
- **Target:** AI agent proactively finds matches, learns patterns
- **Services Needed:** ✅ Keep mobility services, add scheduler

#### 4. **Nearby Pharmacies** ⭐ AI AGENT (NEW)
- **Current:** Manual marketplace browsing
- **Target:** AI agent negotiates with pharmacies, collects quotes
- **Services Needed:**  
  - ✅ **vendor-service** (manage pharmacy vendors)
  - ✅ **buyer-service** (track user requests)
  - ✅ **ranking-service** (rank pharmacies)
  - ✅ **marketplace domain** (vendor infrastructure)

#### 5. **Nearby Quincailleries** ⭐ AI AGENT (NEW)
- **Current:** Manual marketplace browsing
- **Target:** AI agent negotiates with quincailleries, collects quotes
- **Services Needed:**  
  - ✅ **vendor-service** (manage quincaillerie vendors)
  - ✅ **buyer-service** (track user requests)
  - ✅ **ranking-service** (rank quincailleries)
  - ✅ **marketplace domain** (vendor infrastructure)

#### 6. **Shops** ⭐ AI AGENT (NEW)
- **Current:** Manual marketplace browsing
- **Target:** AI agent negotiates with shops, collects quotes
- **Services Needed:**  
  - ✅ **vendor-service** (manage shop vendors)
  - ✅ **buyer-service** (track user requests)
  - ✅ **ranking-service** (rank shops)
  - ✅ **marketplace domain** (vendor infrastructure)

#### 7. **Bars & Restaurants** ⭐ AI WAITER
- **Current:** Button-driven menu ordering
- **Target:** Conversational AI waiter
- **Services Needed:** ✅ Keep dinein domain

#### 8. **Property Rentals** ⭐ AI AGENT (NEW)
- **Current:** None
- **Target:** AI agent matches rental properties, negotiates
- **Services Needed:** Add new property tables, reuse vendor/buyer/ranking services

#### 9. **MOMO QR Code and Tokens** 
- **Current:** Working flow
- **Target:** Keep as-is, restructure for simplicity
- **Services Needed:**  
  - ✅ **wallet-service** (for token ledger)
  - ✅ **voucher flows** (combined with tokens)

#### 10. **Motor Insurance** 
- **Current:** Working flow
- **Target:** Keep as-is
- **Services Needed:** ✅ Keep insurance domain

---

## ❌ Features to ACTUALLY REMOVE

### 1. **Baskets** (Ride-sharing baskets)
**Why:** NOT in proposed flows  
**What to Remove:**
- ✅ Admin baskets UI (`admin-app/app/(panel)/baskets/`)
- ✅ Basket WhatsApp flows (`flows/baskets.ts`, `flows/admin/baskets.ts`)
- ✅ Basket API routes (`admin-app/app/api/baskets/`)
- ✅ Basket database migrations (move to `_disabled/`)
- ✅ Legacy PWA basket pages (`src/pages/Baskets.tsx`)

**What to KEEP:**
- ❌ DO NOT remove vendor-service
- ❌ DO NOT remove buyer-service  
- ❌ DO NOT remove ranking-service
- ❌ DO NOT remove marketplace domain

### 2. **Campaigns** (WhatsApp campaigns)
**Why:** NOT in proposed flows  
**What to Remove:**
- ✅ Admin campaigns UI (`admin-app/app/(panel)/campaigns/`)
- ✅ Campaign API routes (`admin-app/app/api/campaigns/`)
- ✅ Baskets reminder edge function

### 3. **Legacy Manual Marketplace UI** (But KEEP Infrastructure)
**Why:** Replaced by AI agents  
**What to Remove:**
- ✅ Manual marketplace browsing UI (admin panel pages)
- ✅ Manual vendor contact flows (old WhatsApp flows)

**What to KEEP:**
- ✅ marketplace_entries table (vendors database)
- ✅ vendor-service (vendor CRUD)
- ✅ buyer-service (buyer intents)
- ✅ ranking-service (vendor ranking)
- ✅ marketplace domain infrastructure

---

## 🛠️ CORRECT REFACTORING PLAN

### Phase 1: Clean Removal (1 week)

#### Remove ONLY These Items:

**1. Baskets Feature (Ride-sharing baskets)**
```bash
# Admin UI
rm -rf admin-app/app/(panel)/baskets/
rm -rf admin-app/app/api/baskets/
rm -rf admin-app/lib/baskets/
rm admin-app/lib/queries/baskets.ts

# WhatsApp flows
rm supabase/functions/wa-webhook/flows/baskets.ts
rm supabase/functions/wa-webhook/flows/admin/baskets.ts
rm supabase/functions/wa-webhook/exchange/admin/baskets.ts
rm supabase/functions/wa-webhook/rpc/baskets.ts

# Legacy PWA
rm src/pages/Baskets.tsx
rm src/lib/basketApi.ts

# Database (move to _disabled/)
mv supabase/migrations/20251031*baskets*.sql supabase/migrations/_disabled/
mv supabase/migrations/20251008184500_basket_security.sql supabase/migrations/_disabled/
mv supabase/migrations/20251010102000_phase1_basket_join_cleanup.sql supabase/migrations/_disabled/
mv supabase/migrations/20251113121000_basket_minor_indexes.sql supabase/migrations/_disabled/
```

**2. Campaigns Feature**
```bash
# Admin UI
rm -rf admin-app/app/(panel)/campaigns/
rm -rf admin-app/app/api/campaigns/

# Edge Functions
rm -rf supabase/functions/baskets-reminder/
```

**3. Legacy Marketplace UI (NOT Infrastructure)**
```bash
# Admin marketplace browsing UI (keep settings, keep vendor management)
# Only remove manual browsing pages, keep vendor CRUD pages

# Legacy PWA marketplace browsing
rm src/pages/Marketplace.tsx
rm src/lib/marketplaceApi.ts
```

### Phase 2: Restructure for AI-Agent-First (2-3 weeks)

#### 1. Add Agent Infrastructure

**New Database Tables:**
```sql
-- Agent sessions for all agent flows
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(user_id),
  flow_type TEXT, -- 'drivers', 'pharmacies', 'quincailleries', 'shops', 'rentals'
  status TEXT, -- 'searching', 'negotiating', 'presenting', 'completed', 'timeout'
  request_data JSONB,
  started_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  quotes_collected JSONB[]
);

-- Agent quotes from vendors
CREATE TABLE agent_quotes (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES agent_sessions(id),
  vendor_id UUID REFERENCES marketplace_entries(id), -- Uses existing vendors table
  offer_data JSONB,
  status TEXT,
  responded_at TIMESTAMPTZ
);
```

#### 2. Extend Existing Services (DON'T Replace)

**vendor-service Enhancements:**
```typescript
// ADD to existing vendor-service, don't replace
// services/vendor-service/src/agent-integration.ts

export class VendorAgentService {
  // Send quote request to vendor via WhatsApp
  async requestQuote(vendorId: string, requestData: QuoteRequest): Promise<void>
  
  // Parse vendor response
  async parseQuoteResponse(vendorId: string, message: string): Promise<Quote>
  
  // Track vendor response metrics
  async getVendorMetrics(vendorId: string): Promise<VendorMetrics>
}
```

**buyer-service Enhancements:**
```typescript
// ADD to existing buyer-service
// services/buyer-service/src/agent-integration.ts

export class BuyerAgentService {
  // Create agent session for buyer request
  async createAgentSession(userId: string, intent: BuyerIntent): Promise<string>
  
  // Track negotiation progress
  async trackNegotiation(sessionId: string, event: NegotiationEvent): Promise<void>
}
```

**ranking-service Enhancements:**
```typescript
// ADD to existing ranking-service
// services/ranking-service/src/agent-integration.ts

export class RankingAgentService {
  // Rank vendors for agent selection (prioritize fast responders)
  async rankVendorsForAgent(criteria: RankingCriteria): Promise<RankedVendor[]>
  
  // Update vendor scores based on agent interactions
  async updateVendorScore(vendorId: string, interaction: AgentInteraction): Promise<void>
}
```

#### 3. Create Agent Orchestrator Service (NEW)

```typescript
// services/agent-orchestrator/ (NEW SERVICE)

export class AgentOrchestratorService {
  constructor(
    private vendorService: VendorAgentService,
    private buyerService: BuyerAgentService,
    private rankingService: RankingAgentService
  ) {}
  
  // Main orchestration logic
  async startNegotiation(request: AgentRequest): Promise<AgentSession> {
    // 1. Create session
    const session = await this.buyerService.createAgentSession(request)
    
    // 2. Rank and select vendors
    const vendors = await this.rankingService.rankVendorsForAgent(request.criteria)
    
    // 3. Parallel negotiation (5-minute window)
    const quotes = await this.negotiateParallel(session.id, vendors, 300000)
    
    // 4. Present options to user
    await this.presentQuotes(request.userId, quotes)
    
    return session
  }
}
```

### Phase 3: Implement AI Agents (3-4 weeks)

**Priority Order:**
1. **Nearby Drivers Agent** (2 weeks) - Uses existing driver_presence table
2. **Nearby Pharmacies Agent** (1 week) - Uses marketplace_entries where category='pharmacy'
3. **Nearby Quincailleries Agent** (1 week) - Uses marketplace_entries where category='quincaillerie'
4. **Shops Agent** (1 week) - Uses marketplace_entries (general)
5. **AI Waiter** (1 week) - Enhance existing dinein domain
6. **Property Rentals Agent** (2 weeks) - New tables + agent

### Phase 4: Admin Panel Revamp (2 weeks)

**Keep:**
- ✅ User management
- ✅ Trips management  
- ✅ Bars/restaurants management
- ✅ Vendor management (pharmacies, quincailleries, shops)
- ✅ Settings

**Remove:**
- ❌ Baskets pages
- ❌ Campaigns pages

**Add:**
- ✅ Agent session monitoring
- ✅ Quote aggregation analytics
- ✅ Vendor response metrics
- ✅ Scheduled trip management

---

## ✅ SERVICE ARCHITECTURE (Correct)

### Core Services (KEEP ALL):
1. ✅ **agent-core** - AI orchestration
2. ✅ **agent-orchestrator** (NEW) - Negotiation coordination
3. ✅ **vendor-service** - Vendor CRUD, agent integration
4. ✅ **buyer-service** - Buyer intents, agent tracking
5. ✅ **ranking-service** - Vendor ranking for agents
6. ✅ **attribution-service** - Track conversions from agent interactions
7. ✅ **wallet-service** - MOMO QR Code, Tokens, vouchers
8. ✅ **broker-orchestrator** - Message brokering
9. ✅ **reconciliation-service** - Payment reconciliation
10. ✅ **whatsapp-bot** - Event emission

### Services to Remove:
- ❌ None! All services are needed for AI-agent-first implementation

---

## 📊 CORRECT DATABASE STRATEGY

### Tables to KEEP:
- ✅ `marketplace_entries` - Core vendor database (pharmacies, quincailleries, shops)
- ✅ `profiles` - User profiles
- ✅ `trips` - Mobility trips
- ✅ `driver_presence` - Driver locations
- ✅ `bars`, `items`, `orders` - Dine-in
- ✅ `wallet_accounts`, `wallet_transactions` - MOMO/Tokens
- ✅ `fuel_vouchers` - Keep for tokens flow

### Tables to ADD:
- ✅ `agent_sessions` - Agent negotiation tracking
- ✅ `agent_quotes` - Vendor quotes
- ✅ `scheduled_trips` - Recurring trips
- ✅ `property_listings` - Rental properties (new feature)

### Migrations to Disable (Move to _disabled/):
- ✅ Basket-related migrations only (11 migrations)
- ❌ DO NOT disable marketplace migrations
- ❌ DO NOT disable voucher migrations
- ❌ DO NOT disable wallet migrations

---

## 🎯 SUCCESS CRITERIA

### Phase 1 Complete When:
- ✅ Only baskets and campaigns features removed
- ✅ All vendor/buyer/ranking services intact
- ✅ Marketplace infrastructure preserved
- ✅ Wallet/voucher flows preserved
- ✅ Build passes, tests pass

### Phase 2 Complete When:
- ✅ Agent sessions table created
- ✅ Agent orchestrator service deployed
- ✅ Vendor/buyer/ranking services extended for agent support
- ✅ 5-minute window manager implemented

### Phase 3 Complete When:
- ✅ All 6 AI agents implemented (drivers, pharmacies, quincailleries, shops, waiter, rentals)
- ✅ Negotiation flows working end-to-end
- ✅ Quote aggregation and presentation functional

### Phase 4 Complete When:
- ✅ Admin panel reflects new agent-first architecture
- ✅ Agent monitoring dashboards live
- ✅ Old basket/campaign UIs removed

---

## 🚨 CRITICAL REMINDERS

### ❌ DO NOT REMOVE:
1. **vendor-service** - Core vendor management (pharmacies, quincailleries, shops)
2. **buyer-service** - Core buyer intent tracking  
3. **ranking-service** - Core vendor ranking
4. **attribution-service** - Track agent effectiveness
5. **wallet-service** - MOMO QR & Tokens (keep as-is!)
6. **marketplace domain** - Vendor infrastructure
7. **voucher flows** - Combined with tokens
8. **marketplace_entries table** - Core vendor database

### ✅ SAFE TO REMOVE:
1. **Baskets feature** - NOT in proposed flows
2. **Campaigns feature** - NOT in proposed flows
3. **Legacy manual marketplace UI** - Replaced by agents (but keep infrastructure)

---

## 📝 NEXT STEPS

1. ✅ **Revert bad commit** - DONE (commit 81b2c89)
2. ⏳ **Careful removal of ONLY baskets & campaigns**
3. ⏳ **Add agent infrastructure (tables, orchestrator service)**
4. ⏳ **Implement AI agents one by one**
5. ⏳ **Revamp admin panel**

---

**Report Author:** GitHub Copilot  
**Reviewed By:** User correction on 2025-11-05  
**Status:** Recovery complete, ready for correct implementation

