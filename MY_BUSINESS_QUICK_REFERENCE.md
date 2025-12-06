# My Business Workflow - Quick Reference Guide

## 🎯 What Was Built

A complete WhatsApp-based business management system for bars, restaurants, and other venues. Owners can claim/add businesses, upload menus using AI OCR, manage orders, and customers can order conversationally via Waiter AI.

---

## 📂 Files Created (Phase 1 - Complete)

### Database Migrations (6 files)
```
supabase/migrations/
├── 20251206_105800_profile_menu_items.sql           (Dynamic menu with translations)
├── 20251206_105900_get_profile_menu_items_v2.sql    (RPC with visibility logic)
├── 20251206_110000_user_businesses.sql              (User-business linking)
├── 20251206_110100_semantic_business_search.sql     (Fuzzy search with pg_trgm)
├── 20251206_110200_menu_enhancements.sql            (OCR tracking, promotions)
└── 20251206_110300_waiter_ai_tables.sql             (Conversations, cart state)
```

### TypeScript Modules (4 files)
```
supabase/functions/wa-webhook-profile/
├── profile/menu_items.ts                            (Dynamic menu fetching)
├── business/search.ts                                (Semantic search & claim)
├── business/add_manual.ts                            (Step-by-step business add)
└── bars/index.ts                                     (Bar/restaurant hub)
```

### Modified Files (1 file)
```
supabase/functions/_shared/wa-webhook-shared/wa/ids.ts  (30+ new constants)
```

---

## 🚀 Quick Start

### 1. Deploy Phase 1

```bash
cd /Users/jeanbosco/workspace/easymo

# Run automated deployment
./deploy-my-business-phase1.sh

# Or manual deployment:
psql $DATABASE_URL -f supabase/migrations/20251206_105800_profile_menu_items.sql
psql $DATABASE_URL -f supabase/migrations/20251206_105900_get_profile_menu_items_v2.sql
psql $DATABASE_URL -f supabase/migrations/20251206_110000_user_businesses.sql
psql $DATABASE_URL -f supabase/migrations/20251206_110100_semantic_business_search.sql
psql $DATABASE_URL -f supabase/migrations/20251206_110200_menu_enhancements.sql
psql $DATABASE_URL -f supabase/migrations/20251206_110300_waiter_ai_tables.sql

# Deploy functions
supabase functions deploy wa-webhook-profile
```

### 2. Test Deployment

```bash
# View seeded menu items
psql $DATABASE_URL <<SQL
SELECT 
  item_key, 
  display_order, 
  icon, 
  translations->'en'->>'title' as title_en,
  translations->'rw'->>'title' as title_rw
FROM profile_menu_items 
ORDER BY display_order;
SQL

# Test RPC (replace <user-id> with real UUID)
psql $DATABASE_URL <<SQL
SELECT * FROM get_profile_menu_items_v2(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'RW',
  'en'
);
SQL

# Test semantic search
psql $DATABASE_URL <<SQL
SELECT name, category_name, city, similarity_score, is_claimed
FROM search_businesses_semantic('Bourbon Coffee', 'Rwanda', 5);
SQL
```

---

## 💬 User Flows

### Flow 1: Claim Existing Business

```
User → /profile
  → "🏪 My Businesses"
    → "💬 Add via AI Agent" OR "🔍 Search"
      → Types: "Bourbon Coffee"
        → System: Semantic search finds 3 results
          → User selects: "Bourbon Coffee - Kigali"
            → System: Checks if claimed
              → User: "✅ Yes, Claim It"
                → System: Links business to user
                  → ✅ Success! "Business Claimed"
```

**WhatsApp Messages:**
1. "🔍 Add Your Business - Type the name..."
2. "Found 3 businesses matching 'Bourbon Coffee'"
3. "🏪 Claim Business? Bourbon Coffee • Restaurant • Kigali"
4. "✅ Business Claimed Successfully!"

### Flow 2: Add New Business Manually

```
User → /profile
  → "🏪 My Businesses"
    → "➕ Add Manually"
      → Step 1: Name → "My Bar"
      → Step 2: Description → "Best drinks in Kigali"
      → Step 3: Category → Selects "Bar & Restaurant"
      → Step 4: Location → Sends GPS pin
        → Review & Confirm
          → ✅ "Add Business"
            → System: Creates business + links to user
              → ✅ "Business Added Successfully!"
```

**State Transitions:**
```
business_add_manual { step: "name" }
→ { step: "description", name: "My Bar" }
→ { step: "category", name: "My Bar", description: "..." }
→ { step: "location", name: "My Bar", category: "Bar & Restaurant" }
→ { step: "confirm", name: "My Bar", ..., lat: -1.95, lng: 30.06 }
→ INSERT INTO business → CLEAR STATE
```

### Flow 3: Manage Bar/Restaurant (Future)

```
User → /profile
  → "🍽️ My Bars & Restaurants" (only visible if has bar/restaurant)
    → Selects "My Bar"
      → "📸 Upload Menu" → Sends menu photo → AI extracts items
      → "📋 Manage Menu (25 items)" → Edit prices, toggle availability
      → "📦 View Orders (3 active)" → See pending orders
```

---

## 🗄️ Database Schema

### profile_menu_items
```sql
CREATE TABLE profile_menu_items (
  item_key TEXT UNIQUE,                    -- e.g., "my_bars_restaurants"
  display_order INTEGER,                   -- Sort order
  icon TEXT,                                -- e.g., "🍽️"
  title_key TEXT,                          -- Translation key
  description_key TEXT,                    -- Translation key
  action_type TEXT,                        -- "route", "modal", "external"
  action_target TEXT,                      -- e.g., "MY_BARS_RESTAURANTS"
  is_active BOOLEAN,
  active_countries TEXT[],                 -- ['RW', 'BI', 'TZ', ...]
  requires_business_category TEXT[],       -- ['bar', 'restaurant', ...]
  visibility_conditions JSONB,             -- {"has_bar_restaurant": true}
  translations JSONB                       -- {"en": {"title": "..."}, "rw": {...}}
);
```

**Key Feature:** Visibility conditions dynamically show/hide menu items based on user data.

### user_businesses
```sql
CREATE TABLE user_businesses (
  user_id UUID → profiles(user_id),
  business_id UUID → business(id),
  role TEXT,                               -- 'owner', 'manager', 'staff'
  verification_method TEXT,                -- 'whatsapp', 'self_registration'
  is_verified BOOLEAN,
  UNIQUE(user_id, business_id)
);
```

**Purpose:** Links users to businesses they own/manage. Enables multi-user management and verification tracking.

### waiter_conversations
```sql
CREATE TABLE waiter_conversations (
  bar_id UUID,
  visitor_phone TEXT,
  session_id UUID,
  messages JSONB,                          -- [{role: "user", content: "..."}]
  current_cart JSONB,                      -- {items: [], total: 0}
  current_order_id UUID,
  table_number TEXT,
  status TEXT                              -- 'active', 'order_placed', 'completed'
);
```

**Purpose:** Stores AI waiter conversation state, cart, and context for customer orders.

---

## 🔧 RPC Functions

### get_profile_menu_items_v2
```sql
SELECT * FROM get_profile_menu_items_v2(
  p_user_id UUID,
  p_country_code TEXT DEFAULT 'RW',
  p_language TEXT DEFAULT 'en'
);
```

**Logic:**
1. Check if user has any businesses
2. Get user's business categories (lowercase)
3. Check if user has bar/restaurant business
4. Filter menu items by:
   - is_active = true
   - country in active_countries
   - visibility_conditions match (e.g., has_bar_restaurant)
   - requires_business_category match (fuzzy)
5. Return with translated title/description

