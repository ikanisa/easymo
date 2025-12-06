# 🚀 Waiter AI Agent - Deploy Now Guide

## ✅ All Critical Bugs Fixed

**Status:** Ready for UAT deployment  
**Files Modified:** 5  
**Critical Issues Resolved:** 11  
**Compilation:** ✅ Clean (waiter-specific files)

## �� What Was Fixed

### Showstopper Bugs (Would Crash in Production)
1. ✅ Duplicate `serve()` function removed from index.ts
2. ✅ Duplicate payment functions removed from payment.ts
3. ✅ Duplicate code removed from notify_bar.ts
4. ✅ Malformed deno.json fixed

### Critical Logic Bugs (Would Fail Silently)
5. ✅ Session creation now works (QR code parsing added)
6. ✅ Menu item fuzzy matching (customers can say "beer" not just IDs)
7. ✅ Currency detection fixed (Malta bars use EUR correctly)
8. ✅ Database schema fixed (bar_id instead of business_id)
9. ✅ Sort order removed (column doesn't exist)

### API Integration Fixes
10. ✅ Function import fixed (sendTextMessage)
11. ✅ WhatsApp message sending connected

## 📦 Deployment Steps

### 1. Pre-Deploy Checklist
```bash
# Verify files are clean
cd /Users/jeanbosco/workspace/easymo
git status supabase/functions/wa-webhook-waiter/

# Files should show:
# - index.ts (modified)
# - agent.ts (modified)
# - payment.ts (modified)
# - notify_bar.ts (modified)
# - deno.json (modified)
```

### 2. Deploy to Supabase
```bash
# Login to Supabase (if not already)
supabase login

# Link to your project (if not already)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the waiter webhook
supabase functions deploy wa-webhook-waiter

# Expected output:
# ✓ Deployed function wa-webhook-waiter
# Function URL: https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-waiter
```

### 3. Set Environment Variables
```bash
# Required for the agent to work
supabase secrets set \
  GEMINI_API_KEY=your_gemini_key \
  WA_ACCESS_TOKEN=your_whatsapp_token \
  WA_PHONE_NUMBER_ID=your_phone_number_id \
  WA_VERIFY_TOKEN=your_verify_token
```

### 4. Verify Deployment
```bash
# Test health endpoint
curl https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-waiter/health

# Expected response:
# {
#   "status": "healthy",
#   "service": "wa-webhook-waiter",
#   "version": "1.0.0",
#   "timestamp": "2025-12-06T..."
# }
```

## 🧪 UAT Test Plan

### Test 1: QR Code Scanning (New Customer)
1. Generate QR code with format: `https://wa.me/YOUR_NUMBER?text=TABLE-A5-BAR-{bar_uuid}`
2. Customer scans QR code
3. **Expected:** Welcome message with menu introduction
4. **Verify:** Check `waiter_conversations` table for new session

### Test 2: Menu Browsing
1. Customer says: "Show me the menu"
2. **Expected:** List of available items with prices
3. **Verify:** Menu items from `restaurant_menu_items` where `is_available=true`

### Test 3: Ordering with Fuzzy Matching (Rwanda)
1. Customer says: "I want 2 beers and fries"
2. **Expected:** Items added to cart (fuzzy name matching)
3. Customer says: "checkout"
4. **Expected:** MoMo USSD code displayed: `*182*8*1*AMOUNT#`
5. **Verify:** Order created in `orders` table with `payment_method=momo`

### Test 4: Ordering (Malta - EUR)
1. Set bar currency to EUR: `UPDATE bars SET currency='EUR' WHERE id='{bar_id}'`
2. Customer orders items
3. Customer says: "checkout"
4. **Expected:** Revolut payment link displayed
5. **Verify:** Order created with `payment_method=revolut`

### Test 5: Bar Notification
1. Complete an order
2. **Expected:** Bar owner receives WhatsApp message with order details
3. **Verify:** Check bar owner's WhatsApp for notification
4. **Verify:** `orders.bar_notified=true` and `bar_notification_sent_at` set

### Test 6: Payment Confirmation
1. Customer clicks "I've Paid" button
2. **Expected:** Thank you message
3. **Verify:** `orders.payment_status='confirmed'`

## 🔍 Debugging

### Check Logs
```bash
# View real-time logs
supabase functions logs wa-webhook-waiter --tail

# Look for:
# - WAITER_MESSAGE_RECEIVED
# - WAITER_ORDER_CREATED
# - BAR_NOTIFIED_NEW_ORDER
```

### Common Issues

#### Issue: "Session not created"
**Fix:** Verify QR code format: `TABLE-{TABLE_NUM}-BAR-{UUID}`

#### Issue: "Menu items not found"
**Fix:** Check `restaurant_menu_items` table has items with `bar_id` and `is_available=true`

#### Issue: "MoMo code not generated"
**Fix:** Verify bar has `currency='RWF'` or `payment_settings.currency='RWF'`

#### Issue: "Revolut link missing"
**Fix:** Ensure `bars.payment_settings` has `revolut_link` field set

## 📊 Database Requirements

### Required Tables
- ✅ `bars` (with `currency` column)
- ✅ `restaurant_menu_items` (with `bar_id`, `is_available`)
- ✅ `waiter_conversations`
- ✅ `orders` (with `bar_id` column - NOT business_id)
- ✅ `order_items`

### Sample Bar Setup (Rwanda)
```sql
UPDATE bars 
SET 
  currency = 'RWF',
  payment_settings = '{"currency": "RWF", "momo_enabled": true}'::jsonb
WHERE id = 'your-bar-uuid';
```

### Sample Bar Setup (Malta)
```sql
UPDATE bars 
SET 
  currency = 'EUR',
  payment_settings = '{"currency": "EUR", "revolut_link": "https://revolut.me/yourhandle"}'::jsonb
WHERE id = 'your-bar-uuid';
```

### Sample Menu Items
```sql
INSERT INTO restaurant_menu_items (bar_id, name, price, currency, category, is_available)
VALUES 
  ('bar-uuid', 'Primus Beer', 1500, 'RWF', 'Drinks', true),
  ('bar-uuid', 'French Fries', 2000, 'RWF', 'Food', true),
  ('bar-uuid', 'Grilled Chicken', 5000, 'RWF', 'Food', true);
```

## 🎉 Success Criteria

- ✅ New customers can scan QR and start ordering
- ✅ Fuzzy matching works ("2 beers" → finds "Primus Beer")
- ✅ Rwanda bars generate MoMo USSD codes
- ✅ Malta bars generate Revolut links
- ✅ Bar owners receive WhatsApp notifications
- ✅ Orders are saved to database
- ✅ Payment confirmation works

## 🚨 Rollback Plan

If issues occur:
```bash
# Revert to previous version
git checkout HEAD~1 supabase/functions/wa-webhook-waiter/
supabase functions deploy wa-webhook-waiter
```

## 📞 Support

If deployment fails, check:
1. Supabase logs: `supabase functions logs wa-webhook-waiter`
2. Environment variables: `supabase secrets list`
3. Database schema matches requirements above
4. WhatsApp webhook is pointing to correct URL

---

**Ready to Deploy?** Run: `supabase functions deploy wa-webhook-waiter`
