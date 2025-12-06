# 🧪 Waiter AI Agent - UAT Test Report

**Deployment Date:** 2025-12-06 18:31 UTC  
**Function ID:** d7211913-a414-412b-9d8a-14764ae73c28  
**Status:** ✅ DEPLOYED & ACTIVE  
**Version:** 1 (latest)

---

## ✅ Deployment Verification

### 1. Git Commit
```
commit 6c7fdfb5
fix(waiter-ai): resolve 11 critical showstopper bugs for production

Files changed: 8
- 5 TypeScript files fixed
- 3 documentation files added
Changes: +691 insertions, -375 deletions (-203 net lines)
```

### 2. Supabase Deployment
```
✅ Deployed Functions on project lhbowpbcpwoiparwnwgt
✅ Status: ACTIVE
✅ Version: 1
✅ Uploaded: 24 assets (including shared dependencies)
```

### 3. Function Endpoint
```
URL: https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-waiter
Health: /health endpoint available
Auth: Requires authorization header (expected for production)
```

---

## 🧪 UAT Test Scenarios

### Prerequisites
Before running tests, ensure:
- [ ] Environment variables set (GEMINI_API_KEY, WA_ACCESS_TOKEN, etc.)
- [ ] Database tables exist (bars, restaurant_menu_items, waiter_conversations, orders)
- [ ] Test bar configured with menu items
- [ ] WhatsApp webhook configured to point to function URL

### Test 1: QR Code Scanning (New Customer)
**Objective:** Verify new customers can scan QR and start ordering

**Steps:**
1. Generate QR code with format: `https://wa.me/{YOUR_NUMBER}?text=TABLE-A5-BAR-{bar_uuid}`
2. Scan QR code with WhatsApp
3. Observe welcome message

**Expected Result:**
```
👋 Welcome to {Bar Name}!

You're at Table A5.

I'm your AI waiter. I can help you:
• Browse our menu
• Place orders
• Process payments

Just tell me what you'd like! 😊
```

**Verification:**
```sql
-- Check session created
SELECT * FROM waiter_conversations 
WHERE visitor_phone = '{test_phone}' 
AND table_number = 'A5'
ORDER BY created_at DESC LIMIT 1;
```

**Status:** ⏳ Pending Test

---

### Test 2: Menu Browsing
**Objective:** Verify menu display works

**Steps:**
1. After welcome message, reply: "Show me the menu"
2. Observe menu list

**Expected Result:**
```
- Primus Beer (Drinks): 1500 RWF - Local favorite
- French Fries (Food): 2000 RWF - Crispy and golden
- Grilled Chicken (Food): 5000 RWF - Tender and juicy
```

**Verification:**
```sql
-- Check menu items available
SELECT id, name, price, currency, category, is_available
FROM restaurant_menu_items
WHERE bar_id = '{bar_uuid}'
AND is_available = true
ORDER BY category, name;
```

**Status:** ⏳ Pending Test

---

### Test 3: Fuzzy Order Matching (Rwanda)
**Objective:** Verify customers can order by saying "2 beers" without exact IDs

**Steps:**
1. Reply: "I want 2 beers and fries"
2. Observe AI response and cart update

**Expected Result:**
```
✅ Added to your cart:
2x Primus Beer
1x French Fries

Your cart: 2x Primus Beer, 1x French Fries (Total: 5000 RWF)

Would you like anything else, or ready to checkout?
```

**Verification:**
```sql
-- Check cart updated in session
SELECT current_cart FROM waiter_conversations
WHERE visitor_phone = '{test_phone}'
AND status = 'active';
```

**Status:** ⏳ Pending Test

---

### Test 4: Rwanda Checkout (MoMo USSD)
**Objective:** Verify MoMo USSD code generation

**Steps:**
1. Reply: "checkout"
2. Observe payment instructions

**Expected Result:**
```
✅ Order Confirmed!

📋 Order #ORD-ABC123
📍 Table: A5

Items:
2x Primus Beer
1x French Fries

💰 Total: 5,000 RWF

📱 Pay with Mobile Money

To pay 5000 RWF:

1️⃣ Dial: `*182*8*1*5000#`
2️⃣ Enter your PIN
3️⃣ Confirm the payment

Or tap this link to dial automatically:
tel:*182*8*1*5000%23

