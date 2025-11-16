# 📋 Manual Migration Guide for Supabase Dashboard

## Quick Steps

### 1. Open Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql

### 2. Open the Migration Script

File location: `./supabase_migrations_manual.sql`

### 3. Copy & Paste

- Open the file `supabase_migrations_manual.sql`
- Select ALL content (Cmd+A / Ctrl+A)
- Copy (Cmd+C / Ctrl+C)
- Paste into Supabase SQL Editor

### 4. Execute

- Click "Run" button (or press Cmd+Enter / Ctrl+Enter)
- Wait 3-5 minutes for completion

### 5. Verify

Look for this message at the end:

```
✅ All 25 migrations applied successfully!
📊 Schema version: 20260401170000
```

## What This Script Does

### ✅ Applies 25 Migrations

1. **PostGIS Extension** - Enables geographic data types
2. **Shops Table** - Creates base shops infrastructure
3. **RLS Policies** (8 migrations) - Security on 34 tables
4. **Performance Indexes** - Foreign key optimization
5. **Automated Triggers** - updated_at timestamps
6. **Partitioning** - Table partitioning setup
7. **Observability** - Logging & monitoring
8. **Feature Migrations** (15 files) - Agents, payments, analytics

### ⚠️ Expected Warnings (SAFE to ignore)

```
NOTICE: extension "postgis" already exists, skipping
NOTICE: relation "shops" already exists, skipping
NOTICE: relation "voucher_redemptions" does not exist, skipping
```

These are normal - the script is idempotent (safe to run multiple times).

## After Running

### Mark Migrations as Applied Locally

```bash
# In your terminal, run:
supabase migration repair --status applied \
  20240101000000 20240102000000 \
  20251112135627 20251112135628 20251112135629 20251112135630 \
  20251112135631 20251112135632 20251112135633 20251112135634 \
  20260312090000 20260322100000 20260322110000 20260323100000 \
  20260324100000 20260324110000 20260324120000 20260401100000 \
  20260401110000 20260401120000 20260401130000 20260401140000 \
  20260401150000 20260401160000 20260401170000
```

### Verify Sync

```bash
supabase migration list
supabase db diff
```

## Troubleshooting

### Error: "relation does not exist"

- **Safe to ignore** if the NOTICE says "skipping"
- **Action needed** if ERROR persists - check table dependencies

### Error: "already exists"

- **Safe to ignore** - means it's already applied
- Script handles this with `IF NOT EXISTS` and `ON CONFLICT`

### Script Hangs

- Check Supabase Dashboard for connection issues
- Try smaller batches (split script into parts)
- Use direct connection instead of pooler

### Need Help?

Check the main report: `/tmp/final_status_report.md`

## File Locations

- **Migration Script**: `./supabase_migrations_manual.sql` (196 KB, 4,862 lines)
- **This Guide**: `./MANUAL_MIGRATION_GUIDE.md`
- **Status Report**: `/tmp/final_status_report.md`
