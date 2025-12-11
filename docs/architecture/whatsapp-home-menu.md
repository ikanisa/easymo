# WhatsApp Home Menu - 9 Canonical Items

**Last Updated**: 2025-11-22  
**Status**: Active - Simplified Names

## Overview

The WhatsApp home menu has been consolidated to **exactly 9 canonical items** with simplified,
user-friendly names:

- **8 Services**: Waiter, Rides, Jobs, Buy and Sell, Property Rentals, Farmers, Insurance, Support
- **1 Profile**: User profile, wallet, QR codes, assets

All legacy menu items have been soft-deleted (`is_active = false`) but are preserved for backward
compatibility through alias routing.

## 🎯 The 9 Canonical Menu Items

| #   | Icon | Name                 | Key                     | Description                                     |
| --- | ---- | -------------------- | ----------------------- | ----------------------------------------------- |
| 1️⃣  | 🍽️   | **Waiter**           | `waiter_agent`          | Find restaurants, bars, order food              |
| 2️⃣  | 🚗   | **Rides**            | `rides_agent`           | Book rides, find drivers, schedule trips        |
| 3️⃣  | 💼   | **Jobs**             | `jobs_agent`            | Find jobs, post gigs, career advice             |
| 4️⃣  | 🏪   | **Buy and Sell**     | `business_broker_agent` | Find businesses, services, shops, list products |
| 5️⃣  | 🏠   | **Property Rentals** | `real_estate_agent`     | Search properties, rent apartments              |
| 6️⃣  | 🌾   | **Farmers**          | `farmer_agent`          | Agricultural products, farming tools            |
| 7️⃣  | 🛡️   | **Insurance**        | `insurance_agent`       | Motor insurance quotes, policies                |
| 8️⃣  | 📞   | **Support**          | `sales_agent`           | Customer support, platform help                 |
| 9️⃣  | 👤   | **Profile**          | `profile`               | Wallet, QR codes, token transfer, assets        |

### Name Evolution

| Original Name   | Intermediate Name | **Final Name**          |
| --------------- | ----------------- | ----------------------- |
| Waiter AI       | Waiter AI         | **Waiter** ✨           |
| Rides AI        | Rides AI          | **Rides** ✨            |
| Jobs AI         | Jobs AI           | **Jobs** ✨             |
| Business Finder | Business Broker   | **Buy and Sell** ✨     |
| Property AI     | Real Estate       | **Property Rentals** ✨ |
| Farmer AI       | Farmer AI         | **Farmers** ✨          |
| Insurance AI    | Insurance AI      | **Insurance** ✨        |
| Sales AI        | Sales SDR         | **Support** ✨          |
| My Profile      | Profile           | **Profile** ✨          |

### UUIDs (Production)

```typescript
const CANONICAL_IDS = {
  waiter_agent: "a1000001-0000-0000-0000-000000000001",
  rides_agent: "a1000002-0000-0000-0000-000000000002",
  jobs_agent: "a1000003-0000-0000-0000-000000000003",
  business_broker_agent: "a1000004-0000-0000-0000-000000000004",
  real_estate_agent: "a1000005-0000-0000-0000-000000000005",
  farmer_agent: "b1ef9975-27b1-4f67-848d-0c21c0ada9d2",
  insurance_agent: "382626fc-e270-4d2c-8b47-cc606ebc0592",
  sales_agent: "a1000008-0000-0000-0000-000000000008",
  profile: "a1000009-0000-0000-0000-000000000009",
};
```

## 📊 Migration History

### Phase 1: Consolidation (20251122112950)

- Reduced from 20+ items to 9 canonical items
- Soft-deleted legacy items
- Created alias mapping system

### Phase 2: Name Standardization (20251122150000)

- Renamed: Business Finder → Business Broker
- Renamed: Property AI → Real Estate
- Renamed: Sales AI → Sales SDR
- Renamed: My Profile → Profile

### Phase 3: Simplified Names (20251122160000) ✨ **Latest**

- **Waiter AI** → **Waiter**
- **Rides AI** → **Rides**
- **Jobs AI** → **Jobs**
- **Business Broker** → **Buy and Sell**
- **Real Estate** → **Property Rentals**
- **Farmer AI** → **Farmers**
- **Insurance AI** → **Insurance**
- **Sales SDR** → **Support**
- **Profile** → **Profile** (unchanged)

## 💻 Code Integration

### Alias Mapping (Unchanged)

**File**: `supabase/functions/wa-webhook/config/home_menu_aliases.ts`

