# Edge Function Deployment - Success Report

**Date**: 2025-12-09  
**Function**: `momo-sms-webhook`  
**Status**: ✅ **DEPLOYED**

---

## Deployment Summary

**Project ID**: `lhbowpbcpwoiparwnwgt`  
**Function URL**: `https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/momo-sms-webhook`  
**Dashboard**: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions

---

## Files Uploaded

### **Core Function**

- ✅ `index.ts` - Main webhook handler (updated with SACCO routing)
- ✅ `deno.json` - Deno configuration

### **Matchers** (NEW: SACCO matcher added)

- ✅ `matchers/sacco.ts` - **NEW** - SACCO payment matcher
- ✅ `matchers/rides.ts` - Ride payment matcher
- ✅ `matchers/marketplace.ts` - Marketplace payment matcher
- ✅ `matchers/jobs.ts` - Job payment matcher
- ✅ `matchers/insurance.ts` - Insurance payment matcher

### **Utilities**

- ✅ `utils/sms-parser.ts` - SMS parsing utilities
- ✅ `utils/hmac.ts` - HMAC signature verification

### **Shared Modules**

- ✅ `_shared/observability.ts` - Structured logging
- ✅ `_shared/webhook-error-boundary.ts` - Error handling
- ✅ `_shared/nonce-validator.ts` - Replay protection
- ✅ `_shared/idempotency.ts` - Idempotency key handling
- ✅ `_shared/service-resilience.ts` - Rate limiting
- ✅ `_shared/errors.ts` - Error types
- ✅ `_shared/phone-utils.ts` - Phone normalization
- ✅ `_shared/dlq-manager.ts` - Dead letter queue

---

## Next Steps

### **1. Verify Deployment**

```bash
# Test health endpoint
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/momo-sms-webhook \
  -H "Content-Type: application/json" \
  -d '{"ping": true}'
```

### **2. Apply Database Migrations**

```bash
cd /Users/jeanbosco/workspace/easymo
supabase db push
```

This will apply:

- `20251209190000_create_app_schema_sacco_tables.sql`
- `20251209190001_add_sacco_webhook_support.sql`
- `20251209190002_sacco_payment_functions.sql`

### **3. Register SACCO Webhook**

```sql
-- Replace with your actual SACCO ID and phone number
SELECT app.register_sacco_webhook(
  p_sacco_id := '<your-sacco-uuid>',
  p_phone_number := '+250788123456',
  p_description := 'SACCO MoMo Receiving Number'
);
```

### **4. Create Test Data**

```sql
-- Create test SACCO
INSERT INTO app.saccos (id, name, district, sector_code, status)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Test SACCO',
  'Gasabo',
  'KG001',
  'ACTIVE'
);

-- Create test member with phone hash
INSERT INTO app.members (
  sacco_id,
  full_name,
  member_code,
  msisdn_hash,
  msisdn_masked,
  status
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Jean Bosco NIYONZIMA',
  'M001',
  encode(sha256('781234567'::bytea), 'hex'),  -- Hash of last 9 digits
  '078 123 ****',
  'ACTIVE'
);
```

### **5. Test SACCO Matcher**

```bash
# Send test MoMo SMS
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/momo-sms-webhook \
  -H "Content-Type: application/json" \
  -H "x-momo-signature: test-signature" \
  -H "x-momo-timestamp: $(date +%s)" \
  -H "x-momo-device-id: test-device" \
  -d '{
    "source": "momoterminal",
    "phone_number": "+250788123456",
    "sender": "MTN Rwanda",
    "message": "You have received RWF 50,000 from 0781234567 Jean Bosco. Ref: TXN123",
    "parsed": {
      "amount": 50000,
      "sender_name": "Jean Bosco",
      "sender_phone": "0781234567",
      "transaction_id": "TXN123",
      "provider": "mtn"
    }
  }'
```

### **6. Verify in Database**

```sql
-- Check if SMS was stored
SELECT * FROM app.sms_inbox ORDER BY created_at DESC LIMIT 1;

-- Check if payment was matched
SELECT * FROM app.payments ORDER BY created_at DESC LIMIT 1;

-- Check if member balance was updated
SELECT
  m.full_name,
  m.member_code,
  a.account_type,
  a.balance
FROM app.accounts a
JOIN app.members m ON m.id = a.member_id
WHERE a.member_id IN (
  SELECT member_id FROM app.payments ORDER BY created_at DESC LIMIT 1
);
```

### **7. Monitor Logs**

```bash
# View edge function logs
supabase functions logs momo-sms-webhook --tail

# Or in dashboard
# https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions/momo-sms-webhook/logs
```

---

## SACCO Matcher Flow

```
1. SMS arrives → momo-sms-webhook
   ↓
2. Check phone_number → app.get_sacco_for_phone()
   ↓
3. Store in app.sms_inbox (linked to momo_transactions)
   ↓
4. Try match by phone hash → app.match_member_by_phone()
   │ └─→ SHA-256 of last 9 digits
   ↓
5. If not found, try match by name → app.match_member_by_name()
   │ └─→ Fuzzy matching (UPPER, LIKE)
   ↓
6a. If matched (confidence ≥ 0.7):
   ├─→ app.process_sacco_payment()
   │   ├─→ Create payment
   │   ├─→ Update account balance
   │   └─→ Create ledger entry
   └─→ Set status = 'matched'

6b. If not matched:
   └─→ Set status = 'unmatched' → Show in vendor portal
```

---

## Environment Variables

The edge function uses these environment variables (already configured):

```env
SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
MOMO_SMS_RATE_LIMIT_MAX=100  # Optional, default 100
```

---

## Troubleshooting

### **Issue: Function returns 500**

**Check**:

1. Database functions are deployed (`app.get_sacco_for_phone`, etc.)
2. SACCO webhook is registered in `momo_webhook_endpoints`
3. Service role key is correct

**Solution**:

```bash
# Redeploy migrations
supabase db push
```

### **Issue: Payment not matched**

**Check**:

1. Member's phone hash matches sender phone
2. Confidence score ≥ 0.7

**Debug**:

```sql
-- Check phone hash
SELECT
  full_name,
  msisdn_hash,
  encode(sha256('781234567'::bytea), 'hex') as expected_hash
FROM app.members
WHERE sacco_id = '<sacco-uuid>';

-- Check unmatched SMS
SELECT * FROM app.sms_inbox WHERE status = 'unmatched';
```

### **Issue: SMS not routed to SACCO matcher**

**Check**:

```sql
-- Verify webhook registration
SELECT * FROM public.momo_webhook_endpoints
WHERE service_type = 'sacco' AND active = true;
```

---

## Success Criteria

- [x] Edge function deployed
- [ ] Database migrations applied
- [ ] SACCO webhook registered
- [ ] Test member created with phone hash
- [ ] Test SMS sent successfully
- [ ] Payment auto-matched OR marked unmatched
- [ ] Vendor portal shows payment

---

**Deployment Status**: ✅ **EDGE FUNCTION DEPLOYED**  
**Next Action**: Apply database migrations with `supabase db push`