**Example Output:**
```
item_key              | icon | title                  | action_target
my_bars_restaurants   | 🍽️  | My Bars & Restaurants  | MY_BARS_RESTAURANTS
edit_profile          | ✏️  | Edit Profile           | EDIT_PROFILE
wallet_tokens         | 💎  | Wallet & Tokens        | WALLET_HOME
```

### search_businesses_semantic
```sql
SELECT * FROM search_businesses_semantic(
  p_search_term TEXT,
  p_country TEXT DEFAULT 'Rwanda',
  p_limit INTEGER DEFAULT 10
);
```

**Logic:**
1. Uses `pg_trgm` extension for trigram similarity
2. Calculates similarity score:
   - Exact match: 1.0
   - Trigram similarity: 0.0-1.0
   - Partial match (LIKE): 0.5
3. Filters by:
   - is_active = true
   - country matches (case-insensitive)
   - similarity > 0.2
4. Orders by similarity DESC

**Example:**
```sql
SELECT * FROM search_businesses_semantic('Burbon', 'Rwanda', 3);
-- Returns: "Bourbon Coffee" (similarity: 0.85)
```

---

## 🧩 IDS Constants Added

```typescript
// My Business Workflow
MY_BARS_RESTAURANTS = "my_bars_restaurants"
BUSINESS_SEARCH = "business_search"
BUSINESS_CLAIM = "business_claim"
BUSINESS_CLAIM_CONFIRM = "business_claim_confirm"
BUSINESS_ADD_MANUAL = "business_add_manual"
BUSINESS_ADD_CONFIRM = "business_add_confirm"

// Bar Management
BAR_UPLOAD_MENU = "bar_upload_menu"
BAR_MANAGE_MENU = "bar_manage_menu"
BAR_VIEW_ORDERS = "bar_view_orders"

// Menu Actions
MENU_TOGGLE_AVAILABLE = "menu_toggle_available"
MENU_SET_PROMO = "menu_set_promo"
MENU_DELETE_ITEM = "menu_delete_item"

// Waiter AI
WAITER_CHECKOUT = "waiter_checkout"
WAITER_CONFIRM_PAID = "waiter_confirm_paid"
```

**Usage in Router:**
```typescript
case IDS.MY_BARS_RESTAURANTS:
  return await showMyBarsRestaurants(ctx);

if (id.startsWith("bar::")):
  const businessId = id.replace("bar::", "");
  return await showBarManagement(ctx, businessId);
```

---

## 📊 State Management

### State Keys
```typescript
"business_search"      → { step: "awaiting_name" | "showing_results", searchTerm, results }
"business_claim"       → { businessId, businessName }
"business_add_manual"  → { step, name, description, category, lat, lng }
"bars_home"            → { businesses: [id1, id2, ...] }
"bar_detail"           → { businessId, businessName, barId }
"menu_upload"          → { barId, businessId, mediaId, extractedItems }
"menu_review"          → { extractedItems, selectedItems }
```

### State Lifecycle Example
```typescript
// User starts search
setState(ctx.supabase, ctx.profileId, {
  key: "business_search",
  data: { step: "awaiting_name" }
});

// User types "Bourbon"
const state = await getState(ctx.supabase, ctx.profileId);
// state.data = { step: "awaiting_name" }

await handleBusinessNameSearch(ctx, "Bourbon");

// State updated
// state.data = { step: "showing_results", searchTerm: "Bourbon", results: [...] }

// User claims business
await confirmBusinessClaim(ctx, businessId);
await clearState(ctx.supabase, ctx.profileId);
// State cleared
```

---

## 🧪 Testing Commands

### Test Profile Menu Visibility

```typescript
// User WITHOUT bar/restaurant business
const items = await get_profile_menu_items_v2(userId, 'RW', 'en');
// Returns: edit_profile, wallet_tokens, my_businesses, settings
// Does NOT return: my_bars_restaurants

// User WITH bar/restaurant business
// Returns: ALL items including my_bars_restaurants
```