The alias mapping remains the same - only display names changed:

```typescript
import { normalizeMenuKey } from "../config/home_menu_aliases.ts";

// Legacy keys still map to canonical keys
const key = normalizeMenuKey("jobs_gigs"); // returns 'jobs_agent'
const key2 = normalizeMenuKey("business_finder"); // returns 'business_broker_agent'
```

### Query Pattern

**Always filter by `is_active = true`**:

```typescript
// Fetch active menu items - will show new names
const { data } = await supabase
  .from("whatsapp_home_menu_items")
  .select("*")
  .eq("is_active", true)
  .order("display_order");

// Result: 9 rows with simplified names
// [
//   { key: 'waiter_agent', name: 'Waiter', icon: '🍽️', ... },
//   { key: 'rides_agent', name: 'Rides', icon: '🚗', ... },
//   { key: 'jobs_agent', name: 'Jobs', icon: '💼', ... },
//   { key: 'business_broker_agent', name: 'Buy and Sell', icon: '🏪', ... },
//   ...
// ]
```

## 🎨 User Experience

### Before Cleanup (20+ items)

```
WhatsApp Home Menu:
1. Waiter AI
2. Rides AI
3. Schedule Trip ❌ (duplicate)
4. Nearby Drivers ❌ (duplicate)
5. Jobs AI
6. Jobs & Gigs ❌ (duplicate)
7. Business Finder
8. Nearby Pharmacies ❌ (should be in Business)
9. Quincailleries ❌ (should be in Business)
... 20+ items total 🔥
```

### After Consolidation (9 items with AI names)

```
WhatsApp Home Menu:
1. 🍽️ Waiter AI
2. 🚗 Rides AI
3. 💼 Jobs AI
4. 🏪 Business Broker
5. 🏠 Real Estate
6. 🌾 Farmer AI
7. 🛡️ Insurance AI
8. 📞 Sales SDR
9. 👤 Profile
```

### Current (9 items with simplified names) ✨

```
WhatsApp Home Menu:
1. 🍽️ Waiter
2. 🚗 Rides
3. 💼 Jobs
4. 🏪 Buy and Sell
5. 🏠 Property Rentals
6. 🌾 Farmers
7. 🛡️ Insurance
8. 📞 Support
9. 👤 Profile

CLEAN & SIMPLE! ✨
```

## 🚀 Deployment

### Prerequisites

- ✅ Consolidation migration: `20251122112950_cleanup_home_menu_9_items.sql`
- ✅ Admin removal: `20251122150000_remove_admin_menu_item.sql`
- ✅ **Name simplification**: `20251122160000_rename_home_menu_items_simplified.sql`

### Deployment Steps

```bash
# 1. Push migrations to Supabase
supabase db push

# 2. Verify new names
supabase db query "
SELECT key, name, icon, display_order
FROM whatsapp_home_menu_items
WHERE is_active = true
ORDER BY display_order;
"

# Expected output:
# waiter_agent         | Waiter            | 🍽️ | 1
# rides_agent          | Rides             | 🚗 | 2
# jobs_agent           | Jobs              | 💼 | 3
# business_broker_agent| Buy and Sell      | 🏪 | 4
# real_estate_agent    | Property Rentals  | 🏠 | 5
# farmer_agent         | Farmers           | 🌾 | 6
# insurance_agent      | Insurance         | 🛡️ | 7
# sales_agent          | Support           | 📞 | 8
# profile              | Profile           | 👤 | 9

# 3. Deploy edge functions (if needed)
supabase functions deploy wa-webhook

# 4. Test with WhatsApp
# Send message to bot, check home menu shows new names
```

## 📞 Benefits of Simplified Names

### ✅ User-Friendly

- **Shorter**: "Waiter" vs "Waiter AI"
- **Clearer**: "Buy and Sell" vs "Business Broker"
- **Natural**: "Property Rentals" vs "Real Estate"
- **Familiar**: "Support" vs "Sales SDR"

### ✅ Better Localization

- Easier to translate to Kinyarwanda, French
- More natural language across cultures
- Less technical jargon

### ✅ Reduced Cognitive Load

- Users instantly understand what each option does
- No need to decipher "AI" or technical terms
- Faster navigation and decision-making

---

**Status**: ✅ Menu successfully simplified with user-friendly names  
**Items**: 9 clean, canonical items  
**User Impact**: More intuitive, faster to understand

🎉 **The WhatsApp home menu is now clean AND simple!**
