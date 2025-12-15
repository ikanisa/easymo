# WEBHOOK ARCHITECTURE REFACTOR PLAN

**Date**: December 15, 2025  
**Issue**: Home menu logic incorrectly embedded in wa-webhook-mobility  
**Status**: 🔴 **CRITICAL ARCHITECTURAL FLAW**

---

## EXECUTIVE SUMMARY

**Current Architecture**: ❌ **BROKEN** - Home menu lives in `wa-webhook-mobility`, creating tight coupling between all services.

**Target Architecture**: ✅ **CLEAN** - Home menu in `wa-webhook-core`, all services independent.

**Impact**: 
- Insurance cannot work without mobility
- Mobility depends on insurance code
- Cannot deploy services independently
- Build breaks affect multiple services

**Solution**: Move home menu to `wa-webhook-core` where it belongs.

---

## CURRENT ARCHITECTURE (BROKEN)

### How It Works Now ❌

```
User: "Hi"
  ↓
wa-webhook-core (router)
  ↓
Decision: Show home menu
  ↓
Routes to: wa-webhook-mobility  ← WRONG!
  ↓
wa-webhook-mobility/flows/home.ts
  ↓
Builds menu with:
  - Rides (mobility)
  - Insurance (imports insurance code)
  - Buy & Sell (imports buy-sell code)
  - Wallet (imports wallet code)
  - Profile (imports profile code)
  ↓
Sends menu to user
```

### Problems

1. **Tight Coupling**: 
   - Mobility imports insurance code
   - Insurance code missing → Mobility breaks
   - Cannot deploy mobility without fixing insurance

2. **Wrong Responsibility**:
   - Mobility service should only handle rides/transport
   - Not responsible for insurance, buy/sell, wallet, profile

3. **Duplicate Logic**:
   - Core has home menu handler (`wa-webhook-core/handlers/home.ts`)
   - Mobility also has home menu (`wa-webhook-mobility/flows/home.ts`)
   - **Two implementations of the same feature!**

4. **Cannot Scale**:
   - Adding new service = modify mobility code
   - All services depend on mobility for home menu

---

## DISCOVERED: TWO HOME MENU IMPLEMENTATIONS

### Implementation 1: wa-webhook-core/handlers/home.ts ✅

**File**: `supabase/functions/wa-webhook-core/handlers/home.ts` (59 lines)

```typescript
/**
 * Handle home menu request
 */
export async function handleHomeMenu(ctx: RouterContext): Promise<HandlerResult> {
  // Clear state (return to home)
  const sm = new StateMachine(ctx.supabase);
  await sm.clearState(ctx.profileId);

  // Get localized home menu
  const menu = homeMenuList(ctx.locale);

  // Send to user
  const result = await sendList(ctx, menu);

  return { handled: result.success };
}
```

**How it works**:
- ✅ In core (correct place)
- ✅ Uses `homeMenuList()` from shared messaging
- ✅ Simple, focused, no coupling
- ❌ **NOT BEING USED!**

### Implementation 2: wa-webhook-mobility/flows/home.ts ❌

**File**: `supabase/functions/wa-webhook-mobility/flows/home.ts` (215 lines)

```typescript
export async function sendHomeMenu(ctx: RouterContext, page = 0): Promise<void> {
  // BROKEN: Imports insurance code
  const gate = await evaluateMotorInsuranceGate(ctx);  // ❌ Function missing
  
  // Builds menu dynamically
  const rows = await buildRows({
    isAdmin: gate.isAdmin,
    showInsurance: gate.allowed,  // ❌ Complex logic
    locale: ctx.locale,
    ctx,
  });
  
  // Pagination, filtering, etc.
  // 215 lines of complexity
}
```

**How it works**:
- ❌ In mobility (wrong place)
- ❌ Imports insurance gate logic (broken)
- ❌ Complex pagination logic
- ❌ Feature gating per service
- ✅ **CURRENTLY BEING USED** (but shouldn't be)

---

## TARGET ARCHITECTURE (CLEAN)

### How It Should Work ✅

```
User: "Hi"
  ↓
wa-webhook-core (router)
  ↓
Decision: Show home menu
  ↓
Stays in core ← CORRECT!
  ↓
wa-webhook-core/handlers/home.ts
  ↓
Queries: whatsapp_home_menu_items table
  ↓
Builds menu from database:
  - "Rides" → wa-webhook-mobility
  - "Insurance" → wa-webhook-insurance
  - "Buy & Sell" → wa-webhook-buy-sell
  - "Wallet" → wa-webhook-wallet
  - "Profile" → wa-webhook-profile
  ↓
Sends menu to user
```

### When User Selects "Insurance"

```
User taps: "Insurance"
  ↓
wa-webhook-core (router)
  ↓
Routes to: wa-webhook-insurance  ← INDEPENDENT!
  ↓
wa-webhook-insurance/index.ts
  ↓
Queries: insurance_admin_contacts
  ↓
Sends: WhatsApp links
```

**No dependency on mobility!**

---

## REFACTORING PLAN

### Phase 1: Database-Driven Menu (Already Exists!)

**Good News**: Core already queries database for menu!

**File**: `wa-webhook-core/router.ts` (Lines 548-560)

```typescript
const { data: menuItems, error } = await supabase
  .from("whatsapp_home_menu_items")
  .select("*")
  .eq("is_active", true)
  .order("display_order", { ascending: true });
```

**Table Schema** (needs creation if doesn't exist):

```sql
CREATE TABLE IF NOT EXISTS whatsapp_home_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,  -- e.g., "rides", "insurance", "buy_sell"
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  display_order INTEGER NOT NULL,
  target_service TEXT NOT NULL,  -- e.g., "wa-webhook-mobility"
  is_active BOOLEAN DEFAULT true,
  active_countries TEXT[] DEFAULT ARRAY['RW'],  -- Country restrictions
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data
INSERT INTO whatsapp_home_menu_items (key, title, description, target_service, display_order) VALUES
('rides', '🚗 Rides', 'Book rides & transport', 'wa-webhook-mobility', 1),
('buy_sell', '🛒 Buy & Sell', 'Browse marketplace', 'wa-webhook-buy-sell', 2),
('insurance', '🛡️ Insurance', 'Get insurance quotes', 'wa-webhook-insurance', 3),
('wallet', '💰 Wallet', 'Manage tokens & payments', 'wa-webhook-wallet', 4),
('profile', '👤 Profile', 'View your profile', 'wa-webhook-profile', 5);
```

### Phase 2: Activate Core Home Menu (15 minutes)

**File**: `wa-webhook-core/router.ts`

**Current Code** (Lines 315-320):
```typescript
// Handle home menu in core
if (decision.reason === "home_menu") {
  return await handleHomeMenuRequest(phoneNumber);  // ❌ Custom implementation
}
```

**Change To**:
```typescript
// Handle home menu in core
if (decision.reason === "home_menu") {
  const result = await handleHomeMenu({
    from: phoneNumber,
    supabase,
    profileId: session?.user_id,
    locale: session?.locale || 'en',
    requestId: crypto.randomUUID(),
  });
  
  if (result.handled) {
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
```

### Phase 3: Remove Home Menu from Mobility (10 minutes)

**File**: `wa-webhook-mobility/flows/home.ts`

**Action**: DELETE entire file (215 lines)

**Update references**:
```bash
# Find all files importing sendHomeMenu
grep -r "import.*sendHomeMenu" supabase/functions/wa-webhook-mobility/

# Only found in:
# - flows/momo/qr.ts (2 occurrences)
```

**Fix**: `wa-webhook-mobility/flows/momo/qr.ts`

**Change**:
```typescript
// OLD
import { sendHomeMenu } from "../home.ts";
await sendHomeMenu(ctx);

// NEW
import { handleBackHome } from "../../_shared/messaging/index.ts";
await handleBackHome(ctx);
```

### Phase 4: Update Route Config (5 minutes)

**File**: `supabase/functions/_shared/route-config.ts`

**Add Insurance**:
```typescript
export const ROUTE_CONFIGS: RouteConfig[] = [
  // ... existing routes
  {
    service: "wa-webhook-insurance",
    keywords: ["insurance", "insure", "policy", "coverage", "quote"],
    menuKeys: ["insurance", "motor_insurance"],
    priority: 1,
  },
  // ... rest
];

export const ROUTED_SERVICES: readonly string[] = [
  "wa-webhook-mobility",
  "wa-webhook-buy-sell",
  "wa-webhook-insurance",  // ← ADD
  "wa-webhook-profile",
  "wa-webhook-wallet",
  // ... rest
];
```

### Phase 5: Test Independence (10 minutes)

**Test Each Service Independently**:

```bash
# 1. Deploy insurance ONLY
supabase functions deploy wa-webhook-insurance

# 2. Test insurance directly (no mobility needed!)
curl -X POST $SUPABASE_URL/functions/v1/wa-webhook-insurance \
  -H "Authorization: Bearer $ANON_KEY"

# 3. Deploy core
supabase functions deploy wa-webhook-core

# 4. Test home menu (should work without mobility!)
# Send "Hi" via WhatsApp

# 5. Deploy mobility (should not affect insurance)
supabase functions deploy wa-webhook-mobility
```

**Success Criteria**:
- ✅ Insurance works without mobility deployed
- ✅ Core can show home menu without mobility
- ✅ Each service deploys independently
- ✅ No cross-service imports

---

## MIGRATION CHECKLIST

### Pre-Migration
- [ ] Backup all webhook functions
- [ ] Document current routing behavior
- [ ] Create rollback plan

### Migration Steps
- [ ] Create/verify `whatsapp_home_menu_items` table
- [ ] Seed menu items data
- [ ] Update `wa-webhook-core/router.ts` to use `handleHomeMenu()`
- [ ] Delete `wa-webhook-mobility/flows/home.ts`
- [ ] Fix imports in `flows/momo/qr.ts`
- [ ] Add insurance to `route-config.ts`
- [ ] Update `ROUTED_SERVICES` list

### Testing
- [ ] Test home menu from core
- [ ] Test insurance selection works
- [ ] Test mobility selection works
- [ ] Test all menu items route correctly
- [ ] Test country filtering (if needed)

### Verification
- [ ] No imports between services (except _shared)
- [ ] Each service builds independently
- [ ] Each service deploys independently
- [ ] Home menu shows all items correctly

---

## BENEFITS OF REFACTOR

### Before ❌
```
Dependencies:
mobility → insurance (broken import)
mobility → buy-sell
mobility → wallet
mobility → profile

Cannot deploy:
- Insurance alone
- Mobility alone (breaks without insurance)

Build time: All services rebuild when one changes
```

### After ✅
```
Dependencies:
core → database (menu items)
Each service → independent

Can deploy:
- Insurance alone ✅
- Mobility alone ✅
- Any service independently ✅

Build time: Only changed service rebuilds
```

### Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Service Coupling** | High | None | 100% |
| **Lines in Mobility** | 215 (home) | 0 | -100% |
| **Deploy Independence** | No | Yes | ✅ |
| **Build Breaks** | Cascade | Isolated | ✅ |
| **Adding New Service** | Modify mobility | Add DB row | ✅ |

---

## ARCHITECTURAL PRINCIPLES

### ✅ DO (Clean Architecture)

1. **Single Responsibility**
   - Core: Routing only
   - Mobility: Rides only
   - Insurance: Insurance only

2. **Dependency Inversion**
   - Services depend on database schema
   - Not on each other

3. **Open/Closed**
   - Add new services without modifying existing ones
   - Just add row to `whatsapp_home_menu_items`

4. **Independent Deployment**
   - Each service in own edge function
   - No cross-imports (except _shared utilities)

### ❌ DON'T (Current Issues)

1. **❌ Service A imports from Service B**
   - Creates tight coupling
   - Build breaks cascade

2. **❌ Core functionality in domain service**
   - Home menu in mobility (wrong!)
   - Should be in core

3. **❌ Hard-coded service lists**
   - Menu items in code
   - Should be in database

4. **❌ Feature logic in wrong place**
   - Insurance gate in mobility
   - Should be in insurance service

---

## DATABASE MIGRATION

### Create Menu Table

**File**: `supabase/migrations/20251215_home_menu_refactor.sql`

```sql
BEGIN;

-- ============================================================================
-- HOME MENU REFACTOR
-- Purpose: Move home menu to database-driven configuration
-- ============================================================================

-- 1. Create home menu items table
CREATE TABLE IF NOT EXISTS public.whatsapp_home_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  display_order INTEGER NOT NULL,
  target_service TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  active_countries TEXT[] DEFAULT ARRAY['RW'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_home_menu_items_active 
  ON whatsapp_home_menu_items(is_active, display_order) 
  WHERE is_active = true;

-- RLS
ALTER TABLE whatsapp_home_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_home_menu" 
  ON whatsapp_home_menu_items FOR ALL 
  USING (auth.role() = 'service_role');

CREATE POLICY "anon_read_home_menu" 
  ON whatsapp_home_menu_items FOR SELECT 
  USING (is_active = true);

-- 2. Seed menu items
INSERT INTO whatsapp_home_menu_items (key, title, description, icon, target_service, display_order, active_countries) VALUES
('rides', 'Rides', 'Book rides & transport', '🚗', 'wa-webhook-mobility', 1, ARRAY['RW']),
('buy_sell', 'Buy & Sell', 'Browse marketplace', '🛒', 'wa-webhook-buy-sell', 2, ARRAY['RW']),
('insurance', 'Insurance', 'Get insurance quotes', '🛡️', 'wa-webhook-insurance', 3, ARRAY['RW']),
('wallet', 'Wallet', 'Manage tokens & payments', '💰', 'wa-webhook-wallet', 4, ARRAY['RW']),
('profile', 'Profile', 'View your profile', '👤', 'wa-webhook-profile', 5, ARRAY['RW'])
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  target_service = EXCLUDED.target_service,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 3. Function to get menu for user (with country filtering)
CREATE OR REPLACE FUNCTION public.get_home_menu_for_user(
  p_country_code TEXT DEFAULT 'RW',
  p_locale TEXT DEFAULT 'en'
)
RETURNS TABLE (
  key TEXT,
  title TEXT,
  description TEXT,
  icon TEXT,
  target_service TEXT,
  display_order INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.key,
    m.title,
    m.description,
    m.icon,
    m.target_service,
    m.display_order
  FROM whatsapp_home_menu_items m
  WHERE m.is_active = true
    AND (m.active_countries IS NULL OR p_country_code = ANY(m.active_countries))
  ORDER BY m.display_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_home_menu_for_user(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_home_menu_for_user(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_home_menu_for_user(TEXT, TEXT) TO service_role;

COMMENT ON TABLE whatsapp_home_menu_items IS 'Home menu items shown in WhatsApp - database-driven configuration';

COMMIT;
```

---

## ROLLBACK PLAN

If refactor breaks:

```bash
# 1. Keep old home.ts as backup
mv supabase/functions/wa-webhook-mobility/flows/home.ts \
   supabase/functions/wa-webhook-mobility/flows/home.ts.backup

# 2. Restore if needed
mv supabase/functions/wa-webhook-mobility/flows/home.ts.backup \
   supabase/functions/wa-webhook-mobility/flows/home.ts

# 3. Revert router.ts changes
git checkout supabase/functions/wa-webhook-core/router.ts

# 4. Redeploy
supabase functions deploy wa-webhook-core
supabase functions deploy wa-webhook-mobility
```

---

## TIMELINE

| Phase | Task | Time | Risk |
|-------|------|------|------|
| 1 | Create menu table & seed | 10 min | Low |
| 2 | Update core router | 15 min | Medium |
| 3 | Remove mobility home menu | 10 min | Low |
| 4 | Update route config | 5 min | Low |
| 5 | Test all services | 20 min | Medium |
| **Total** | **Complete refactor** | **60 min** | **Medium** |

---

## SUCCESS METRICS

### Technical
- [ ] `deno check` passes for all services independently
- [ ] Each service deploys without others
- [ ] No cross-service imports (grep check)
- [ ] Home menu works from core

### Functional
- [ ] User sees home menu on "Hi"
- [ ] Tapping "Insurance" routes correctly
- [ ] Tapping "Rides" routes correctly
- [ ] All menu items work

### Architectural
- [ ] Zero coupling between services
- [ ] Adding new service = 1 SQL INSERT (not code change)
- [ ] Services can be maintained by different teams

---

## NEXT STEPS

### Immediate (Today)
1. ✅ Review this plan with team
2. ✅ Get approval for refactor
3. ✅ Create database migration
4. ✅ Execute refactor (60 minutes)

### Follow-Up (Tomorrow)
5. ✅ Test all services end-to-end
6. ✅ Update documentation
7. ✅ Train team on new architecture

### Future (Next Week)
8. 🟡 Add menu item analytics
9. 🟡 A/B test different menu orders
10. 🟡 Add menu customization per user

---

## CONCLUSION

**Current State**: Home menu incorrectly in mobility → Tight coupling → Build breaks cascade

**Target State**: Home menu in core, database-driven → Zero coupling → Independent services

**Effort**: 60 minutes

**Benefit**: Clean architecture, independent deployment, scalable

**Recommendation**: **Execute immediately** - This is foundational architecture that enables all future work.

---

**END OF REFACTOR PLAN**
