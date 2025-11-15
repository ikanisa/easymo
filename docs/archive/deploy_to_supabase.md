# 🚀 Supabase Manual Deployment Guide

## Issue

The Supabase CLI `db push` command hangs when connecting to the remote database. This appears to be
a network/connection issue with the Postgres connection.

## Solution

Use the Supabase Dashboard SQL Editor to run migrations manually.

## Steps

### 1. Access SQL Editor

Visit: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql/new

### 2. Check Current Migration Status

Run this query to see what's applied:

```sql
SELECT version FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 20;
```

### 3. Identify Pending Migrations

Compare the above with local migrations in `supabase/migrations/`

Local migration count: 277 files Last applied remote: 20260425110000

### 4. Apply Pending Migrations

For each pending migration file, copy its contents and run in SQL Editor:

Priority migrations to apply:

1. `20241113150000_waiter_ai_pwa.sql` - Waiter AI PWA schema
2. `20241114000000_waiter_ai_complete_schema.sql` - Complete Waiter schema
3. `20251113192300_add_google_maps_url_column.sql` - Google Maps URL column

### 5. Verification

After applying, verify:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check latest migration
SELECT version FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 1;
```

## Alternative: REST API Deployment

If SQL Editor doesn't work, use the REST API:

```bash
# Get service role key (already have it)
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Run SQL via REST API
curl -X POST \
  'https://lhbowpbcpwoiparwnwgt.supabase.co/rest/v1/rpc/exec_sql' \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"<SQL_HERE>"}'
```

## Key Migrations to Apply

### Most Important (Apply First):

1. **Waiter AI Schema** - 20241113150000, 20241114000000
2. **Google Maps Integration** - 20251113192300
3. **Business Cleanup** - 20251113000000_cleanup_business_tables.sql

### Can Skip (Duplicates):

- Multiple bars\_\* migrations with same timestamp
- Multiple phase1_foundation migrations
- Duplicate cleanup migrations

## Recommendation

Since there are 277 migrations and many duplicates, consider:

1. **Option A**: Apply only critical/recent migrations manually
2. **Option B**: Generate a single consolidated migration
3. **Option C**: Fix Supabase CLI connection (check VPN/firewall)

## Current Status

✅ Supabase Functions - ALL DEPLOYED ✅ Admin Panel - PRODUCTION READY ✅ Waiter AI PWA - PRODUCTION
READY ⚠️ Database Migrations - PENDING (CLI issue)

## Next Steps

1. Try SQL Editor approach (fastest)
2. If that fails, debug Supabase CLI connection
3. Consider consolidating migrations into fewer files
