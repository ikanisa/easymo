# Phase 2: WhatsApp Webhook Deployment - Complete Guide

**Project:** EasyMo Platform  
**Phase:** 2 - Microservices Deployment  
**Status:** ✅ READY TO DEPLOY  
**Date:** 2025-11-28

---

## Overview

This document guides you through deploying all WhatsApp webhook microservices to Supabase Edge Functions with the correct `--no-verify-jwt` configuration.

---

## Prerequisites Checklist

Before deploying, verify:

- ✅ Supabase CLI installed and authenticated
- ✅ Connected to correct project (lhbowpbcpwoiparwnwgt)
- ✅ All environment secrets configured
- ✅ Code changes committed to git
- ✅ In correct directory: `/Users/jeanbosco/workspace/easymo`

### Verify Supabase Connection:
```bash
cd /Users/jeanbosco/workspace/easymo
supabase projects list
supabase link --project-ref lhbowpbcpwoiparwnwgt
```

### Verify Secrets:
```bash
supabase secrets list | grep -E "META_|WHATSAPP"
```

Expected output:
```
META_WABA_BUSINESS_ID
WHATSAPP_ACCESS_TOKEN
WHATSAPP_APP_SECRET
WHATSAPP_PHONE_NUMBER_E164
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_SEND_ENDPOINT
WHATSAPP_SYSTEM_USER_ID
WHATSAPP_TEMPLATE_NAMESPACE
WHATSAPP_VERIFY_TOKEN
```

---

## Deployment Strategy

### Why `--no-verify-jwt` is CRITICAL

**Problem if JWT verification is enabled:**
```
Meta WhatsApp Cloud API → POST /wa-webhook-core
                        → No Supabase JWT in headers
                        → 401 Unauthorized ❌
                        → Webhook fails
                        → Users don't receive messages ❌
```

**Solution with `--no-verify-jwt`:**
```
Meta WhatsApp Cloud API → POST /wa-webhook-core
                        → Signature verified via HMAC-SHA256 ✅
                        → No JWT check required ✅
                        → Webhook processed ✅
                        → Users receive messages ✅
```

### Security Note:
We use **HMAC-SHA256 signature verification** instead of JWT:
- Every webhook includes `x-hub-signature-256` header
- Computed using `WHATSAPP_APP_SECRET`
- Verified in `verifyWebhookSignature()` function
- More secure than JWT for webhook scenarios

---

## Deployment Order

Deploy services in this order (dependencies first):

1. **wa-webhook-core** (Central router - required by all others)
2. **wa-webhook-unified** (Fallback handler)
3. Specialized services (can be deployed in parallel):
   - wa-webhook-jobs
   - wa-webhook-marketplace
   - wa-webhook-mobility
   - wa-webhook-property
   - wa-webhook-insurance
   - wa-webhook-profile
   - wa-webhook-ai-agents

---

## Deployment Commands

### Option 1: Deploy All Services (Automated Script)

Use the provided deployment script:

```bash
cd /Users/jeanbosco/workspace/easymo
chmod +x ./deploy_all_wa_webhooks.sh
./deploy_all_wa_webhooks.sh
```

### Option 2: Deploy Services Manually

#### 1. Deploy Core Router (REQUIRED FIRST)
```bash
cd /Users/jeanbosco/workspace/easymo
supabase functions deploy wa-webhook-core --no-verify-jwt
```

Expected output:
```
Deploying function wa-webhook-core...
Function wa-webhook-core deployed successfully
Version: XXX
URL: https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core
```

#### 2. Deploy Unified Handler
```bash
supabase functions deploy wa-webhook-unified --no-verify-jwt
```

#### 3. Deploy Jobs Service
```bash
supabase functions deploy wa-webhook-jobs --no-verify-jwt
```

#### 4. Deploy Marketplace Service
```bash
supabase functions deploy wa-webhook-marketplace --no-verify-jwt
```

#### 5. Deploy Mobility Service
```bash
supabase functions deploy wa-webhook-mobility --no-verify-jwt
```

#### 6. Deploy Property Service
```bash
supabase functions deploy wa-webhook-property --no-verify-jwt
```

#### 7. Deploy Insurance Service
```bash
supabase functions deploy wa-webhook-insurance --no-verify-jwt
```

#### 8. Deploy Profile Service
```bash
supabase functions deploy wa-webhook-profile --no-verify-jwt
```

#### 9. Deploy AI Agents Service
```bash
supabase functions deploy wa-webhook-ai-agents --no-verify-jwt
```

---

## Verification Steps

### 1. Verify All Services Deployed
```bash
supabase functions list | grep wa-webhook
```

Expected output should show all services as ACTIVE with recent deployment times.

