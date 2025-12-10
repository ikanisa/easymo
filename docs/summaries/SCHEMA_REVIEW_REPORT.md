# Database Schema Review Report
**Date:** 2025-12-09
**Task:** Waiter AI Agent Discovery Flow + Buy & Sell AI Agent Enhancement

## 📊 EXISTING TABLES (Confirmed in Production)

### ✅ Core Agent Infrastructure
- `ai_agents_config` - Agent configuration (system prompts, personas, tools)
- `agent_chat_messages` - Chat history storage

### ✅ Restaurant/Bar Tables
1. **`bars`** - Bar/restaurant listings
   - `id`, `name`, `slug`, `country`
   - `latitude`, `longitude`, `location` (PostGIS)
   - `location_text`, `city_area`
   - `whatsapp_number`, `momo_code`
   - `is_active`, `claimed`
   - Features: `has_live_music`, `has_parking`, `has_wifi`, etc.

2. **`restaurants`** - Full restaurant records (more detailed than bars)
   - `id`, `name`, `slug`
   - `location` (PostGIS), `address`
   - `phone`, `email`, `currency`, `timezone`
   - `payment_settings`, `metadata`, `settings`
   - `is_active`, `default_language`, `supported_languages`

3. **`restaurant_menu_items`** - Menu items linked to restaurants
   - `restaurant_id` (FK to restaurants)
   - Item details (name, price, description)

4. **`restaurant_tables`** - Table management
   - `restaurant_id` (FK)
   - Table numbers, capacity, status

5. **`orders`** - Order records
   - `restaurant_id` (FK to restaurants)
   - Order details, status, payment

6. **`reservations`** - Table reservations
   - `restaurant_id` (FK to restaurants)

### ✅ Business Tables
1. **`business`** - Primary business registry (singular)
   - `id`, `name`, `description`
   - `latitude`, `longitude`, `location` (PostGIS)
   - `location_text`, `location_url`, `maps_url`
   - `country`, `category_name`
   - `owner_user_id`, `owner_whatsapp`
   - `tag`, `tag_id` (FK to business_tags)
   - `new_category_id` (FK to service_categories)
   - `bar_id` (FK to bars) - Links business to bar if applicable
   - `is_active`, `claimed`, `status`
   - `geocode_status`, `geocoded_at`
   - `name_embedding` (for vector search)
   - Features: `has_live_music`, `has_parking`, etc.

2. **`businesses`** - View or duplicate table (unclear - needs investigation)
   - Similar columns to `business` but all nullable
   - May be a materialized view

3. **`business_categories`** - Category definitions
   - `id`, `slug`, `label`, `description`

4. **`business_tags`** - Tagging system
   - `id`, `slug`, `name`, `description`
   - `search_keywords` (TEXT[]) - ✅ ALREADY EXISTS!
   - `parent_tag_id` (hierarchical tags)
   - `icon`, `color`, `sort_order`
   - `is_active`

5. **`business_owners`** - Owner management
6. **`business_whatsapp_numbers`** - Contact numbers

### ✅ Location Tables
- `app.saved_locations` - User saved places
- `app.recent_locations` - Recent location searches
- `public.saved_locations` - Public saved locations
- `public.recent_locations` - Public recent locations

---

## ❌ MISSING TABLES (Need to Create)

### 1. Agent Session Management
**CRITICAL:** No `ai_agent_sessions` table found in types!

**Required fields:**
```sql
CREATE TABLE ai_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  current_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
```

