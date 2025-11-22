# WhatsApp Home Menu Architecture

## Overview

The WhatsApp home menu provides users with a single-page interface showcasing 9 core menu items:
- **8 AI Agents**: Specialized conversational agents for different services
- **1 Profile**: User profile and wallet access

This document explains the canonical menu structure, legacy item handling, and how to work with the menu system.

## Canonical 9 Menu Items

As of **2025-11-22**, the WhatsApp home menu is limited to exactly **9 active items**:

| # | Name | Key | Icon | Purpose |
|---|------|-----|------|---------|
| 1 | Waiter AI | `waiter_agent` | 🍽️ | Bars & restaurants ordering |
| 2 | Rides AI | `rides_agent` | 🚗 | Ride-hailing and scheduling |
| 3 | Jobs AI | `jobs_agent` | 💼 | Job board and gigs marketplace |
| 4 | Business Broker | `business_broker_agent` | 🏪 | Business directory & services |
| 5 | Real Estate | `real_estate_agent` | 🏠 | Property listings & rentals |
| 6 | Farmer AI | `farmer_agent` | 🌾 | Agricultural marketplace |
| 7 | Insurance AI | `insurance_agent` | 🛡️ | Insurance quotes & policies |
| 8 | Sales SDR | `sales_agent` | 📞 | Business sales assistant |
| 9 | Profile | `profile` | 👤 | User profile, wallet & assets |

### Corresponding UUIDs

These items have stable UUIDs in the database:

```typescript
const CANONICAL_MENU_IDS = {
  waiter_agent: 'a1000001-0000-0000-0000-000000000001',
  rides_agent: 'a1000002-0000-0000-0000-000000000002',
  jobs_agent: 'a1000003-0000-0000-0000-000000000003',
  business_broker_agent: 'a1000004-0000-0000-0000-000000000004',
  real_estate_agent: 'a1000005-0000-0000-0000-000000000005',
  farmer_agent: 'b1ef9975-27b1-4f67-848d-0c21c0ada9d2',
  insurance_agent: '382626fc-e270-4d2c-8b47-cc606ebc0592',
  sales_agent: 'a1000008-0000-0000-0000-000000000008',
  profile: 'a1000009-0000-0000-0000-000000000009',
};
```

## Legacy Items & Alias Mapping

Before the cleanup (2025-11-22), the table contained **20+ menu items**. These legacy items are now:
1. **Soft-disabled** in the database (`is_active = false`)
2. **Backed up** in `whatsapp_home_menu_items_legacy` table
3. **Aliased** in code to route to the appropriate canonical agent

### Legacy Key → Canonical Agent Mapping

When old code or user sessions reference legacy keys, they are automatically normalized to canonical keys:

```typescript
export const HOME_MENU_KEY_ALIASES = {
  // Rides-related
  schedule_trip: "rides_agent",
  nearby_drivers: "rides_agent",
  nearby_passengers: "rides_agent",
  rides: "rides_agent",
  
  // Jobs-related
  jobs_gigs: "jobs_agent",
  jobs: "jobs_agent",
  
  // Waiter-related
  bars_restaurants: "waiter_agent",
  
  // Business broker-related
  nearby_pharmacies: "business_broker_agent",
  quincailleries: "business_broker_agent",
  shops_services: "business_broker_agent",
  notary_services: "business_broker_agent",
  general_broker: "business_broker_agent",
  
  // Real estate-related
  property_rentals: "real_estate_agent",
  
  // Insurance-related
  motor_insurance: "insurance_agent",
  
  // Profile-related
  momo_qr: "profile",
  token_transfer: "profile",
  profile_assets: "profile",
  
  // Support
  customer_support: "sales_agent",
};
```

### Using the Alias System

```typescript
import { normalizeMenuKey } from '../domains/menu/dynamic_home_menu.ts';

// User selects legacy item
const userSelection = "nearby_pharmacies";

// Normalize to canonical key
const canonicalKey = normalizeMenuKey(userSelection);
// => "business_broker_agent"

// Use canonical key to route to agent
await routeToAgent(canonicalKey);
```

## Database Schema

### Main Table: `whatsapp_home_menu_items`