[Button: ✅ I've Paid]
[Button: ❓ Need Help]
```

**Verification:**
```sql
-- Check order created
SELECT id, order_number, status, total_amount, currency, 
       payment_method, payment_ussd_code
FROM orders
WHERE visitor_phone = '{test_phone}'
ORDER BY created_at DESC LIMIT 1;

-- Should show:
-- payment_method: 'momo'
-- payment_ussd_code: '*182*8*1*5000#'
```

**Status:** ⏳ Pending Test

---

### Test 5: Malta Checkout (Revolut + EUR)
**Objective:** Verify Malta bars use EUR and Revolut

**Setup:**
```sql
-- Configure Malta bar
UPDATE bars 
SET currency = 'EUR',
    payment_settings = '{"currency": "EUR", "revolut_link": "https://revolut.me/testbar"}'::jsonb
WHERE id = '{malta_bar_uuid}';

-- Add menu items in EUR
INSERT INTO restaurant_menu_items (bar_id, name, price, currency, category, is_available)
VALUES 
  ('{malta_bar_uuid}', 'Cisk Beer', 3.50, 'EUR', 'Drinks', true),
  ('malta_bar_uuid}', 'Pastizzi', 1.20, 'EUR', 'Food', true);
```

**Steps:**
1. Scan Malta bar QR code
2. Order items
3. Checkout

**Expected Result:**
```
💳 Pay with Revolut

Amount: 8.20 EUR

Tap the link below to pay securely:
https://revolut.me/testbar/8.20.EUR?description=Order%20ORD-XYZ789

After payment, tap "I've Paid" to confirm.

[Button: ✅ I've Paid]
```

**Verification:**
```sql
SELECT order_number, total_amount, currency, payment_method, payment_link
FROM orders
WHERE bar_id = '{malta_bar_uuid}'
ORDER BY created_at DESC LIMIT 1;

-- Should show:
-- currency: 'EUR'
-- payment_method: 'revolut'
-- payment_link: 'https://revolut.me/testbar/8.20.EUR...'
```

**Status:** ⏳ Pending Test

---

### Test 6: Bar Owner Notification
**Objective:** Verify bar owners receive WhatsApp notifications

**Steps:**
1. Complete checkout from Test 4 or 5
2. Check bar owner's WhatsApp

**Expected Result (Bar Owner Receives):**
```
🔔 NEW ORDER #ORD-ABC123

📍 Table: A5

🍽️ Items:
  2x Primus Beer - 3,000
  1x French Fries - 2,000

💰 Total: 5,000 RWF

⏰ 18:35

---
Reply with order number to update status.
```

**Verification:**
```sql
SELECT bar_notified, bar_notification_sent_at
FROM orders
WHERE order_number = 'ORD-ABC123';

-- Should show:
-- bar_notified: true
-- bar_notification_sent_at: timestamp
```

**Status:** ⏳ Pending Test

---

### Test 7: Payment Confirmation
**Objective:** Verify "I've Paid" button works

**Steps:**
1. After checkout, tap "✅ I've Paid" button
2. Observe confirmation message

**Expected Result:**
```
✅ Thank you! Your payment has been noted.

Your order is being prepared. We'll let you know when it's ready! 🍽️
```

**Verification:**
```sql
SELECT payment_status FROM orders
WHERE order_number = 'ORD-ABC123';

-- Should show: 'confirmed'
```

**Status:** ⏳ Pending Test

---

## 🔍 Debugging Commands

### View Live Logs
```bash
supabase functions logs wa-webhook-waiter --tail
```

### Check Environment Variables
```bash
supabase secrets list
```

### Test Database Connection
```sql
-- Check bars table
SELECT id, name, currency, payment_settings FROM bars LIMIT 5;

-- Check menu items
SELECT bar_id, COUNT(*) as item_count 
FROM restaurant_menu_items 
WHERE is_available = true
GROUP BY bar_id;
```

---

## 📊 Test Results Summary

| Test # | Scenario | Status | Notes |
|--------|----------|--------|-------|
| 1 | QR Code Scanning | ⏳ Pending | |
| 2 | Menu Browsing | ⏳ Pending | |
| 3 | Fuzzy Matching | ⏳ Pending | |
| 4 | Rwanda Checkout | ⏳ Pending | |
| 5 | Malta Checkout | ⏳ Pending | |
| 6 | Bar Notification | ⏳ Pending | |
| 7 | Payment Confirm | ⏳ Pending | |

**Legend:**
- ✅ Pass
- ❌ Fail
- ⏳ Pending
- ⚠️ Partial

---

## 🚨 Known Issues to Monitor

### Non-Critical (Won't Block Launch)
1. Shared file issues in `_shared/wa-webhook-shared/wa/ids.ts` (duplicate properties)
   - Impact: None on waiter agent functionality
   - Can be fixed separately

### Medium Priority
2. No multi-language support (English only)
3. No payment webhook verification
4. No real-time order status updates

---

## ✅ Next Actions After UAT

1. [ ] Complete all 7 UAT test scenarios
2. [ ] Document any issues found
3. [ ] Fix any critical issues
4. [ ] Configure production WhatsApp webhook URL
5. [ ] Set production environment variables
6. [ ] Generate QR codes for real bars/tables
7. [ ] Train bar staff on how system works
8. [ ] Monitor logs for first 24 hours

---

**Test Lead:** _______________  
**Date Completed:** _______________  
**Sign-off:** _______________

