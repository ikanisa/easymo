# WhatsApp Home Menu Items - Description Audit

**Date**: December 11, 2025  
**Issue**: Some menu items missing descriptions in country_specific_names

---

## AUDIT FINDINGS

### Current Menu Items

From migration `20251210085100_split_buy_sell_and_chat_agent.sql`:

#### 1. Buy and Sell (key: `buy_sell_categories`)
**Status**: ✅ **HAS descriptions** for most countries, ❌ **MISSING Rwanda (RW)**

Countries with descriptions:
- MT (Malta): ✅ "Browse categories and find businesses"
- BI (Burundi): ✅ "Parcourir les catégories"
- TZ (Tanzania): ✅ "Tazama makundi ya biashara"
- CD (DR Congo): ✅ "Parcourir les catégories"
- ZM (Zambia): ✅ "Browse categories"
- TG (Togo): ✅ "Parcourir les catégories"

**MISSING**:
- RW (Rwanda): ❌ No description provided

#### 2. Chat with Agent (key: `business_broker_agent`)
**Status**: ✅ **HAS descriptions** for most countries, ❌ **MISSING Rwanda (RW)**

Countries with descriptions:
- MT (Malta): ✅ "AI-powered business search"
- BI (Burundi): ✅ "Recherche IA"
- TZ (Tanzania): ✅ "Tafuta kwa AI"
- CD (DR Congo): ✅ "Recherche IA"
- ZM (Zambia): ✅ "AI-powered search"
- TG (Togo): ✅ "Recherche IA"

**MISSING**:
- RW (Rwanda): ❌ No description provided

---

## THE PROBLEM

Both menu items are **MISSING Rwanda (RW)** in their `country_specific_names` JSONB, which means:

1. Rwanda users don't see descriptions for these menu items
2. The menu shows only icons and names, no helpful description text
3. Inconsistent with other countries that have full descriptions

---

## RECOMMENDED DESCRIPTIONS

### For Rwanda (RW)

#### Buy and Sell
- **Name**: "Kugura & Kugurisha" (already exists in old migration)
- **Description**: "Hitamo icyiciro, ubone amashobuzi" (Select category, find businesses)
- **Alternative**: "Shakisha amashobuzi hafi yawe" (Search for businesses near you)

#### Chat with Agent  
- **Name**: "Ganira na Agent"
- **Description**: "Shakisha ukoresheje AI" (Search using AI)
- **Alternative**: "Ubushakashatsi bwashize AI" (AI-powered search)

---

## FIX MIGRATION

Create: `supabase/migrations/20251211070000_add_rwanda_menu_descriptions.sql`

```sql
-- Add Rwanda (RW) descriptions to Buy & Sell menu items
-- Both items were missing RW in country_specific_names

BEGIN;

-- 1. Update Buy and Sell Categories - Add RW
UPDATE public.whatsapp_home_menu_items
SET country_specific_names = country_specific_names || 
  jsonb_build_object(
    'RW', jsonb_build_object(
      'name', 'Kugura & Kugurisha',
      'description', 'Hitamo icyiciro, ubone amashobuzi hafi yawe'
    )
  ),
  updated_at = NOW()
WHERE key = 'buy_sell_categories';

-- 2. Update Chat with Agent - Add RW
UPDATE public.whatsapp_home_menu_items
SET country_specific_names = country_specific_names || 
  jsonb_build_object(
    'RW', jsonb_build_object(
      'name', 'Ganira na Agent',
      'description', 'Shakisha ukoresheje AI'
    )
  ),
  updated_at = NOW()
WHERE key = 'business_broker_agent';

-- Verify updates
DO $$
DECLARE
  v_categories_has_rw BOOLEAN;
  v_broker_has_rw BOOLEAN;
BEGIN
  -- Check if RW now exists in buy_sell_categories
  SELECT country_specific_names ? 'RW' INTO v_categories_has_rw
  FROM whatsapp_home_menu_items
  WHERE key = 'buy_sell_categories';
  
  -- Check if RW now exists in business_broker_agent
  SELECT country_specific_names ? 'RW' INTO v_broker_has_rw
  FROM whatsapp_home_menu_items
  WHERE key = 'business_broker_agent';
  
  IF v_categories_has_rw AND v_broker_has_rw THEN
    RAISE NOTICE '✅ Rwanda (RW) descriptions added successfully to both menu items';
  ELSE
    RAISE WARNING '❌ Failed to add Rwanda descriptions. Categories: %, Broker: %', 
      v_categories_has_rw, v_broker_has_rw;
  END IF;
END $$;

-- Show final state for RW
SELECT 
  key,
  name,
  country_specific_names->'RW' as rwanda_config
FROM whatsapp_home_menu_items
WHERE key IN ('buy_sell_categories', 'business_broker_agent')
  AND is_active = true;

COMMIT;
```

---

## OTHER MENU ITEMS TO CHECK

Should also verify these menu items have descriptions:

1. **Profile** (key: `profile`)
   - Description: "Manage your account, vehicles, and settings"

2. **Rides** (key: `rides`)
   - Description: "Find drivers or offer rides"

3. **Jobs** (key: `jobs`)
   - Description: "Find jobs or post opportunities"

4. **Wallet** (key: `wallet`)
   - Description: "View balance and earn tokens"

---

## TESTING AFTER FIX

1. Apply migration:
   ```bash
   supabase db push
   ```

2. Verify in database:
   ```sql
   SELECT 
     key,
     name,
     country_specific_names->'RW'->>'name' as rw_name,
     country_specific_names->'RW'->>'description' as rw_description
   FROM whatsapp_home_menu_items
   WHERE key IN ('buy_sell_categories', 'business_broker_agent');
   ```

3. Expected result:
   ```
   key                    | rw_name              | rw_description
   ----------------------|----------------------|----------------------------------
   buy_sell_categories   | Kugura & Kugurisha  | Hitamo icyiciro, ubone amashobuzi...
   business_broker_agent | Ganira na Agent     | Shakisha ukoresheje AI
   ```

4. Test in WhatsApp (Rwanda number):
   - Send "Hi" to bot
   - Check home menu
   - Verify descriptions appear for Buy & Sell items

---

## SUMMARY

**Issue**: Rwanda missing from menu item descriptions  
**Impact**: Rwanda users don't see helpful descriptions  
**Fix**: Add RW to country_specific_names JSONB  
**Effort**: 5 minutes (simple UPDATE migration)  
**Risk**: Very low (just adding data, not changing structure)

---

**Status**: ⚠️ **NEEDS FIX**  
**Priority**: Medium (cosmetic but important for UX)

