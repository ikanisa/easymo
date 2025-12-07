# Edge Functions Deployment Guide - Preferred Suppliers Network

**Date**: 2025-12-07  
**Status**: Ready for deployment  
**Project**: lhbowpbcpwoiparwnwgt

## Prerequisites

```bash
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
export DATABASE_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"
```

## What Changed

The `tool-executor.ts` file in `supabase/functions/_shared/` has been updated with:

1. **New case in executeDbTool()**: Added `case "search_suppliers"`
2. **New method**: `searchSuppliers()` that:
   - Accepts product_query, quantity, unit, user location
   - Calls the `search_preferred_suppliers()` PostgreSQL function
   - Formats results with benefits highlighted
   - Calculates discounted prices

## Functions That Need Redeployment

These functions import from `_shared` and need to be redeployed to pick up the new tool-executor:

### Critical (Use search_suppliers tool):
1. **wa-webhook-core** - Main WhatsApp webhook
2. **wa-agent-call-center** - Call Center AGI agent
3. **wa-webhook-buy-sell** - Buy & Sell commerce

### Important (May use in future):
4. **wa-webhook-mobility** - Rides and transport
5. **wa-webhook-property** - Real estate
6. **wa-webhook-jobs** - Job listings
7. **wa-agent-waiter** - Restaurant/bar agent
8. **wa-agent-farmer** - Agricultural agent
9. **wa-agent-support** - Customer support

## Deployment Commands

### Option 1: Deploy All at Once (Recommended)

```bash
cd /Users/jeanbosco/workspace/easymo

# Set environment
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"

# Deploy all functions
supabase functions deploy --project-ref lhbowpbcpwoiparwnwgt
```

### Option 2: Deploy One by One

```bash
cd /Users/jeanbosco/workspace/easymo
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"

# Deploy critical functions first
supabase functions deploy wa-agent-call-center --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt
supabase functions deploy wa-webhook-core --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt
supabase functions deploy wa-webhook-buy-sell --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt

# Deploy others
supabase functions deploy wa-webhook-mobility --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt
supabase functions deploy wa-webhook-property --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt
supabase functions deploy wa-agent-waiter --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt
```

### Option 3: Use the Deployment Script

```bash
cd /Users/jeanbosco/workspace/easymo
chmod +x deploy-edge-functions.sh
./deploy-edge-functions.sh
```

## Verification Steps

### 1. Check Function Deployment

```bash
# List deployed functions
supabase functions list --project-ref lhbowpbcpwoiparwnwgt

# Check specific function
supabase functions inspect wa-agent-call-center --project-ref lhbowpbcpwoiparwnwgt
```

### 2. Test via Database

The database layer is already working:

```sql
-- Connect to database
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

-- Test search
SELECT * FROM search_preferred_suppliers('potatoes', -1.9441, 30.0619, 10, 5);
```

### 3. Test via AI Agent

Once functions are deployed:

**Via WhatsApp**:
1. Message your WhatsApp Business number
2. Say: "I need 10kg of potatoes"
3. Expected response:

```
🏆 RECOMMENDED (EasyMO Partner):
Kigali Fresh Market - 0.0km away
✅ 10% discount for EasyMO users
✅ Free delivery over 5,000 RWF
💰 800 RWF/kg → 8,000 RWF for 10kg (with discount: 7,200 RWF)

Would you like me to connect you with Kigali Fresh Market?
```

### 4. Check Function Logs

```bash
# View real-time logs
supabase functions logs wa-agent-call-center --project-ref lhbowpbcpwoiparwnwgt --tail

# Or via Supabase Dashboard
# https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions/logs
```

## Troubleshooting

### Issue: "Tool not found" error

**Cause**: The AI agent doesn't have the search_suppliers tool configured

**Solution**: Add the tool to the ai_agent_tools table:

```sql
-- Connect to database
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

-- Check if tool exists
SELECT name, slug FROM ai_agent_tools WHERE name LIKE '%supplier%';

-- If not exists, insert it (adjust columns based on your schema)
INSERT INTO ai_agent_tools (name, description, tool_type, config)
VALUES (
  'search_suppliers',
  'Search for preferred suppliers with benefits',
  'db',
  '{"rpc": "search_preferred_suppliers"}'::jsonb
);
```

### Issue: Function deployment fails

**Cause**: Various (network, permissions, syntax)

**Solution**:
1. Check Supabase CLI version: `supabase --version`
2. Update if needed: `npm install -g supabase`
3. Verify token: `echo $SUPABASE_ACCESS_TOKEN`
4. Check project link: `supabase link --project-ref lhbowpbcpwoiparwnwgt`

### Issue: Search returns no results

**Cause**: Data not in database or query doesn't match

**Solution**:
```sql
-- Check suppliers
SELECT id, business_name, is_active FROM preferred_suppliers;

-- Check products
SELECT product_name, in_stock FROM supplier_products;

-- Test with different keywords
SELECT * FROM search_preferred_suppliers('potato', -1.9441, 30.0619, 10, 5);
SELECT * FROM search_preferred_suppliers('vegetable', -1.9441, 30.0619, 10, 5);
```

## Expected Deployment Time

- **Deploy all functions**: ~5-10 minutes
- **Deploy 3 critical functions**: ~2-3 minutes
- **Verification**: ~5 minutes
- **Total**: 15-20 minutes

## Post-Deployment Checklist

- [ ] All functions deployed successfully
- [ ] Function logs show no errors
- [ ] Database search function tested
- [ ] AI agent responds to product requests
- [ ] Preferred supplier shown with benefits
- [ ] Benefits calculation correct
- [ ] Distance calculation accurate

## Files Modified

1. `supabase/functions/_shared/tool-executor.ts`
   - Added `case "search_suppliers"` (line ~245)
   - Added `searchSuppliers()` method (line ~883-973)

2. `supabase/migrations/20251207000000_create_preferred_suppliers.sql`
   - Already deployed to database ✅

3. `supabase/migrations/20251207000001_add_search_suppliers_tool.sql`
   - May need manual adjustment based on schema

## Success Metrics

After deployment, monitor:

1. **Function calls**: Should see `search_suppliers` in logs
2. **Response times**: Search should complete in <500ms
3. **Error rates**: Should be <1%
4. **User engagement**: Track product search queries

## Support

If issues persist:
1. Check Supabase Dashboard logs
2. Review `DEPLOYMENT_SUCCESS_PREFERRED_SUPPLIERS.md`
3. Verify database connection
4. Test RPC function directly

---

**Created**: 2025-12-07 09:10 UTC  
**Status**: Ready for deployment  
**Next Step**: Run deployment commands above
