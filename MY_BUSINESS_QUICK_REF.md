# My Business Workflow - Quick Reference

## 🚀 Quick Deploy
```bash
./deploy-my-business.sh
```

## 📋 Manual Deployment

### 1. Database
```bash
cd supabase
supabase db push  # Applies 6 migrations
```

### 2. Edge Functions
```bash
supabase functions deploy wa-webhook-profile
supabase functions deploy wa-webhook-waiter
```

### 3. Secrets (Required)
```bash
supabase secrets set GEMINI_API_KEY=your_gemini_api_key
```
Get key: https://aistudio.google.com/app/apikey

## 🧪 Test via WhatsApp

### Test 1: Profile Menu
```
User: "Profile"
Expected: List shows "🍽️ My Bars & Restaurants" (if user has bar/restaurant)
```

### Test 2: Business Search
```
User: "Profile" → "My Businesses" → "🔍 Search"
User: "Inzora Rooftop"
Expected: List of matching businesses with similarity scores
```

### Test 3: Menu Upload
```
User: "My Bars & Restaurants" → Select bar → "📸 Upload Menu"
User: [Send photo of menu]
Expected: AI extracts items, shows list by category
User: "✅ Save All"
Expected: Items saved to database
```

### Test 4: AI Ordering (Waiter)
```
Customer: "I want chicken wings and a beer"
Expected: AI confirms items, adds to cart
Customer: "Show cart"
Expected: Cart summary with total
Customer: "Checkout"
Expected: Order created, payment link sent, bar notified
```

## 📊 Database Schema

### New Tables
- `profile_menu_items` - 8 menu items with visibility rules
- `user_businesses` - Business ownership/claims
- `menu_upload_requests` - OCR processing history
- `waiter_conversations` - AI ordering sessions

### Enhanced Tables
- `restaurant_menu_items` - Added promotions, dietary tags
- `orders` - Added waiter session, dine-in table, payment links

### New Functions
- `get_profile_menu_items_v2()` - Dynamic menu with visibility
- `search_businesses_semantic()` - Fuzzy business search

## 🔑 Key IDS Constants

```typescript
MY_BARS_RESTAURANTS     // Show bars/restaurants list
BUSINESS_SEARCH         // Search for business to claim
BUSINESS_ADD_MANUAL     // Add business manually
BAR_UPLOAD_MENU         // Upload menu photo for OCR
BAR_MANAGE_MENU         // Edit menu items
BAR_VIEW_ORDERS         // View active orders
WAITER_CHECKOUT         // Checkout cart
MENU_TOGGLE_AVAILABLE   // Toggle item availability
MENU_SET_PROMO          // Set promotion price
```

## 📁 File Locations

### Migrations
`supabase/migrations/20251206_00[1-6]_*.sql`

### Profile Handlers
```
wa-webhook-profile/
  profile/menu_items.ts, home_dynamic.ts
  business/search.ts, add_manual.ts
  bars/index.ts, menu_upload.ts, menu_edit.ts, orders.ts
```

### Waiter AI
```
wa-webhook-waiter/
  index.ts, agent.ts, payment.ts, notify_bar.ts, deno.json
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "My Bars & Restaurants" not showing | Check business.category_name contains "bar" or "restaurant" |
| Menu OCR fails | Set GEMINI_API_KEY in Supabase secrets |
| Waiter AI not responding | User needs QR code session (`ORDER::BAR_ID::TABLE`) |
| Payment links not working | Check bars.payment_settings has momo_ussd_code or revolut_link |

## 📝 Logs
```bash
supabase functions logs wa-webhook-profile
supabase functions logs wa-webhook-waiter
```

## 📚 Full Documentation
See: `MY_BUSINESS_COMPLETE_IMPLEMENTATION.md`

---
**Status:** ✅ 100% Complete | 21 files created/updated  
**Date:** 2024-12-06