### 2. Verify function.json Configuration

Check each service has correct configuration:

```bash
# Core
cat supabase/functions/wa-webhook-core/function.json

# Jobs
cat supabase/functions/wa-webhook-jobs/function.json

# Marketplace
cat supabase/functions/wa-webhook-marketplace/function.json

# ... etc
```

Each should have:
```json
{
  "name": "wa-webhook-XXX",
  "verify_jwt": false  ← CRITICAL
}
```

### 3. Test Health Endpoints

```bash
# Test wa-webhook-core health
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core/health

# Expected response:
{
  "status": "healthy",
  "service": "wa-webhook-core",
  "timestamp": "2025-11-28T...",
  ...
}
```

### 4. Test WhatsApp Verification Endpoint

```bash
# Get verify token
VERIFY_TOKEN=$(supabase secrets list | grep WHATSAPP_VERIFY_TOKEN | awk '{print $3}')

# Test verification
curl "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"

# Expected response: test123
```

### 5. Monitor Logs

```bash
# Watch core router logs
supabase functions logs wa-webhook-core --tail

# Watch specific service logs
supabase functions logs wa-webhook-jobs --tail
```

---

## Post-Deployment Configuration

### 1. Update Meta Webhook URL

In Meta Business Manager:
1. Go to App Dashboard → WhatsApp → Configuration
2. Set Webhook URL: `https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core`
3. Set Verify Token: (value from `WHATSAPP_VERIFY_TOKEN` secret)
4. Subscribe to webhook fields:
   - messages
   - messaging_postbacks
   - messaging_optins
   - message_deliveries
   - message_reads

### 2. Test End-to-End

Send test WhatsApp message:
1. Send "Hi" to your WhatsApp Business number
2. Should receive welcome menu
3. Try "find jobs" - should get job search menu
4. Try "book ride" - should get ride booking flow
5. Try "shop" - should get marketplace menu

### 3. Monitor Initial Traffic

```bash
# Watch for incoming webhooks
supabase functions logs wa-webhook-core --tail | grep "CORE_WEBHOOK_RECEIVED"

# Watch for routing decisions
supabase functions logs wa-webhook-core --tail | grep "ROUTING"

# Watch for errors
supabase functions logs wa-webhook-core --tail | grep "ERROR"
```

---

## Rollback Procedure

If deployment causes issues:

### 1. Rollback Single Service
```bash
# Get previous version number
supabase functions list | grep wa-webhook-jobs

# Rollback to previous version
supabase functions rollback wa-webhook-jobs --version <previous-version>
```

### 2. Emergency Disable
```bash
# Temporarily disable webhook in Meta Business Manager
# This stops new webhooks from being sent

# Or deploy a minimal handler that returns 200
supabase functions deploy wa-webhook-core --no-verify-jwt
```

### 3. Check Logs for Root Cause
```bash
# Get last 100 log entries
supabase functions logs wa-webhook-core --limit 100

# Filter for errors
supabase functions logs wa-webhook-core --limit 100 | grep ERROR
```

---

## Troubleshooting

### Issue: Deployment Fails with "Not authenticated"

**Solution:**
```bash
supabase login
supabase link --project-ref lhbowpbcpwoiparwnwgt
```

### Issue: "verify_jwt must be false" warning

**Cause:** Function.json file has `verify_jwt: true` or missing

**Solution:**
```bash
# Update function.json
echo '{"name":"wa-webhook-core","verify_jwt":false}' > supabase/functions/wa-webhook-core/function.json

# Redeploy
supabase functions deploy wa-webhook-core --no-verify-jwt
```

### Issue: 401 Unauthorized errors in logs

**Cause:** Function deployed without `--no-verify-jwt` flag

**Solution:**
```bash
# Redeploy with correct flag
supabase functions deploy wa-webhook-core --no-verify-jwt
```

### Issue: Signature verification failures

**Cause:** `WHATSAPP_APP_SECRET` incorrect or missing

**Solution:**
```bash
# Get correct secret from Meta App Dashboard
# Update secret
supabase secrets set WHATSAPP_APP_SECRET=<your-app-secret>

# Redeploy affected functions
supabase functions deploy wa-webhook-core --no-verify-jwt
```

### Issue: Routing not working

**Cause:** Keyword detection or session context issues

**Debug:**
```bash
# Check routing logs
supabase functions logs wa-webhook-core | grep ROUTING

# Check session data
supabase db sql --query "SELECT * FROM user_sessions WHERE phone_number = '+250...' ORDER BY created_at DESC LIMIT 5"
```

---

## Performance Monitoring

### Key Metrics to Watch

