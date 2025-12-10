# Database Migration Status - Manual Intervention Required

**Date**: 2025-12-09  
**Issue**: `supabase db push` is hanging during initialization  
**Status**: ⚠️ **MANUAL MIGRATION REQUIRED**

---

## What Happened

The `supabase db push` command is hanging at "Initialising login role..." This is a known issue with the Supabase CLI when:
- Docker is not running
- Network connectivity issues
- CLI state conflicts

---

## ✅ What's Already Deployed

- [x] **Edge Function**: `momo-sms-webhook` with SACCO matcher
- [x] **Migration Files**: 3 SQL files ready to apply
- [x] **Vendor Portal UI**: Complete and ready
- [ ] **Database Schema**: PENDING (needs manual application)

---

## 🚀 Quick Fix: Use Supabase SQL Editor (5 minutes)

### **Step 1: Open SQL Editor**

https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql/new

### **Step 2: Copy & Run Each Migration**

#### **Migration 1: Create Tables**

1. Open: `/Users/jeanbosco/workspace/easymo/supabase/migrations/20251209190000_create_app_schema_sacco_tables.sql`
2. Copy entire file content
3. Paste in SQL Editor
4. Click "Run"

✅ Creates: `app.saccos`, `app.members`, `app.accounts`, `app.payments`, etc.

#### **Migration 2: Webhook Support**

1. Open: `/Users/jeanbosco/workspace/easymo/supabase/migrations/20251209190001_add_sacco_webhook_support.sql`
2. Copy entire file content
3. Paste in SQL Editor
4. Click "Run"

✅ Adds: `sacco_id` to `momo_webhook_endpoints`, webhook functions

#### **Migration 3: Payment Functions**

1. Open: `/Users/jeanbosco/workspace/easymo/supabase/migrations/20251209190002_sacco_payment_functions.sql`
2. Copy entire file content
3. Paste in SQL Editor
4. Click "Run"

✅ Creates: 9 payment processing functions

### **Step 3: Verify**

Run in SQL Editor:

```sql
-- Check tables
SELECT tablename FROM pg_tables WHERE schemaname = 'app';

-- Check functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'app' AND routine_name LIKE '%sacco%';
```

Expected output:
- **Tables**: 7 (saccos, ikimina, members, accounts, sms_inbox, payments, ledger_entries)
- **Functions**: 9+ (including register_sacco_webhook, match_member_by_phone, etc.)

---

## Alternative: Use psql (For Advanced Users)

If you prefer command line:

```bash
cd /Users/jeanbosco/workspace/easymo

# Get your database password from:
# https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/settings/database

export DB_PASSWORD="your-password"

# Apply migrations
psql "postgresql://postgres.lhbowpbcpwoiparwnwgt:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres" \
  -f supabase/migrations/20251209190000_create_app_schema_sacco_tables.sql

psql "postgresql://postgres.lhbowpbcpwoiparwnwgt:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres" \
  -f supabase/migrations/20251209190001_add_sacco_webhook_support.sql

psql "postgresql://postgres.lhbowpbcpwoiparwnwgt:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres" \
  -f supabase/migrations/20251209190002_sacco_payment_functions.sql
```

---

## After Migrations Applied

### **1. Register Test SACCO Webhook**

```sql
-- Run in SQL Editor
SELECT app.register_sacco_webhook(
  p_sacco_id := gen_random_uuid(),
  p_phone_number := '+250788123456',
  p_description := 'Test SACCO MoMo Number'
);
```

### **2. Create Test Member**

```sql
-- Create SACCO first
INSERT INTO app.saccos (id, name, district, sector_code, status)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Test SACCO',
  'Gasabo',
  'KG001',
  'ACTIVE'
);

-- Create member with phone hash
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
  encode(sha256('781234567'::bytea), 'hex'),
  '078 123 ****',
  'ACTIVE'
);
```

### **3. Test Edge Function**

```bash
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/momo-sms-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "source": "momoterminal",
    "phone_number": "+250788123456",
    "sender": "MTN",
    "message": "You have received RWF 50,000 from 0781234567 Jean Bosco"
  }'
```

### **4. Verify in Database**

```sql
-- Check SMS was stored
SELECT * FROM app.sms_inbox ORDER BY created_at DESC LIMIT 1;

-- Check if payment was matched
SELECT * FROM app.payments ORDER BY created_at DESC LIMIT 1;
```

### **5. Open Vendor Portal**

```bash
cd vendor-portal
npm run dev
# Open http://localhost:3003/payments
```

---

## Complete Deployment Status

| Component | Status | Action Required |
|-----------|--------|-----------------|
| Edge Function | ✅ Deployed | None |
| Database Migrations | ⚠️ Pending | **Apply via SQL Editor** |
| Vendor Portal UI | ✅ Ready | Start with `npm run dev` |
| Test Data | ⚠️ Not Created | Create after migrations |

---

## Documentation

- 📄 `MIGRATION_GUIDE_MANUAL.md` - Detailed manual migration steps
- 📄 `apply-sacco-migrations.sh` - Automated psql script
- 📄 `EDGE_FUNCTION_DEPLOYMENT_SUCCESS.md` - Edge function deployment details
- 📄 `SACCO_SMS_COMPLETE_SUMMARY.md` - Complete implementation overview

---

## Recommended Next Steps

1. ✅ **Apply migrations** via SQL Editor (5 min)
2. ✅ **Create test SACCO** and member (2 min)
3. ✅ **Register webhook** endpoint (1 min)
4. ✅ **Test SMS** payment flow (2 min)
5. ✅ **Verify** in vendor portal (1 min)

**Total time**: ~10 minutes to full working system

---

**Priority**: Apply migrations via SQL Editor NOW to complete deployment