### Test Business Search

```bash
# Test fuzzy matching
psql $DATABASE_URL <<SQL
SELECT name, similarity_score FROM search_businesses_semantic('Burbon', 'Rwanda', 5);
-- Expected: "Bourbon Coffee" with high similarity

SELECT name, similarity_score FROM search_businesses_semantic('coffe', 'Rwanda', 5);
-- Expected: "Bourbon Coffee", "Java Coffee", etc.
SQL
```

### Test State Management

```typescript
// Create test state
await setState(supabase, userId, {
  key: "business_add_manual",
  data: { step: "name" }
});

// Retrieve
const state = await getState(supabase, userId);
console.log(state.data); // { step: "name" }

// Update
await setState(supabase, userId, {
  key: "business_add_manual",
  data: { step: "description", name: "Test Bar" }
});

// Clear
await clearState(supabase, userId);
```

---

## 🐛 Troubleshooting

### Issue: "My Bars & Restaurants" not showing

**Diagnosis:**
```sql
-- Check user's businesses
SELECT id, name, category_name, tag, owner_user_id 
FROM business 
WHERE owner_user_id = '<user-id>' AND is_active = true;

-- If category_name doesn't contain "bar" or "restaurant", it won't show
```

**Fix:**
```sql
-- Update business category
UPDATE business 
SET category_name = 'Bar & Restaurant' 
WHERE id = '<business-id>';
```

### Issue: Semantic search returns no results

**Diagnosis:**
```sql
-- Check pg_trgm extension
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';

-- Check index exists
SELECT * FROM pg_indexes WHERE indexname = 'idx_business_name_trgm';

-- Test similarity directly
SELECT name, similarity('bourbon', LOWER(name)) AS sim
FROM business
WHERE is_active = true
ORDER BY sim DESC
LIMIT 5;
```

**Fix:**
```sql
-- If extension missing
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- If index missing
CREATE INDEX idx_business_name_trgm ON business USING GIN (name gin_trgm_ops);
```

### Issue: Menu items not visible after upload

**Diagnosis:**
```sql
-- Check menu_upload_requests
SELECT id, processing_status, error_message, item_count
FROM menu_upload_requests
WHERE bar_id = '<bar-id>'
ORDER BY created_at DESC
LIMIT 1;

-- Check extracted items
SELECT extracted_items FROM menu_upload_requests WHERE id = '<request-id>';
```

**Fix:**
- If `processing_status = 'failed'`: Check `error_message`
- If `item_count = 0`: Re-upload with clearer image
- If extracted but not saved: Check `restaurant_menu_items` table

---

## 📖 Next Steps

### Phase 2: Menu Upload & OCR
**Estimated:** 2 hours  
**Files:** `bars/menu_upload.ts`  
**Dependencies:** `GEMINI_API_KEY`

### Phase 3: Menu Editing
**Estimated:** 1.5 hours  
**Files:** `bars/menu_edit.ts`

### Phase 4: Order Management
**Estimated:** 1.5 hours  
**Files:** `bars/orders.ts`

### Phase 5: Waiter AI
**Estimated:** 3 hours  
**Files:** `wa-webhook-waiter/{index,agent,payment,notify_bar}.ts`

---

## 📞 Support

**Documentation:**
- Full report: `MY_BUSINESS_WORKFLOW_IMPLEMENTATION_STATUS.md`
- This guide: `MY_BUSINESS_QUICK_REFERENCE.md`

**Commands:**
```bash
# View full status
cat MY_BUSINESS_WORKFLOW_IMPLEMENTATION_STATUS.md

# Deploy Phase 1
./deploy-my-business-phase1.sh

# Verify deployment
psql $DATABASE_URL -c "SELECT COUNT(*) FROM profile_menu_items;"
```

---

**Phase 1 Complete ✅ | Ready for Testing & Phase 2 Implementation**
