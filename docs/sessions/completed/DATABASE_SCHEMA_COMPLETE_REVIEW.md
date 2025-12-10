# Complete Database Schema Review
**Date:** 2025-12-09 13:20 UTC  
**Task:** Waiter AI + Buy & Sell AI Agent Implementation

---

## ✅ CONFIRMED: Tables That EXIST in Production

### 1. AI Agent Infrastructure (✅ COMPLETE)
- **`ai_agents`** - Agent registry (10 agents configured)
- **`ai_agent_configs`** - Agent configurations (PRIMARY table)
  - Columns: `agent_type` (PK), `name`, `description`, `system_prompt`, `keywords[]`, `tools[]`, `enabled`, `priority`, `config` (JSONB)
- **`ai_agent_personas`** - Persona definitions
- **`ai_agent_system_instructions`** - System prompts
- **`ai_agent_tools`** - Tool definitions
- **`ai_agent_intents`** - Intent mapping
- **`ai_agent_knowledge_bases`** - Knowledge base
- **`ai_agent_tasks`**, `ai_agent_metrics`, `ai_agent_tool_executions`, etc.

**Status:** ✅ FULLY IMPLEMENTED - No changes needed

**Current Agents (10):**
1. ✅ `waiter` - Waiter Agent
2. ✅ `farmer` - Farmer Agent
3. ✅ `marketplace` - Marketplace Agent
4. ✅ `business_broker` - Business Broker
5. ✅ `property` - Property Agent
6. ✅ `jobs` - Jobs Agent
7. ✅ `rides` - Rides Agent
8. ✅ `insurance` - Insurance Agent
9. ✅ `sales` - Sales Agent
10. ✅ `support` - Support Agent

**NOTE:** No `buy_and_sell` agent found! `marketplace` and `business_broker` exist separately.

---

### 2. Business & Bar Tables (✅ EXIST, Need Enhancement)

#### **`business`** - PRIMARY business registry
- **Rows:** 302 active businesses
- **Schema:**
  ```
  id              UUID PRIMARY KEY
  owner_user_id   UUID
  owner_whatsapp  TEXT
  name            TEXT
  created_at      TIMESTAMPTZ
  category_name   TEXT (human-readable)
  location_text   TEXT
  country         TEXT
  is_active       BOOLEAN (default true)
  tag             TEXT (category slug)
  bar_id          UUID (FK to bars, often self-referencing)
  ```
- **Indexes:**
  - `idx_business_bar_id`
  - `idx_business_category_name`
  - `idx_business_name_trgm` (trigram search)
  - `idx_business_tag`

**MISSING COLUMNS (need to add):**
- ❌ `latitude`, `longitude` - Location coords
- ❌ `location` (PostGIS geography)
- ❌ `description` TEXT
- ❌ `tags` TEXT[] - Quick tags array
- ❌ `services` TEXT[] - Services offered
- ❌ `products` TEXT[] - Products carried
- ❌ `keywords` TEXT[] - Search keywords
- ❌ `ai_metadata` JSONB - Rich metadata
- ❌ `operating_hours` JSONB - Business hours
- ❌ `rating` DECIMAL(2,1) - Average rating
- ❌ `review_count` INTEGER - Review count
- ❌ `is_verified` BOOLEAN - Verification status
- ❌ `search_vector` TSVECTOR - Full-text search
- ❌ `phone` TEXT - Contact phone

#### **`bars`** - Bar/restaurant listings
- **Rows:** 302 active bars (same count as business!)
- **Schema:** (from database.types.ts)
  ```
  id                    UUID PRIMARY KEY
  name                  TEXT NOT NULL
  slug                  TEXT NOT NULL
  country               TEXT NOT NULL
  city_area             TEXT
  location_text         TEXT
  latitude, longitude   FLOAT8
  location              GEOGRAPHY(Point,4326)
  whatsapp_number       TEXT
  momo_code             TEXT
  is_active             BOOLEAN
  claimed               BOOLEAN
  google_maps_url       TEXT
  Features: has_live_music, has_parking, has_wifi, has_outdoor_seating, etc.
  ```

**Status:** ✅ FULLY POPULATED - Ready to use for Waiter Agent

#### **`restaurants`** - Full restaurant records
- **Rows:** 0 (EMPTY!)
- **Schema:**
  ```
  id                    UUID PRIMARY KEY
  name, slug            TEXT NOT NULL
  address, phone, email TEXT
  location              GEOGRAPHY
  currency, timezone    TEXT
  payment_settings      JSONB
  metadata, settings    JSONB
  is_active             BOOLEAN
  default_language      TEXT
  supported_languages   TEXT[]
  ```

