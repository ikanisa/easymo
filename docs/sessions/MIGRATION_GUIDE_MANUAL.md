# SACCO SMS Integration - Database Migration Guide

**Status**: ⚠️ `supabase db push` is hanging  
**Alternative**: Use SQL Editor or manual psql

---

## Option 1: Supabase SQL Editor (Recommended)

### **Step 1: Open SQL Editor**

Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql/new

### **Step 2: Apply Migrations in Order**

Copy and paste each migration file into the SQL Editor and click "Run":

#### **Migration 1: Create app schema and tables**

```sql
-- File: supabase/migrations/20251209190000_create_app_schema_sacco_tables.sql
-- (Copy the entire content of this file)
```

Location:
`/Users/jeanbosco/workspace/easymo/supabase/migrations/20251209190000_create_app_schema_sacco_tables.sql`

#### **Migration 2: Add SACCO webhook support**

```sql
-- File: supabase/migrations/20251209190001_add_sacco_webhook_support.sql
-- (Copy the entire content of this file)
```

Location:
`/Users/jeanbosco/workspace/easymo/supabase/migrations/20251209190001_add_sacco_webhook_support.sql`

#### **Migration 3: SACCO payment functions**

```sql
-- File: supabase/migrations/20251209190002_sacco_payment_functions.sql
-- (Copy the entire content of this file)
```

Location:
`/Users/jeanbosco/workspace/easymo/supabase/migrations/20251209190002_sacco_payment_functions.sql`

### **Step 3: Verify Tables Created**

Run in SQL Editor:

```sql
-- Check app schema tables
SELECT
    schemaname,
    tablename
FROM pg_tables
WHERE schemaname = 'app'
ORDER BY tablename;

-- Expected: saccos, ikimina, members, accounts, sms_inbox, payments, ledger_entries
```

### **Step 4: Verify Functions Created**

```sql
-- Check app schema functions
SELECT
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'app'
AND routine_name LIKE '%sacco%'
ORDER BY routine_name;

-- Expected: 9 functions
```

---

## Option 2: Manual psql

### **Prerequisites**

```bash
# Install PostgreSQL client if not installed
brew install postgresql
```

### **Get Database Password**

1. Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/settings/database
2. Copy the database password
3. Note the connection string

### **Run Migration Script**

```bash
cd /Users/jeanbosco/workspace/easymo
./apply-sacco-migrations.sh
```

Or manually:

```bash
# Set your database password
export DB_PASSWORD="your-password-here"

# Apply migrations
psql "postgresql://postgres.lhbowpbcpwoiparwnwgt:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres" \
  -f supabase/migrations/20251209190000_create_app_schema_sacco_tables.sql

psql "postgresql://postgres.lhbowpbcpwoiparwnwgt:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres" \
  -f supabase/migrations/20251209190001_add_sacco_webhook_support.sql

psql "postgresql://postgres.lhbowpbcpwoiparwnwgt:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres" \
  -f supabase/migrations/20251209190002_sacco_payment_functions.sql
```

---

## Option 3: Retry `supabase db push`

Sometimes the CLI needs to be restarted:

```bash
# Kill any hanging processes
pkill -f "supabase db push"

# Try again
cd /Users/jeanbosco/workspace/easymo
supabase db push --linked
```

---

## Migration Files Summary

### **Migration 1** (255 lines)

- Creates `app` schema
- Creates tables: `saccos`, `ikimina`, `members`, `accounts`, `sms_inbox`, `payments`,
  `ledger_entries`
- RLS policies enabled
- Indexes for performance

### **Migration 2** (47 lines)

- Adds `sacco_id` to `momo_webhook_endpoints`
- Updates `service_type` constraint to include 'sacco'
- Creates functions: `register_sacco_webhook()`, `get_sacco_for_phone()`

### **Migration 3** (592 lines)

- Creates 9 payment processing functions:
  - `match_member_by_phone()` - Phone hash matching
  - `match_member_by_name()` - Fuzzy name matching
  - `process_sacco_payment()` - Payment creation & balance update
  - `store_sms_inbox()` - SMS storage
  - `update_sms_match()` - Match status update
  - `manual_match_sms()` - Manual matching
  - `get_payment_stats()` - Dashboard statistics
  - Plus 2 more helper functions

---

## Verification Checklist

After applying migrations, verify:

- [ ] `app` schema exists
- [ ] 7 tables created in `app` schema
- [ ] 9+ functions exist in `app` schema
- [ ] `momo_webhook_endpoints` has `sacco_id` column
- [ ] No errors in migration logs

---

## Troubleshooting

### **Issue: "relation already exists"**

This means migration was partially applied. Safe to ignore or:

```sql
-- Drop and recreate (ONLY if safe to do so)
DROP SCHEMA IF EXISTS app CASCADE;
-- Then rerun migrations
```

### **Issue: "permission denied for schema app"**

Run migrations with service role:

```sql
-- In SQL Editor
SET ROLE postgres;
-- Then run migration SQL
```

### **Issue: Function already exists**

```sql
-- Drop function first
DROP FUNCTION IF EXISTS app.register_sacco_webhook CASCADE;
-- Then recreate
```

---

## Next Steps After Migration

1. **Verify deployment**:

   ```sql
   SELECT * FROM app.saccos LIMIT 1;
   ```

2. **Register SACCO webhook**:

   ```sql
   SELECT app.register_sacco_webhook(
     p_sacco_id := gen_random_uuid(),
     p_phone_number := '+250788123456',
     p_description := 'Test SACCO'
   );
   ```

3. **Test edge function** with registered phone number

---

**Recommended**: Use **Option 1 (SQL Editor)** for fastest results