```sql
CREATE TABLE public.whatsapp_home_menu_items (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  active_countries TEXT[] NOT NULL,
  display_order INTEGER NOT NULL,
  icon TEXT,
  country_specific_names JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

**Key columns:**
- `is_active`: **CRITICAL** - Only 9 items should have `is_active = true`
- `active_countries`: Array of ISO country codes (e.g., `['RW', 'UG', 'KE']`)
- `display_order`: Determines menu ordering (1-9 for active items)
- `country_specific_names`: JSONB with localized names per country

### Backup Table: `whatsapp_home_menu_items_legacy`

All rows from before the cleanup are preserved here with a `backed_up_at` timestamp.

## Querying Menu Items

### ✅ Correct: Filter by `is_active = true`

```typescript
const { data } = await supabase
  .from("whatsapp_home_menu_items")
  .select("*")
  .eq("is_active", true)
  .contains("active_countries", [countryCode])
  .order("display_order", { ascending: true });
```

This returns **exactly 9 items** for the specified country.

### ❌ Incorrect: Querying all items

```typescript
// BAD: Returns both active and inactive items
const { data } = await supabase
  .from("whatsapp_home_menu_items")
  .select("*");
```

Always filter by `is_active = true` when building the user-facing menu.

## Adding a New Agent

If you need to add a 10th agent (not recommended), follow this process:

1. **Update the canonical count** from 9 to 10 in this document
2. **Create a migration** to:
   - Insert the new item with `is_active = true`
   - Assign a unique UUID and `display_order` (e.g., 10)
3. **Update TypeScript types** in `dynamic_home_menu.ts`:
   - Add the key to `MenuItemKey` union type
   - Add to `HOME_MENU_KEY_ALIASES` mapping
4. **Update translations** in i18n files
5. **Test thoroughly** to ensure menu doesn't overflow UI

## Removing/Consolidating an Agent

To remove an agent from the home menu:

1. **Set `is_active = false`** in migration
2. **Add alias mapping** to route to another agent:
   ```typescript
   HOME_MENU_KEY_ALIASES['old_agent'] = 'new_agent';
   ```
3. **Update documentation** to reflect the change

## Localization

Menu items support country-specific names via the `country_specific_names` JSONB column:

```sql
INSERT INTO whatsapp_home_menu_items (...)
VALUES (
  ...,
  jsonb_build_object(
    'RW', jsonb_build_object('name', 'Abahinzi', 'description', 'Gura ibihingwa'),
    'KE', jsonb_build_object('name', 'Farmers', 'description', 'Buy produce'),
    'TZ', jsonb_build_object('name', 'Wakulima', 'description', 'Nunua mazao')
  )
);
```

The `getLocalizedMenuName()` function in `dynamic_home_menu.ts` handles fallback to the default `name` field.

## Caching

Menu items are cached per country to reduce database load:

- **Cache key**: `menu:home:{countryCode}`
- **TTL**: 420 seconds (7 minutes) by default
- **Control**: Set `WA_MENU_CACHE_ENABLED=false` to disable

Caching is safe because menu changes are infrequent (migration-driven).

## Migration History

- **20251119141839**: Initial `whatsapp_home_menu_items` table creation
- **20251122073534**: Aligned home menu with 8 AI agents + profile (partial cleanup)
- **20251122112950**: **Final cleanup** - Consolidated to exactly 9 canonical items, created backup table, soft-disabled legacy items

## References

- **Code**: `supabase/functions/wa-webhook/domains/menu/dynamic_home_menu.ts`
- **Migration**: `supabase/migrations/20251122112950_cleanup_home_menu_9_items.sql`
- **Backup table**: `whatsapp_home_menu_items_legacy`
- **Related docs**: `docs/architecture/agents-map.md`

## FAQ

### Why only 9 items?

A single-page WhatsApp menu provides the best UX. More items require pagination or scrolling, which degrades user experience.

### What if I need to access a legacy feature?

Legacy features are still accessible through:
1. **Alias routing**: Old keys automatically map to canonical agents
2. **Deep linking**: Direct conversation flows bypass the home menu
3. **Profile menu**: Secondary features accessible via the Profile agent

### Can I temporarily enable a legacy item?

Not recommended. Instead:
1. Add the feature as a **sub-menu** within a canonical agent
2. Use **feature flags** to gate experimental agents
3. Consider **replacing** an existing agent if the new one is more valuable

### How do I verify the cleanup worked?

Run this query after migration:

```sql
-- Should return exactly 9 rows
SELECT key, name, icon, is_active, display_order 
FROM whatsapp_home_menu_items 
WHERE is_active = true 
ORDER BY display_order;
```

### Where are the old items?

1. In `whatsapp_home_menu_items` with `is_active = false`
2. Backed up in `whatsapp_home_menu_items_legacy`
3. Aliased in code via `HOME_MENU_KEY_ALIASES`

---

**Last updated**: 2025-11-22  
**Maintained by**: EasyMO Platform Team
