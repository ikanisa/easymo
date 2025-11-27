# Apply Menu Descriptions Migration

**Migration:** `20251127101600_add_menu_descriptions.sql`  
**Status:** Committed but needs manual application

---

## Option 1: Via Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql
2. Copy and paste the migration content:

```sql
BEGIN;

-- Add description column
ALTER TABLE public.whatsapp_home_menu_items 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Update with emojis and descriptions
UPDATE public.whatsapp_home_menu_items
SET name = '🍽️ Waiter AI', description = 'Order food, book tables, get restaurant recommendations'
WHERE key = 'waiter_agent';

UPDATE public.whatsapp_home_menu_items
SET name = '🚗 Rides & Delivery', description = 'Request rides, deliveries, track trips, manage bookings'
WHERE key = 'rides_agent';

UPDATE public.whatsapp_home_menu_items
SET name = '💼 Jobs & Careers', description = 'Find jobs, post openings, hire talent, career support'
WHERE key = 'jobs_agent';

UPDATE public.whatsapp_home_menu_items
SET name = '🛡️ Insurance', description = 'Buy coverage, manage policies, file claims, get quotes'
WHERE key = 'insurance_agent';

UPDATE public.whatsapp_home_menu_items
SET name = '🏠 Property Rentals', description = 'Find rentals, list properties, manage leases'
WHERE key = 'property_agent';

UPDATE public.whatsapp_home_menu_items
SET name = '🛒 Marketplace', description = 'Buy & sell items, browse products, manage listings'
WHERE key = 'marketplace_agent';

UPDATE public.whatsapp_home_menu_items
SET name = '🏢 Business Broker', description = 'Buy/sell businesses, get valuations, find opportunities'
WHERE key = 'business_broker_agent';

UPDATE public.whatsapp_home_menu_items
SET name = '🤝 General Services', description = 'Brokers, agents, services, professional help'
WHERE key = 'general_broker_agent';

UPDATE public.whatsapp_home_menu_items
SET name = '🌾 Farmer Support', description = 'Crop advice, market prices, weather, farming tips'
WHERE key = 'farmer_agent';

UPDATE public.whatsapp_home_menu_items
SET name = '💎 Wallet & Profile', description = 'Manage tokens, send money, update profile, settings'
WHERE key = 'wallet';

COMMIT;
```

3. Click "Run"

---

## Option 2: Via CLI

```bash
supabase db push --include-all
# When prompted, press Y
```

---

## Verification

After applying, verify:

```sql
SELECT key, name, description 
FROM whatsapp_home_menu_items 
WHERE is_active = true
ORDER BY display_order;
```

Expected output should show emojis in names and descriptions for all items.

---

## What This Does

- Adds `description` column to table
- Updates all menu item names to include emojis
- Adds helpful descriptions (max 72 chars per WhatsApp limits)
- Home menu will now show richer information to users

