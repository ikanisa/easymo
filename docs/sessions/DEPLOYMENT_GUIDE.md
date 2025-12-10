# Production Deployment Guide

**Date**: 2025-12-09 20:15 UTC  
**Status**: Ready to Deploy  
**Latest Commit**: 3867addc (location cache fix)

---

## Quick Deploy Commands

### 1. Deploy Database Migration (Already Applied)
```bash
export SUPABASE_DB_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

# Migration already applied directly to production
# To verify:
psql "$SUPABASE_DB_URL" -c "SELECT proname, pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'update_user_location_cache';"
# Should show only 1 function (double precision version)
```

### 2. Deploy WhatsApp Agents
```bash
cd /Users/jeanbosco/workspace/easymo
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"

# Automatic deployment
./deploy-whatsapp-agents.sh
```

**Or manual deployment:**
```bash
cd supabase/functions

# Core router
supabase functions deploy wa-webhook-core --no-verify-jwt

# Workflows
supabase functions deploy wa-webhook-buy-sell --no-verify-jwt
supabase functions deploy wa-webhook-property --no-verify-jwt
supabase functions deploy wa-webhook-jobs --no-verify-jwt
supabase functions deploy wa-webhook-waiter --no-verify-jwt
supabase functions deploy wa-webhook-mobility --no-verify-jwt

# AI Agents
supabase functions deploy agent-property-rental --no-verify-jwt
supabase functions deploy wa-agent-waiter --no-verify-jwt
supabase functions deploy wa-agent-farmer --no-verify-jwt
supabase functions deploy wa-agent-support --no-verify-jwt
supabase functions deploy wa-agent-call-center --no-verify-jwt
```

### 3. Start Vendor Portal (Local)
```bash
cd /Users/jeanbosco/workspace/easymo

# Add SERVICE_ROLE_KEY to .env first
pnpm --filter @easymo/vendor-portal dev
# Visit: http://localhost:3100
```

### 4. Start Admin App (Local)
```bash
# Add FEATURE_IBIMINA_ADMIN=true to .env
pnpm --filter @easymo/admin-app dev
# Visit: http://localhost:3000/ibimina-admin
```

---

## What's Been Deployed

### ✅ Database
- [x] Location cache fix applied (function overloading resolved)
- [x] 27 Ibimina tables created
- [x] All migrations synced

### ⏳ Edge Functions (Ready to Deploy)
- [ ] wa-webhook-core (router)
- [ ] wa-webhook-mobility (with location fix)
- [ ] 4 WhatsApp workflows
- [ ] 5 AI agents
- [ ] 40 Ibimina functions

### ✅ Applications (Ready to Run)
- [x] Vendor portal code deployed
- [x] Admin app with ibimina routes
- [x] All packages built

---

## Deployment Checklist

### Pre-Deployment
- [x] Code pushed to main (commit: 3867addc)
- [x] Database migration applied
- [x] Location cache fix verified
- [x] Agent routing configured
- [x] Documentation complete

### Deploy Now
- [ ] Run `./deploy-whatsapp-agents.sh`
- [ ] Verify health endpoints
- [ ] Test wa-webhook-core routing
- [ ] Configure WhatsApp webhook URL

### Post-Deployment
- [ ] Monitor logs for errors
- [ ] Test location sharing
- [ ] Test agent routing
- [ ] Verify vendor portal
- [ ] Test admin routes

---

## Production URLs

**After deployment, these URLs will be live:**

```
# Core Router
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core

# Mobility (with location fix)
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-mobility

# Workflows
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-buy-sell
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-property
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-jobs
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-waiter

# AI Agents
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/agent-property-rental
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-agent-waiter
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-agent-farmer
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-agent-support
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-agent-call-center
```

---

## Verification Commands

### Test Location Cache Fix
```bash
# Should work without PGRST203 error
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-mobility \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "250788123456",
            "type": "location",
            "location": {
              "latitude": -1.9915,
              "longitude": 30.1059
            }
          }]
        }
      }]
    }]
  }'
```

### Test Core Router
```bash
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core/health
```

### Test Agent Routing
```bash
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "250788123456",
            "text": {"body": "property rental"}
          }]
        }
      }]
    }]
  }'
```

---

## Latest Fixes Included

### 1. Location Cache (Commit: 3867addc)
- ✅ Fixed PGRST203 function overloading error
- ✅ Dropped duplicate `update_user_location_cache` function
- ✅ Location saves now work correctly

### 2. WhatsApp Agent Integration
- ✅ agent-property-rental added to routing
- ✅ Strict workflow/agent separation
- ✅ All 10 services configured

### 3. Ibimina Integration
- ✅ 27 database tables created
- ✅ Vendor portal ready
- ✅ Admin routes integrated
- ✅ 40 edge functions ready

---

## Known Issues

### 1. Trip Matching Shows "No Drivers"
**Status**: ✅ Working as expected  
**Reason**: No driver trips in database (only passenger trips)  
**Solution**: Normal - wait for drivers or create test data

See: `TRIP_MATCHING_RESOLUTION.md` for details

---

## Next Steps

1. **Deploy agents** (5 minutes):
   ```bash
   ./deploy-whatsapp-agents.sh
   ```

2. **Start vendor portal** (1 minute):
   ```bash
   pnpm --filter @easymo/vendor-portal dev
   ```

3. **Configure WhatsApp** (2 minutes):
   - Set webhook URL to wa-webhook-core
   - Subscribe to messages

4. **Monitor** (ongoing):
   - Check Supabase logs
   - Monitor error rates
   - Verify routing

---

## Rollback Plan

If issues arise:

```bash
# Revert database function (if needed)
psql "$SUPABASE_DB_URL" -c "
CREATE OR REPLACE FUNCTION public.update_user_location_cache(_user_id uuid, _lat numeric, _lng numeric)
RETURNS void LANGUAGE sql SECURITY DEFINER
AS \$\$ SELECT save_recent_location(_user_id, _lat, _lng, 'cache', '{}'::jsonb, 30)::text; \$\$;
"

# Rollback code
git revert 3867addc
git push origin main
```

---

**Ready to Deploy**: ✅  
**Estimated Time**: 10 minutes  
**Risk Level**: Low (fixes critical bug)

🚀 **Run `./deploy-whatsapp-agents.sh` to deploy!**
