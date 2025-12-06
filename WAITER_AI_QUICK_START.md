# 🚀 Waiter AI Agent - Quick Start Guide

**Status:** ✅ Deployed & Ready for UAT  
**Function:** wa-webhook-waiter  
**Endpoint:** https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-waiter

---

## ⚡ Quick Setup (5 Minutes)

### 1. Set Environment Variables
```bash
supabase secrets set \
  GEMINI_API_KEY=your_gemini_api_key \
  WA_ACCESS_TOKEN=your_whatsapp_access_token \
  WA_PHONE_NUMBER_ID=your_phone_number_id \
  WA_VERIFY_TOKEN=your_webhook_verify_token
```

### 2. Create Test Bar (Rwanda Example)
```sql
-- Insert bar
INSERT INTO bars (id, name, phone, owner_phone, currency, payment_settings)
VALUES (
  'test-bar-rwanda-001',
  'Test Bar Kigali',
  '250788123456',
  '250788123456',
  'RWF',
  '{"currency": "RWF", "momo_enabled": true}'::jsonb
);

-- Add menu items
INSERT INTO restaurant_menu_items (bar_id, name, price, currency, category, is_available)
VALUES 
  ('test-bar-rwanda-001', 'Primus Beer', 1500, 'RWF', 'Drinks', true),
  ('test-bar-rwanda-001', 'French Fries', 2000, 'RWF', 'Food', true),
  ('test-bar-rwanda-001', 'Grilled Chicken', 5000, 'RWF', 'Food', true);
```

### 3. Generate QR Code
```
URL Format: https://wa.me/250788123456?text=TABLE-A5-BAR-test-bar-rwanda-001

Use any QR code generator:
- qr-code-generator.com
- qrcode-monkey.com
- Or: qr "https://wa.me/250788123456?text=TABLE-A5-BAR-test-bar-rwanda-001" > qr_code.png
```

### 4. Configure WhatsApp Webhook
```
In Meta Business Suite > WhatsApp > Configuration:

Callback URL: https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-waiter
Verify Token: your_webhook_verify_token
Subscribe to: messages
```

### 5. Test!
1. Scan QR code with WhatsApp
2. Send: "Show me the menu"
3. Send: "I want 2 beers"
4. Send: "checkout"

---

## 🧪 Quick Test Commands

### View Logs
```bash
supabase functions logs wa-webhook-waiter --tail
```

### Check Sessions
```sql
SELECT visitor_phone, table_number, status, 
       jsonb_pretty(current_cart) as cart
FROM waiter_conversations
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 5;
```

### Check Orders
```sql
SELECT order_number, total_amount, currency, 
       payment_method, status, payment_status
FROM orders
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🇷🇼 Rwanda Setup (MoMo)

```sql
UPDATE bars 
SET currency = 'RWF',
    payment_settings = '{"currency": "RWF", "momo_enabled": true}'::jsonb
WHERE id = 'your-bar-id';
```

**Expected Checkout:**
```
📱 Pay with Mobile Money
To pay 5000 RWF:
1️⃣ Dial: *182*8*1*5000#
2️⃣ Enter your PIN
3️⃣ Confirm the payment
```

---

## 🇲🇹 Malta Setup (Revolut)

```sql
UPDATE bars 
SET currency = 'EUR',
    payment_settings = '{
      "currency": "EUR", 
      "revolut_link": "https://revolut.me/yourhandle"
    }'::jsonb
WHERE id = 'your-bar-id';
```

**Expected Checkout:**
```
💳 Pay with Revolut
Amount: 8.20 EUR
Tap the link: https://revolut.me/yourhandle/8.20.EUR?description=Order...
```

---

## 🐛 Troubleshooting

### Issue: Session not created
**Check:** QR code format correct? `TABLE-{NUM}-BAR-{UUID}`

### Issue: Menu not showing
**Check:**
```sql
SELECT COUNT(*) FROM restaurant_menu_items 
WHERE bar_id = 'your-bar-id' AND is_available = true;
```

### Issue: Wrong currency
**Check:**
```sql
SELECT currency, payment_settings FROM bars WHERE id = 'your-bar-id';
```

### Issue: No bar notification
**Check:**
```sql
SELECT phone, owner_phone FROM bars WHERE id = 'your-bar-id';
```

---

## 📱 Test Conversation Flow

```
Customer: [Scans QR]
Bot: 👋 Welcome to Test Bar Kigali! You're at Table A5...

Customer: "Show menu"
Bot: - Primus Beer (Drinks): 1500 RWF...

Customer: "2 beers and fries"
Bot: ✅ Added to cart: 2x Primus Beer, 1x French Fries (Total: 5000 RWF)

Customer: "checkout"
Bot: ✅ Order Confirmed! #ORD-ABC123
     📱 Pay with Mobile Money
     Dial: *182*8*1*5000#

Customer: [Taps "I've Paid"]
Bot: ✅ Thank you! Your order is being prepared...
```

---

## 📊 UAT Checklist

- [ ] Environment variables set
- [ ] Test bar created with menu
- [ ] QR code generated
- [ ] WhatsApp webhook configured
- [ ] Test 1: QR scan → Session created
- [ ] Test 2: "Show menu" → Menu displayed
- [ ] Test 3: "2 beers" → Fuzzy match works
- [ ] Test 4: Checkout → Payment instructions
- [ ] Test 5: Rwanda bar → MoMo USSD
- [ ] Test 6: Malta bar → Revolut + EUR
- [ ] Test 7: Bar notification sent
- [ ] Test 8: "I've Paid" → Status updated

---

## 📞 Support

**Logs:** `supabase functions logs wa-webhook-waiter --tail`  
**Docs:** See WAITER_AI_DEPLOY_NOW.md for detailed guide  
**Issues:** See WAITER_AI_CRITICAL_FIXES.md for known fixes

---

**Ready?** Scan a QR code and start testing! 🎉
