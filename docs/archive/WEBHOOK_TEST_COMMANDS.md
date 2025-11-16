# Quick Test Commands - WhatsApp Webhook

## Test 1: Home Menu (No Duplicates)

```
Send to WhatsApp: "Hi"
Expected: Home menu with 10 items on page 1
✅ No "Duplicated row id" error
✅ "MOMO QR Code" displays fully
```

## Test 2: Bars Search with Preference

```
1. Tap: "Bars & Restaurants"
2. Select: "Live Music" (or any preference)
3. Share location
Expected: "Found X (live music) places near you!"
✅ Only RW/Malta/TZ bars
✅ Sorted by distance
```

## Test 3: Pagination

```
If >9 results:
Page 1: "🍺 Showing 1-9 of 27"
Tap "More"
Page 2: "🍺 Showing 10-18 of 27"
✅ No "{from}-{to}" dev jargon
```

## Test 4: Customer Support

```
1. Tap: "More services" (page 1)
2. Tap: "Customer Support" (page 2)
Expected: Contact information
✅ Single support entry (no duplicate)
```

## Database Quick Checks

```bash
# Check menu items (should be 13)
psql "$DATABASE_URL" -c "
  SELECT key, name, display_order, active_countries
  FROM whatsapp_home_menu_items
  ORDER BY display_order;
"

# Check bars function
psql "$DATABASE_URL" -c "
  SELECT nearby_bars_by_preference(-1.9441, 30.0619, 'all', 10.0, 9);
"

# Test specific country filtering
psql "$DATABASE_URL" -c "
  SELECT name, country FROM business
  WHERE tag_id = '3e1154e5-62bc-469f-a5a1-0698f017c47e'
    AND is_active = true
    AND UPPER(country) IN ('RW', 'RWANDA')
  LIMIT 5;
"
```

## Verify Deployment

```bash
# Check function status
supabase functions list

# View recent logs
supabase functions logs wa-webhook --tail

# Quick redeploy if needed
supabase functions deploy wa-webhook --no-verify-jwt
```

## What Was Fixed

1. ✅ Removed duplicate "support" menu item
2. ✅ Shortened "MOMO QR Code" title
3. ✅ Fixed country filtering (RW, Malta, TZ only)
4. ✅ Pagination messages render properly
5. ✅ Unique row IDs enforced in home menu

## What's NOT Done (User Requested)

- ❌ AI Waiter agent integration
- ❌ Real Estate AI agent integration
- ❌ OpenAI Deep Research property scraping
- ❌ Scheduled property data collection (9am, 2pm, 7pm)

These require separate implementation sessions.