**Context should store:**
- `restaurantId` (for Waiter Agent)
- `barId` (alternative for bar-specific)
- `tableNumber` (for QR-scanned sessions)
- `businessId` (for Buy/Sell Agent)
- `discoveryState` (state machine for discovery flow)
- `pendingQuery` (user's original request)
- `searchResults` (temporary results for selection)
- `location` (user's lat/lng)

### 2. Enhanced Business Search Columns
**PARTIALLY EXISTS** - `business_tags.search_keywords` already has TEXT[]!

**Still need to add to `business` table:**
- `tags` TEXT[] - Quick tag array for filtering
- `services` TEXT[] - Services offered
- `products` TEXT[] - Products/brands
- `keywords` TEXT[] - Search keywords
- `ai_metadata` JSONB - Rich metadata for AI context
- `operating_hours` JSONB - Business hours
- `rating` DECIMAL(2,1) - Average rating
- `review_count` INTEGER - Number of reviews
- `is_verified` BOOLEAN - Verification status
- `search_vector` TSVECTOR - Full-text search index

### 3. AI Agent Tables (from seed file expectations)
Based on `ai_agents_seed.sql`, these may exist but aren't in types:
- `ai_agents` - Agent registry
- `ai_agent_personas` - Persona definitions
- `ai_agent_system_instructions` - System prompts
- `ai_agent_tools` - Tool definitions

**Status:** Need to verify if these exist or if only `ai_agents_config` is used

---

## 🔄 TABLES NEEDING ENHANCEMENT

### 1. `business` Table
**Add missing columns:**
```sql
ALTER TABLE business 
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS services TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS products TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS operating_hours JSONB,
  ADD COLUMN IF NOT EXISTS rating DECIMAL(2,1) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;
```

**Add indexes:**
```sql
CREATE INDEX idx_business_tags ON business USING GIN(tags);
CREATE INDEX idx_business_services ON business USING GIN(services);
CREATE INDEX idx_business_products ON business USING GIN(products);
CREATE INDEX idx_business_keywords ON business USING GIN(keywords);
CREATE INDEX idx_business_ai_metadata ON business USING GIN(ai_metadata);
CREATE INDEX idx_business_search_vector ON business USING GIN(search_vector);
```

### 2. Create Full-Text Search Function
**NEW RPC:**
```sql
CREATE OR REPLACE FUNCTION search_businesses_ai(
  p_query TEXT,
  p_lat FLOAT DEFAULT NULL,
  p_lng FLOAT DEFAULT NULL,
  p_radius_km FLOAT DEFAULT 10.0,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category_name TEXT,
  tags TEXT[],
  services TEXT[],
  products TEXT[],
  location_text TEXT,
  owner_whatsapp TEXT,
  rating DECIMAL,
  review_count INT,
  distance_km FLOAT,
  relevance_score FLOAT,
  is_open_now BOOLEAN,
  operating_hours JSONB
);
```

---

## 🤔 CLARIFICATIONS NEEDED

### 1. `business` vs `businesses` Table
- **`business`** (singular) has `id UUID NOT NULL`, full schema
- **`businesses`** (plural) has all nullable fields, `id UUID | null`
- **Question:** Is `businesses` a view of `business`? Or legacy duplicate?
- **Recommendation:** Use `business` as canonical, investigate `businesses`

### 2. `bars` vs `restaurants` Table
- **`bars`** - 100s of scraped bar listings
- **`restaurants`** - Full restaurant records with menu integration
- **Overlap:** Both have location, name, features
- **Question:** Can a bar also be a restaurant? Is `business.bar_id` the link?
- **Recommendation:** Waiter Agent should support BOTH tables
  - Check `restaurants` first (full integration)
  - Fallback to `bars` (simpler, more numerous)

### 3. AI Agent Tables Architecture
- Seed file expects: `ai_agents`, `ai_agent_personas`, `ai_agent_system_instructions`, `ai_agent_tools`
- Types show: `ai_agents_config` (flatter schema)
- **Question:** Was the original schema consolidated into `ai_agents_config`?
- **Recommendation:** Check if seed file tables exist, or update seed to use `ai_agents_config`

### 4. Session Storage
- **No `ai_agent_sessions` table** found in types
- Session manager code references `ai_agent_sessions` table
- **Question:** Does this table exist but not in types? Or missing entirely?
- **Action:** MUST create migration for this table

---

## 📋 IMPLEMENTATION PRIORITIES

### Phase 1: Critical Missing Infrastructure
1. ✅ Verify `ai_agent_sessions` table exists (or create it)
2. ✅ Verify AI agent registry tables exist (or use `ai_agents_config`)
3. ✅ Clarify `business` vs `businesses` relationship

### Phase 2: Waiter Agent Discovery
1. Add discovery flow to `waiter-agent.ts`
2. Update session context to store `restaurantId` / `barId` / `tableNumber`
3. Create QR deep link handler
4. Support both `restaurants` and `bars` tables

### Phase 3: Buy & Sell Agent Enhancement
1. Add missing columns to `business` table
2. Create `search_businesses_ai()` RPC function
3. Update Buy & Sell agent to use AI search
4. Add natural language intent classification

### Phase 4: Home Menu Integration
1. Ensure `buy_and_sell` agent exists in `ai_agents_config` or equivalent
2. Add to `whatsapp_home_menu_items` table
3. Update routing in `wa-webhook`

---

## 🚦 NEXT STEPS

### Immediate Actions:
1. **Run this query on production:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name LIKE '%ai_agent%'
   ORDER BY table_name;
   ```

2. **Verify session table:**
   ```sql
   \d+ ai_agent_sessions
   ```

3. **Check business/businesses relationship:**
   ```sql
   SELECT 
     (SELECT count(*) FROM business) as business_count,
     (SELECT count(*) FROM businesses) as businesses_count,
     (SELECT pg_get_viewdef('businesses'::regclass, true)) as businesses_is_view;
   ```

### Once Confirmed:
- [ ] Create `ai_agent_sessions` table if missing
- [ ] Enhance `business` table with AI columns
- [ ] Create `search_businesses_ai()` function
- [ ] Implement discovery flows
- [ ] Update agents and routing

