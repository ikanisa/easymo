# EasyMO Workflows Quick Start Guide
**Date**: 2025-11-23  
**Purpose**: Activate and test all implemented workflows

## 🎯 Executive Summary

**All workflows are ALREADY implemented**. This guide shows you how to activate and test them.

---

## 📋 Prerequisites

```bash
# 1. Ensure you're in the project directory
cd /Users/jeanbosco/workspace/easymo-

# 2. Verify migrations are applied
supabase db push

# 3. Check edge functions are deployed
supabase functions list
```

---

## 🔐 Step 1: Set Environment Variables (CRITICAL)

```bash
# Set API keys (server-side only, NOT client-facing)
supabase secrets set OPENAI_API_KEY="sk-your-openai-key-here"
supabase secrets set GEMINI_API_KEY="AIza-your-gemini-key-here"

# Optional: Insurance bucket name (defaults to "insurance-docs")
supabase secrets set INSURANCE_MEDIA_BUCKET="insurance-docs"

# Verify secrets are set (won't show values)
supabase secrets list
```

**⚠️ SECURITY**: Never use `VITE_*` or `NEXT_PUBLIC_*` prefix for API keys!

---

## 🚀 Step 2: Deploy Edge Functions

```bash
# Deploy insurance OCR processor
supabase functions deploy insurance-ocr

# Deploy main webhook handlers (if not already deployed)
supabase functions deploy wa-webhook
supabase functions deploy wa-webhook-wallet
supabase functions deploy wa-webhook-mobility

# Verify deployment
supabase functions list
```

---

## 📦 Step 3: Create Storage Bucket

```bash
# Create insurance documents bucket (if not exists)
supabase storage create insurance-docs --public=false

# Verify bucket
supabase storage list
```

---

## ✅ Step 4: Verify Implementation

Run the verification script:

```bash
./verify-workflows-2025-11-23.sh
```

Or manually check database:

```bash
# Check insurance tables
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'insurance%';"

# Check referral tables
psql $DATABASE_URL -c "SELECT * FROM referral_links LIMIT 5;"

# Check countries with MOMO support
psql $DATABASE_URL -c "SELECT name, code, momo_supported FROM countries WHERE momo_supported = true;"

# Check wallet RPC functions
psql $DATABASE_URL -c "\df wallet_*"

# Check location caching columns
psql $DATABASE_URL -c "\d+ profiles" | grep last_location
```

---

## 🧪 Step 5: Test Each Workflow

### 1️⃣ Insurance Workflow

**Via WhatsApp**:
1. Send message: "I need motor insurance"
2. Agent responds with insurance options
3. Upload vehicle registration document (image)
4. System processes OCR automatically
5. Admin receives notification with extracted data

**Verify Backend**:
```bash
# Check OCR queue processing
curl -X POST "https://your-project.supabase.co/functions/v1/insurance-ocr" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# Check admin contacts
psql $DATABASE_URL -c "SELECT * FROM insurance_admin_contacts WHERE is_active = true;"

# Check recent leads
psql $DATABASE_URL -c "SELECT id, whatsapp, status, created_at FROM insurance_leads ORDER BY created_at DESC LIMIT 5;"
```

---

### 2️⃣ Referral System (Share easyMO)

**Via WhatsApp**:
1. Send message: "Wallet"
2. Select: "💰 Earn tokens"
3. Choose: "Share via WhatsApp" or "Share via QR Code"
4. System generates:
   - Unique referral code (e.g., "ABC123")
   - WhatsApp deep link: `wa.me/+22893002751?text=JOIN%20ABC123`
   - QR code image (via QuickChart API)
5. Share link/QR with friend
6. When friend sends first message with code, both get tokens

**Test Referral Application**:
```bash
# As new user, send: "JOIN ABC123"
# System should:
# 1. Validate code
# 2. Award 10 tokens to referrer
# 3. Send notification to referrer
# 4. Create attribution record
```

**Verify Backend**:
```bash
# Check your referral code
psql $DATABASE_URL -c "SELECT code, short_url FROM referral_links WHERE user_id = 'YOUR_USER_ID';"

# Check attributions
psql $DATABASE_URL -c "SELECT * FROM referral_attributions WHERE credited = true ORDER BY created_at DESC LIMIT 5;"
```

---

### 3️⃣ MOMO QR Code Generation