1. **Latency:**
   ```bash
   supabase functions logs wa-webhook-core | grep "X-WA-Core-Latency"
   ```
   - Target: P95 < 1200ms
   - Cold start < 1750ms

2. **Error Rate:**
   ```bash
   supabase functions logs wa-webhook-core | grep ERROR | wc -l
   ```
   - Target: < 0.5%

3. **Signature Failures:**
   ```bash
   supabase functions logs wa-webhook-core | grep "CORE_AUTH_FAILED"
   ```
   - Should be 0 in production

4. **DLQ Depth:**
   ```bash
   supabase db sql --query "SELECT COUNT(*) FROM dlq_entries WHERE processed_at IS NULL"
   ```
   - Target: < 10 unprocessed

---

## Success Criteria

Deployment is successful when:

- ✅ All services show STATUS: ACTIVE
- ✅ All function.json files have `verify_jwt: false`
- ✅ Health endpoints return 200 OK
- ✅ WhatsApp verification endpoint works
- ✅ Test messages receive responses
- ✅ Routing works for all service types
- ✅ No 401 errors in logs
- ✅ Signature verification passing
- ✅ Latency within SLO targets
- ✅ Error rate < 0.5%

---

## Next Steps After Deployment

1. ✅ **Monitor for 24 hours** - Watch logs for any errors
2. ✅ **Test all user flows** - Jobs, marketplace, rides, property, insurance
3. ✅ **Verify analytics** - Check message volumes and response rates
4. ⏳ **Set up alerting** - PagerDuty for critical failures
5. ⏳ **Document common issues** - Build runbook
6. ⏳ **Performance tuning** - Optimize based on real traffic

---

## Deployment Script

Save this as `deploy_all_wa_webhooks.sh`:

```bash
#!/bin/bash

set -e  # Exit on error

echo "=========================================="
echo "WhatsApp Webhook Deployment - Phase 2"
echo "=========================================="
echo ""

cd /Users/jeanbosco/workspace/easymo

# Verify we're in the right place
if [ ! -d "supabase/functions/wa-webhook-core" ]; then
  echo "❌ Error: Not in easymo directory"
  exit 1
fi

echo "✅ In correct directory"
echo ""

# Verify Supabase CLI is authenticated
if ! supabase projects list > /dev/null 2>&1; then
  echo "❌ Error: Not authenticated with Supabase"
  echo "Run: supabase login"
  exit 1
fi

echo "✅ Supabase CLI authenticated"
echo ""

# Deploy services in order
echo "📦 Deploying wa-webhook-core (central router)..."
supabase functions deploy wa-webhook-core --no-verify-jwt
echo "✅ wa-webhook-core deployed"
echo ""

echo "📦 Deploying wa-webhook-unified (fallback handler)..."
supabase functions deploy wa-webhook-unified --no-verify-jwt
echo "✅ wa-webhook-unified deployed"
echo ""

echo "📦 Deploying specialized services..."
echo ""

echo "  📦 wa-webhook-jobs..."
supabase functions deploy wa-webhook-jobs --no-verify-jwt
echo "  ✅ wa-webhook-jobs deployed"

echo "  📦 wa-webhook-marketplace..."
supabase functions deploy wa-webhook-marketplace --no-verify-jwt
echo "  ✅ wa-webhook-marketplace deployed"

echo "  📦 wa-webhook-mobility..."
supabase functions deploy wa-webhook-mobility --no-verify-jwt
echo "  ✅ wa-webhook-mobility deployed"

echo "  📦 wa-webhook-property..."
supabase functions deploy wa-webhook-property --no-verify-jwt
echo "  ✅ wa-webhook-property deployed"

echo "  📦 wa-webhook-insurance..."
supabase functions deploy wa-webhook-insurance --no-verify-jwt
echo "  ✅ wa-webhook-insurance deployed"

echo "  📦 wa-webhook-profile..."
supabase functions deploy wa-webhook-profile --no-verify-jwt
echo "  ✅ wa-webhook-profile deployed"

echo "  📦 wa-webhook-ai-agents..."
supabase functions deploy wa-webhook-ai-agents --no-verify-jwt
echo "  ✅ wa-webhook-ai-agents deployed"

echo ""
echo "=========================================="
echo "✅ All WhatsApp webhook services deployed!"
echo "=========================================="
echo ""

echo "📊 Deployment Summary:"
supabase functions list | grep wa-webhook

echo ""
echo "🔍 Next Steps:"
echo "1. Test health endpoint: curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core/health"
echo "2. Send test WhatsApp message"
echo "3. Monitor logs: supabase functions logs wa-webhook-core --tail"
echo ""
echo "📝 See WA_WEBHOOK_PHASE2_DEPLOYMENT.md for verification steps"
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-28  
**Author:** DevOps Team