**Status:** ✅ Table exists but EMPTY - Waiter Agent should use `bars` instead

#### Related Tables:
- ✅ `restaurant_menu_items` (FK: restaurant_id)
- ✅ `restaurant_tables` (FK: restaurant_id)
- ✅ `orders` (FK: restaurant_id)
- ✅ `reservations` (FK: restaurant_id)
- ✅ `business_categories` - Category definitions
- ✅ `business_tags` - Has `search_keywords TEXT[]` already!
- ✅ `business_owners`, `business_whatsapp_numbers`

---

### 3. Search Functions (✅ EXIST, Some Need Enhancement)

**Existing Functions (17 found):**
1. ✅ `search_businesses_nearby(search_term, lat, lng, radius, limit)`
2. ✅ `search_businesses()`
3. ✅ `search_businesses_semantic()`
4. ✅ `search_nearby_restaurants()`
5. ✅ `search_nearby_businesses()`
6. ✅ `search_marketplace_listings_nearby()`
7. ✅ `search_nearby_jobs()`
8. ✅ `vendors_nearby()`
9. + other mobility/property functions

**Status:** ✅ Basic search EXISTS - Need AI-enhanced version

---

### 4. Session Tables (❌ MISSING!)

**Found:**
- ❌ NO `ai_agent_sessions` table!
- ✅ `omnichannel_sessions` (different purpose)
- ✅ `openai_sessions` (different purpose)
- ✅ `user_sessions` (different purpose)
- ✅ `vending_sessions` (different purpose)

**Impact:** Session manager code in `wa-agent-waiter/core/session-manager.ts` WILL FAIL!

**Must Create:**
```sql
CREATE TABLE ai_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  agent_type TEXT,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_ai_agent_sessions_phone ON ai_agent_sessions(phone);
CREATE INDEX idx_ai_agent_sessions_expires ON ai_agent_sessions(expires_at);
CREATE INDEX idx_ai_agent_sessions_agent_type ON ai_agent_sessions(agent_type);
```

---

## ❌ CRITICAL ISSUES FOUND

### Issue 1: No AI Agent Sessions Table
**Problem:** Code references `ai_agent_sessions` but table doesn't exist  
**Impact:** 🔴 CRITICAL - All agents will crash on session creation  
**Solution:** Create migration for `ai_agent_sessions` table

### Issue 2: No Buy & Sell Agent
**Problem:** Only `marketplace` and `business_broker` exist separately  
**Impact:** 🟡 MEDIUM - Need to either:
  - Option A: Use existing `marketplace` and `business_broker` agents
  - Option B: Create new `buy_and_sell` agent (requires db insert + code)
**Recommendation:** Use `business_broker` as it already handles business discovery

### Issue 3: Business Table Missing Key Columns
**Problem:** No `lat/lng`, `description`, `tags[]`, `services[]`, `keywords[]`, etc.  
**Impact:** 🟡 MEDIUM - Can't do AI-powered search without these  
**Solution:** Add columns via migration (non-breaking, all nullable)

### Issue 4: Restaurants Table is Empty
**Problem:** `restaurants` table has 0 rows, `bars` has 302  
**Impact:** 🟢 LOW - Waiter Agent just needs to query `bars` instead  
**Solution:** Update Waiter Agent to use `bars` table as primary source

---

## 📋 IMPLEMENTATION PLAN (Updated)

### Phase 1: Critical Fixes (MUST DO)
**Priority: 🔴 BLOCKER**

1. **Create `ai_agent_sessions` table**
   - Required for ALL agents to function
   - File: `20251209220000_create_ai_agent_sessions.sql`

2. **Add missing columns to `business` table**
   - Adds AI search capabilities
   - File: `20251209220001_enhance_business_table_for_ai.sql`

3. **Create AI-enhanced search function**
   - `search_businesses_ai(query, lat, lng, radius, limit)`
   - Uses tags, keywords, full-text search
   - File: `20251209220002_create_ai_business_search.sql`

---

### Phase 2: Waiter Agent Discovery Flow
**Priority: 🟡 HIGH**

1. **Update Waiter Agent to use `bars` table**
   - Query `bars` (not `restaurants`)
   - Add discovery state machine
   - States: `awaiting_discovery_choice`, `awaiting_location`, `awaiting_bar_selection`

2. **Add bar discovery functions**
   - `find_bars_nearby(lat, lng, radius)` - Already exists as `search_nearby_restaurants`!
   - Just need to wire up in agent

3. **QR Code Deep Link Handler**
   - Parse QR format: `easymo://waiter?bar_id=xxx&table=5`
   - Create session with context: `{barId, tableNumber, entryMethod: 'qr_scan'}`
   - Route to Waiter Agent with pre-populated context