**Via Admin Panel**:
1. Access admin interface
2. Navigate to "MoMo QR" (ID: `ADMIN::OPS_MOMO`)
3. Enter:
   - Target: Phone number (e.g., 250788123456) OR Merchant code (e.g., 123456)
   - Amount: Optional (e.g., 1000 RWF)
4. System generates:
   - USSD code: `*182*8*1*123456*1000#`
   - Tel URI: `tel:*182*8*1*123456*1000%23`
   - QR code URL: `https://quickchart.io/qr?text=...`
5. Display QR code to user
6. User scans with phone → Opens MTN MoMo app

**Verify Countries**:
```bash
psql $DATABASE_URL -c "SELECT name, code, phone_code, momo_supported FROM countries ORDER BY name;"
```

**Test QR Generation Manually**:
```bash
# Example: Generate QR for merchant code 123456 with 1000 RWF
# USSD: *182*8*1*123456*1000#
# URL encode and generate QR:
curl "https://quickchart.io/qr?text=tel:*182*8*1*123456*1000%23" > test_qr.png
```

---

### 4️⃣ Wallet & Tokens

**Via WhatsApp**:

**A. View Balance**:
1. Send: "Wallet"
2. System shows current token balance

**B. Transfer Tokens** (min 2000):
1. Send: "Wallet"
2. Select: "💸 Transfer"
3. Choose recipient or enter phone number
4. Enter amount (e.g., 2500)
5. System validates:
   - Balance ≥ 2000
   - Amount > 0
6. Transfer completes
7. Recipient receives notification

**C. Redeem Tokens** (min 2000):
1. Send: "Wallet"
2. Select: "🎁 Redeem"
3. Choose partner
4. Enter amount
5. System processes redemption

**Verify Backend**:
```bash
# Check balance RPC
psql $DATABASE_URL -c "SELECT wallet_get_balance('USER_ID_HERE');"

# Check recent transfers
psql $DATABASE_URL -c "SELECT * FROM wallet_transfers ORDER BY created_at DESC LIMIT 5;"

# Check wallet transactions
psql $DATABASE_URL -c "SELECT * FROM wallet_transactions ORDER BY created_at DESC LIMIT 10;"
```

**Test Minimum Balance Enforcement**:
```bash
# User with <2000 tokens attempts transfer
# Expected: Error message "⚠️ You need at least 2000 tokens to transfer..."
```

---

### 5️⃣ Rides with Location Caching

**Via WhatsApp**:

**As Passenger (Find Driver)**:
1. Send: "Rides" or "Find driver"
2. System asks: "Share your pickup location"
3. Send location (WhatsApp location message)
4. System caches location in `profiles.last_location` for 30 min
5. Choose vehicle type (Moto, Cab, Lifan, Truck)
6. System searches 10km radius for drivers
7. Shows nearby drivers with:
   - Distance (e.g., "2.3 km")
   - Time (e.g., "5 mins ago")
   - Contact button
8. Within 30 min, subsequent searches use cached location

**As Driver (Go Online)**:
1. Send: "Rides" or "Driver"
2. Select: "🟢 Go Online"
3. Share location
4. System caches location
5. You appear in nearby searches for passengers
6. Receive notifications when passengers search nearby

**Verify Backend**:
```bash
# Check location caching
psql $DATABASE_URL -c "SELECT user_id, ST_AsText(last_location), last_location_at FROM profiles WHERE last_location IS NOT NULL ORDER BY last_location_at DESC LIMIT 5;"

# Check spatial index exists
psql $DATABASE_URL -c "\di profiles_last_location_idx"

# Check ride requests
psql $DATABASE_URL -c "SELECT * FROM ride_requests ORDER BY created_at DESC LIMIT 5;"

# Check driver notifications
psql $DATABASE_URL -c "SELECT * FROM ride_notifications ORDER BY created_at DESC LIMIT 5;"
```

**Test Location Cache Expiry**:
```bash
# 1. Share location → cached
# 2. Wait 30+ minutes
# 3. Try to find driver again
# Expected: System asks for location again (cache expired)
```

---

## 📊 Monitoring & Observability

All workflows include structured logging. Check logs:

```bash
# View edge function logs
supabase functions logs insurance-ocr
supabase functions logs wa-webhook

# Filter for specific events
supabase functions logs wa-webhook --filter "insurance"
supabase functions logs wa-webhook --filter "referral"
supabase functions logs wa-webhook --filter "wallet"
```

