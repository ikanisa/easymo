# Apply Marketplace Migrations - Manual Guide

## ✅ Edge Function Deployed

The `wa-webhook-marketplace` edge function has been successfully deployed to:
- **Project**: lhbowpbcpwoiparwnwgt
- **Dashboard**: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions

## 📊 Migrations to Apply

There are **3 marketplace migrations** that need to be applied:

### 1. Base Marketplace Tables
**File**: `supabase/migrations/20251125071000_create_marketplace_tables.sql`
- Creates: marketplace_listings, marketplace_conversations, marketplace_buyer_intents, marketplace_matches, business_directory
- RPC functions for proximity search
- Full-text search indexes

### 2. Transaction System (Phase 2)
**File**: `supabase/migrations/20251125193000_marketplace_transactions.sql`
- Creates: marketplace_transactions table
- Enhances: marketplace_listings (reservation fields)
- RPC functions: get_user_transaction_summary, get_active_transactions, expire_marketplace_transactions
- Triggers for auto-update and auto-expiry

### 3. Agriculture Marketplace (if needed)
**File**: `supabase/migrations/20251118104500_agri_marketplace_tables.sql`
- Agriculture-specific tables (optional)

## 🚀 Option 1: Apply via Supabase Dashboard

### Step 1: Access SQL Editor
1. Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql
2. Click "New Query"

### Step 2: Apply Base Tables Migration
Copy and paste content from:
```
supabase/migrations/20251125071000_create_marketplace_tables.sql
```

Click "Run" → Verify no errors

### Step 3: Apply Transactions Migration
Copy and paste content from:
```
supabase/migrations/20251125193000_marketplace_transactions.sql
```

Click "Run" → Verify no errors

### Step 4: Verify Tables Created
Run this query to verify:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'marketplace%'
ORDER BY table_name;
```

Expected output:
- marketplace_buyer_intents
- marketplace_conversations
- marketplace_listings
- marketplace_matches
- marketplace_transactions
- business_directory

### Step 5: Verify RPC Functions
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%marketplace%'
ORDER BY routine_name;
```

Expected functions:
- get_active_transactions
- get_user_transaction_summary
- expire_marketplace_transactions
- search_marketplace_listings_nearby
- find_matching_marketplace_buyers
- search_businesses_nearby

## 🚀 Option 2: Apply via psql (if you have direct DB access)

```bash
# Set your database connection string
export DB_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"

# Apply migrations in order
psql "$DB_URL" -f supabase/migrations/20251125071000_create_marketplace_tables.sql
psql "$DB_URL" -f supabase/migrations/20251125193000_marketplace_transactions.sql

# Verify
psql "$DB_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'marketplace%';"
```

## 🚀 Option 3: Use Supabase CLI with Link

```bash
# First, ensure you have access to the project
supabase login

# Link to the project (may require admin access)
supabase link --project-ref lhbowpbcpwoiparwnwgt

# Apply migrations
supabase db push

# Or apply specific migrations
supabase migration up
```

## ✅ Post-Migration Verification

### Check Table Creation
```sql
-- Should return 6 tables
SELECT COUNT(*) as marketplace_tables
FROM information_schema.tables 
WHERE table_name LIKE 'marketplace%';
```

### Check RPC Functions
```sql
-- Should return 6+ functions
SELECT COUNT(*) as marketplace_functions
FROM information_schema.routines 
WHERE routine_name LIKE '%marketplace%';
```

### Test a Function
```sql
-- Test the transaction cleanup function
SELECT expire_marketplace_transactions();
```

### Check Indexes
```sql
-- Verify search indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE tablename LIKE 'marketplace%'
ORDER BY tablename, indexname;
```

## 🔧 Set Environment Variables

After migrations, ensure these secrets are set in Supabase:

```bash
# Via Dashboard: Settings → Edge Functions → Secrets
MOMO_MERCHANT_CODE=your_mtn_merchant_code
MOMO_MERCHANT_NAME=EasyMO Marketplace
FEATURE_MARKETPLACE_AI=true
GEMINI_API_KEY=your_gemini_key
WA_ACCESS_TOKEN=your_whatsapp_token
WA_PHONE_NUMBER_ID=your_phone_id
WA_VERIFY_TOKEN=your_verify_token
```

Or via CLI:
```bash
supabase secrets set MOMO_MERCHANT_CODE=your_code --project-ref lhbowpbcpwoiparwnwgt
supabase secrets set FEATURE_MARKETPLACE_AI=true --project-ref lhbowpbcpwoiparwnwgt
```

## 🧪 Test the Deployment

### Test Function Health
```bash
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-marketplace
```

Expected response:
```json
{
  "status": "healthy",
  "service": "wa-webhook-marketplace",
  "aiEnabled": true
}
```

### Test via WhatsApp
1. Send message: "MARKETPLACE"
2. Should receive welcome message with options
3. Try: "I want to sell my phone"
4. AI should respond with questions

## 📊 Monitor Deployment

### Check Function Logs
```bash
supabase functions logs wa-webhook-marketplace --project-ref lhbowpbcpwoiparwnwgt
```

Or via Dashboard:
https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/logs/functions

### Check Database Logs
Dashboard → Logs → Database

## ⚠️ Troubleshooting

### Migration Already Applied Error
If you see "relation already exists":
- Check which migrations are already applied
- Only apply the new ones
- Use `IF NOT EXISTS` clauses (already in migrations)

### Permission Errors
- Ensure you're using SERVICE_ROLE_KEY for migrations
- Or apply via Supabase Dashboard (recommended)

### Function Not Found
- Re-deploy: `supabase functions deploy wa-webhook-marketplace --no-verify-jwt`
- Check logs for errors

## ✅ Success Criteria

- [ ] All 6 marketplace tables exist
- [ ] All RPC functions created
- [ ] Function deployed and health check passes
- [ ] Environment variables set
- [ ] WhatsApp test successful
- [ ] Photo upload works
- [ ] USSD payment link generated correctly

---

**Deployment Date**: November 25, 2024  
**Function URL**: https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-marketplace  
**Dashboard**: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt
