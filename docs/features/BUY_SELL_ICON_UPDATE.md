# ✅ Buy & Sell Icon Update

**Date**: December 10, 2025  
**Change**: Added 🛒 emoji to menu item name

## What Changed

Updated the `whatsapp_home_menu_items` table to include the 🛒 emoji in the menu name.

### Before

```
name: "Buy and Sell"
icon: "🛒"
```

### After

```
name: "🛒 Buy and Sell"
icon: "🛒"
```

## Why

The emoji needs to be in the name field so it displays together with the text in the WhatsApp menu.
The `icon` field is for reference/admin UI, but WhatsApp shows the `name` field.

## Files Changed

1. **Migration**: `supabase/migrations/20251210065800_add_icon_to_buy_sell_name.sql`
   - Updates existing row: `SET name = '🛒 Buy and Sell'`

2. **Seed**: `supabase/seed/seed.sql`
   - Updated default name: `'🛒 Buy and Sell'`
   - Updated country-specific names to include emoji:
     - RW: `'🛒 Kugura & Kugurisha'`
     - MT: `'🛒 Buy & Sell'`
     - BI: `'🛒 Acheter & Vendre'`
     - TZ: `'🛒 Nunua & Uza'`
     - CD: `'🛒 Acheter & Vendre'`
     - ZM: `'🛒 Buy & Sell'`
     - TG: `'🛒 Acheter & Vendre'`

## To Apply

The migration is committed. To apply it to your database:

```bash
# Option 1: Run the helper script
./apply-icon-update.sh

# Option 2: Push all pending migrations
npx supabase db push
# (Select Y when prompted)

# Option 3: Apply SQL directly (if you have psql access)
psql $DATABASE_URL -f supabase/migrations/20251210065800_add_icon_to_buy_sell_name.sql
```

## Verification

After applying, the WhatsApp home menu should show:

```
1. 🍽️ Waiter
2. 🚗 Rides
3. 💼 Jobs
4. 🛒 Buy and Sell  ← Now has emoji!
5. 🏠 Property Rentals
... etc
```

## Status

✅ Migration created  
✅ Seed updated  
✅ Committed to Git  
⏳ **Needs to be applied** (run `npx supabase db push`)

Once applied, users will see the 🛒 emoji before "Buy and Sell" in their WhatsApp menu.