**Key Events**:
- `insurance.ocr_started`
- `insurance.admin_notified`
- `referral.share_qr`
- `referral.applied`
- `wallet.transfer_completed`
- `rides.location_cached`
- `rides.driver_matched`

---

## 🔧 Troubleshooting

### Insurance OCR not processing

**Check**:
```bash
# 1. OpenAI API key set
supabase secrets list | grep OPENAI

# 2. Queue has items
psql $DATABASE_URL -c "SELECT COUNT(*) FROM insurance_media_queue WHERE status IN ('queued', 'retry');"

# 3. Manually trigger OCR
curl -X POST "https://your-project.supabase.co/functions/v1/insurance-ocr" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# 4. Check logs
supabase functions logs insurance-ocr --tail
```

---

### Referral code not working

**Check**:
```bash
# 1. Code exists
psql $DATABASE_URL -c "SELECT * FROM referral_links WHERE code = 'ABC123';"

# 2. RPC function exists
psql $DATABASE_URL -c "SELECT proname FROM pg_proc WHERE proname = 'referral_apply_code_v2';"

# 3. Check attribution
psql $DATABASE_URL -c "SELECT * FROM referral_attributions WHERE code = 'ABC123';"
```

---

### MOMO QR not generating

**Check**:
```bash
# 1. Countries table populated
psql $DATABASE_URL -c "SELECT COUNT(*) FROM countries WHERE momo_supported = true;"

# 2. Test QuickChart API manually
curl "https://quickchart.io/qr?text=test" > test.png

# 3. Check momo_qr_requests table
psql $DATABASE_URL -c "SELECT * FROM momo_qr_requests ORDER BY created_at DESC LIMIT 5;"
```

---

### Wallet transfer failing

**Check**:
```bash
# 1. Balance sufficient
psql $DATABASE_URL -c "SELECT wallet_get_balance('USER_ID');"

# 2. RPC function works
psql $DATABASE_URL -c "SELECT wallet_transfer_tokens('SENDER_ID', '+250788123456', 2000, 'test-idem-key');"

# 3. Check minimum balance enforcement
# User with <2000 should see error message
```

---

### Location caching not working

**Check**:
```bash
# 1. Columns exist
psql $DATABASE_URL -c "\d+ profiles" | grep last_location

# 2. Spatial index exists
psql $DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE indexname = 'profiles_last_location_idx';"

# 3. Check cached locations
psql $DATABASE_URL -c "SELECT user_id, last_location_at FROM profiles WHERE last_location IS NOT NULL;"
```

---

## 🎓 Additional Resources

- **Full Analysis**: See `DEEP_REPOSITORY_ANALYSIS_2025-11-23.md`
- **Verification Script**: Run `./verify-workflows-2025-11-23.sh`
- **Ground Rules**: See `docs/GROUND_RULES.md`
- **Architecture**: See `docs/ARCHITECTURE.md`

---

## 📞 Support

If workflows still don't work after following this guide:

1. **Check migrations applied**: `supabase db push`
2. **Verify edge functions deployed**: `supabase functions list`
3. **Review logs**: `supabase functions logs wa-webhook --tail`
4. **Test database connectivity**: `psql $DATABASE_URL -c "SELECT NOW();"`
5. **Confirm environment variables**: `supabase secrets list`

---

## ✨ Summary

| Workflow | Status | Test Command |
|----------|--------|--------------|
| Insurance OCR | ✅ Ready | Send "I need motor insurance" via WhatsApp |
| Referral System | ✅ Ready | Send "Wallet" → "Earn" → Share QR |
| MOMO QR | ✅ Ready | Admin panel → "MoMo QR" |
| Wallet Transfers | ✅ Ready | Send "Wallet" → "Transfer" (need 2000+ tokens) |
| Rides Location Cache | ✅ Ready | Send "Rides" → Share location |

**All implementations follow GROUND_RULES**:
- ✅ Structured logging with correlation IDs
- ✅ RLS policies for security
- ✅ Feature flags ready
- ✅ Error handling and retry logic
- ✅ No secrets in client-facing vars

**Next Step**: Set `OPENAI_API_KEY` and `GEMINI_API_KEY`, then test!

---

**Generated**: 2025-11-23  
**Confidence**: High (Code-verified)