4. **Session Context Updates**
   - Store in `context` JSONB:
     - `restaurantId` or `barId`
     - `tableNumber`
     - `discoveryState`
     - `entryMethod` ('home_menu' | 'qr_scan')

---

### Phase 3: Business Discovery Agent (Buy & Sell)
**Priority: 🟢 MEDIUM**

**Decision Required:** Use existing or create new?

**Option A: Use Existing `business_broker` Agent (RECOMMENDED)**
- ✅ Already in database (`agent_type = 'business_broker'`)
- ✅ Already enabled
- ✅ Already has system prompt
- ⚠️ Need to enhance with natural language understanding

**Option B: Create New `buy_and_sell` Agent**
- ❌ Requires INSERT into `ai_agent_configs`
- ❌ Requires new TypeScript agent class
- ❌ More complexity

**Recommendation:** Use `business_broker`, enhance it with:
1. Natural language intent classification
2. Product/service-specific queries
3. AI-powered search using new `search_businesses_ai()` function

---

### Phase 4: Home Menu Integration
**Priority: 🟢 LOW - Already Works!**

- ✅ `waiter` agent already in `ai_agent_configs`
- ✅ `business_broker` agent already in `ai_agent_configs`
- ✅ Home menu routing already exists in `wa-webhook/domains/menu/dynamic_home_menu.ts`
- ✅ IDs defined in `wa-webhook/wa/ids.ts`: `WAITER_AGENT`, `BUSINESS_BROKER_AGENT`

**Just need to:**
1. Ensure menu items are active in `whatsapp_home_menu_items`
2. Test routing flow

---

## 🚀 READY TO IMPLEMENT

### Migration Files to Create:

1. **`20251209220000_create_ai_agent_sessions.sql`**
   - CREATE TABLE ai_agent_sessions
   - CREATE indexes
   - **Lines:** ~30

2. **`20251209220001_enhance_business_table_for_ai.sql`**
   - ALTER TABLE business ADD COLUMN ...
   - CREATE indexes (GIN for arrays, GiST for geography)
   - CREATE trigger for search_vector update
   - **Lines:** ~80

3. **`20251209220002_create_ai_business_search.sql`**
   - CREATE FUNCTION search_businesses_ai()
   - Full-text + geospatial + relevance scoring
   - **Lines:** ~120

### Code Files to Update:

1. **`supabase/functions/wa-agent-waiter/core/waiter-agent.ts`**
   - Add discovery flow state machine
   - Query `bars` table instead of `restaurants`
   - Handle location sharing
   - Handle bar selection

2. **`packages/agents/src/agents/commerce/buy-and-sell.agent.ts`**
   - OR update `business-broker.agent.ts`
   - Add natural language intent classification
   - Use `search_businesses_ai()` function
   - Format results with emojis

3. **`supabase/functions/wa-webhook/router/qr.ts`** (NEW)
   - Parse QR codes for waiter deep links
   - Create session with context
   - Route to agent

---

## ✅ FINAL DECISION MATRIX

| Component | Status | Action |
|-----------|--------|--------|
| `ai_agent_sessions` table | ❌ Missing | **CREATE** |
| `business` table columns | ⚠️ Incomplete | **ALTER TABLE** |
| `search_businesses_ai()` | ❌ Missing | **CREATE FUNCTION** |
| `bars` table | ✅ Ready (302 rows) | **USE AS-IS** |
| `restaurants` table | ⚠️ Empty | **IGNORE** |
| Waiter Agent code | ⚠️ Needs updates | **UPDATE** |
| Business Broker Agent | ✅ Exists | **ENHANCE** |
| Buy & Sell Agent | ❌ Doesn't exist | **DON'T CREATE** (use business_broker) |
| Home Menu | ✅ Working | **TEST ONLY** |
| QR Code Handler | ❌ Missing | **CREATE** |

---

## 🎯 ESTIMATED EFFORT

**Phase 1 (Critical):** 4-6 hours
- 3 migration files
- Testing

**Phase 2 (Waiter Discovery):** 8-10 hours
- Discovery flow state machine
- QR handler
- Bar search integration
- Testing with real bar data

**Phase 3 (Business Discovery):** 6-8 hours
- Enhance business_broker agent
- Natural language understanding
- AI search integration
- Testing

**Total:** 18-24 hours (2-3 days)

---

## ✅ READY TO PROCEED?

**All clarifications resolved:**
- ✅ Tables identified
- ✅ Missing tables documented
- ✅ Architecture decisions made
- ✅ Implementation plan defined
- ✅ No more unknowns

**Shall I proceed with Phase 1 migrations?**

