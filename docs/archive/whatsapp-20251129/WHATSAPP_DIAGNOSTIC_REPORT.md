# WhatsApp Message Reception - Diagnostic Report

**Date:** 2025-11-28  
**Project:** EasyMO  
**Issue:** Not receiving WhatsApp messages

---

## Executive Summary

Based on a comprehensive review of your EasyMO codebase, I've identified **7 critical areas** that could prevent WhatsApp messages from being received. This report provides a systematic checklist to diagnose and resolve the issue.

---

## Architecture Overview

Your WhatsApp integration uses a **microservices-based architecture**:

```
WhatsApp Cloud API
       ↓
Meta Webhook (configured in Meta Business Manager)
       ↓
wa-webhook-core (Edge Function - ingress/router)
       ↓
├── wa-webhook-ai-agents
├── wa-webhook-mobility  
├── wa-webhook-jobs
├── wa-webhook-property
├── wa-webhook-marketplace
├── wa-webhook-insurance
└── wa-webhook-unified
```

**Key Finding:** The main `wa-webhook` function is **DEPRECATED** (as noted in `supabase/functions/wa-webhook/index.ts`). All traffic should route through `wa-webhook-core`.

---

## Root Cause Analysis - 7 Critical Checkpoints

### 1. ❌ Meta Webhook Configuration

**Location to Check:** Meta Business Manager → WhatsApp → Configuration → Webhook

**Required Settings:**
- **Callback URL:** `https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-core`
- **Verify Token:** Must match your `WA_VERIFY_TOKEN` environment variable
- **Webhook Fields:** Subscribe to ALL of:
  - `messages` ✓
  - `message_status` ✓
  - `messaging_feedback` ✓
  - `messaging_referrals` ✓

**How to Verify:**
```bash
# Test webhook verification handshake
curl "https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-core?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"
# Should return: test123
```

**Common Issues:**
- Webhook pointing to deprecated `wa-webhook` instead of `wa-webhook-core`
- Verify token mismatch
- Webhook not subscribed to all message types

---

### 2. ❌ Environment Variables (Supabase Secrets)

**Required Variables** (from `supabase/functions/wa-webhook/config.ts`):

| Variable | Purpose | How to Check |
|----------|---------|--------------|
| `WA_PHONE_ID` or `WHATSAPP_PHONE_NUMBER_ID` | Your WhatsApp Business Phone Number ID | Meta Business Manager |
| `WA_TOKEN` or `WHATSAPP_ACCESS_TOKEN` | Access token for WhatsApp API | Meta Business Manager |
| `WA_APP_SECRET` or `WHATSAPP_APP_SECRET` | App secret for signature verification | Meta App Dashboard |
| `WA_VERIFY_TOKEN` or `WHATSAPP_VERIFY_TOKEN` | Webhook verification token | Set by you |
| `SUPABASE_SERVICE_ROLE_KEY` | Database access | Supabase Dashboard |
| `SUPABASE_URL` | Your Supabase project URL | Auto-set |
| `WA_BOT_NUMBER_E164` or `WHATSAPP_PHONE_NUMBER_E164` | Bot number in E.164 format | e.g., `+250788123456` |

**How to Verify:**
```bash
# List current secrets
supabase secrets list

# Set missing secrets
supabase secrets set WA_PHONE_ID=your_phone_id
supabase secrets set WA_TOKEN=your_access_token
supabase secrets set WA_APP_SECRET=your_app_secret
supabase secrets set WA_VERIFY_TOKEN=your_verify_token
```

**Critical Note:** After setting secrets, you MUST redeploy:
```bash
supabase functions deploy wa-webhook-core
```

---

### 3. ❌ Signature Verification Issues

**File:** `supabase/functions/wa-webhook-core/index.ts` (lines 100-157)

The webhook **REQUIRES** signature verification unless explicitly bypassed.

**Debug Steps:**

```bash
# Check logs for signature failures
supabase functions logs wa-webhook-core | grep "CORE_AUTH"

# Look for:
# - CORE_AUTH_FAILED: Signature verification failed
# - CORE_AUTH_CONFIG_ERROR: WA_APP_SECRET not set
# - CORE_AUTH_BYPASS: Running with signature bypass (WARNING)
```

**Temporary Bypass (NOT RECOMMENDED for production):**
```bash
supabase secrets set WA_ALLOW_UNSIGNED_WEBHOOKS=true
supabase functions deploy wa-webhook-core
```

**Proper Fix:**
1. Verify `WA_APP_SECRET` matches your Meta App Dashboard
2. Ensure webhook is sending `x-hub-signature-256` header
3. Check Meta App → Settings → Basic → App Secret

---

### 4. ❌ Database Schema Issues

**Required Tables** (from migrations):
- `wa_events` - Stores incoming webhook events
- `wa_interactions` - User conversation state
- `profiles` - User profiles
- `notifications` - Outbound message queue

**How to Verify:**
```bash
# Connect to your database
psql $DATABASE_URL

# Check tables exist
\dt wa_events
\dt wa_interactions
\dt profiles
\dt notifications
```

**If Missing:**
```bash
# Apply all migrations
supabase db push

# Verify migrations
supabase migration list
```

---

### 5. ❌ Function Deployment Status

**Critical:** Ensure `wa-webhook-core` is deployed and NOT the deprecated `wa-webhook`.

**How to Check:**
```bash
# List deployed functions
supabase functions list

# Should show:
# - wa-webhook-core ✓ (deployed)
# - wa-webhook (should NOT be listed or be older version)
```

**Deploy/Update:**
```bash
# Deploy core router
supabase functions deploy wa-webhook-core

# Deploy all WhatsApp microservices
pnpm run functions:deploy:wa

# Or deploy individually
supabase functions deploy wa-webhook-ai-agents
supabase functions deploy wa-webhook-mobility
# ... etc
```

---

### 6. ❌ Rate Limiting

**File:** `supabase/functions/wa-webhook-core/index.ts` (lines 164-179)

Your setup includes rate limiting that could block messages.

**Configuration:**
- Default: 100 requests per 60 seconds per phone number
- Configurable via env vars

**How to Check:**
```bash
# Check for rate limit events
supabase functions logs wa-webhook-core | grep "CORE_RATE_LIMITED"
```

**Adjust Limits:**
```bash
supabase secrets set RATE_LIMIT_MAX_REQUESTS=1000
supabase secrets set RATE_LIMIT_WINDOW_MS=60000
supabase functions deploy wa-webhook-core
```

**Disable Rate Limiting (temporary debug):**
```bash
supabase secrets set ENABLE_RATE_LIMITING=false
supabase functions deploy wa-webhook-core
```

---

### 7. ❌ Health Check & Monitoring

**Health Endpoint:** `https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-core/health`

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "wa-webhook-core",
  "timestamp": "2025-11-28T11:25:26.214Z",
  "checks": {
    "database": "ok",
    "supabase": "ok"
  },
  "microservices": {
    "wa-webhook-ai-agents": true,
    "wa-webhook-mobility": true,
    ...
  }
}
```

**If Unhealthy:**
```bash
# Check detailed logs
supabase functions logs wa-webhook-core --tail

# Check for:
# - CORE_HEALTH_ERROR
# - Database connection failures
# - Missing environment variables
```

---

## Step-by-Step Diagnostic Procedure

### Phase 1: Verify Webhook Connectivity (5 min)

```bash
# 1. Test webhook verification
curl "https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-core?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"
# Expected: test123

# 2. Check health endpoint
curl https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-core/health
# Expected: {"status":"healthy"}

# 3. Monitor real-time logs
supabase functions logs wa-webhook-core --tail
```

### Phase 2: Verify Environment Variables (5 min)

```bash
# List all secrets
supabase secrets list

# Verify required variables are set (not empty)
# - WA_PHONE_ID
# - WA_TOKEN
# - WA_APP_SECRET
# - WA_VERIFY_TOKEN
```

### Phase 3: Test Message Flow (10 min)

```bash
# 1. Send test message from WhatsApp to your bot

# 2. Check if webhook received it
supabase functions logs wa-webhook-core | grep "CORE_WEBHOOK_RECEIVED"

# 3. Check routing decision
supabase functions logs wa-webhook-core | grep "CORE_ROUTING_DECISION"

# 4. Check for errors
supabase functions logs wa-webhook-core | grep "ERROR"
```

### Phase 4: Check Database State (5 min)

```bash
# Connect to database
psql $DATABASE_URL

# Check if events are being stored
SELECT * FROM wa_events ORDER BY created_at DESC LIMIT 10;

# Check interactions
SELECT * FROM wa_interactions ORDER BY updated_at DESC LIMIT 10;

# Check notifications
SELECT * FROM notifications WHERE channel = 'whatsapp' ORDER BY created_at DESC LIMIT 10;
```

---

## Quick Fixes

### Fix 1: Complete Redeployment

```bash
# 1. Set all required secrets
supabase secrets set WA_PHONE_ID=your_value
supabase secrets set WA_TOKEN=your_value
supabase secrets set WA_APP_SECRET=your_value
supabase secrets set WA_VERIFY_TOKEN=your_value

# 2. Deploy core function
supabase functions deploy wa-webhook-core

# 3. Deploy all microservices
pnpm run functions:deploy:wa

# 4. Verify health
curl https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-core/health
```

### Fix 2: Bypass Signature (Debugging Only)

```bash
supabase secrets set WA_ALLOW_UNSIGNED_WEBHOOKS=true
supabase functions deploy wa-webhook-core
# Now test if messages are received
# If YES: signature issue - verify WA_APP_SECRET
# If NO: different issue - check logs
```

### Fix 3: Check Meta Webhook Settings

1. Go to Meta Business Manager
2. Navigate to WhatsApp → Configuration → Webhook
3. Update callback URL to: `https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-core`
4. Click "Verify and Save"
5. Re-subscribe to all webhook fields

---

## Admin Dashboard Tools

Your codebase includes monitoring tools:

1. **WhatsApp Health Dashboard**
   - URL: `https://admin.easymo.dev/whatsapp-health`
   - Shows delivery stats, webhook errors, success rate

2. **WhatsApp Menu Management**
   - URL: `https://admin.easymo.dev/whatsapp-menu`
   - Configure home menu items

3. **Real-time Logs**
   ```bash
   # Monitor webhook activity
   supabase functions logs wa-webhook-core --tail
   ```

---

## Common Error Patterns

### Error: "unauthorized" (401)
**Cause:** Signature verification failed  
**Fix:** Verify `WA_APP_SECRET` matches Meta App Dashboard

### Error: "server_misconfigured" (500)
**Cause:** Missing `WHATSAPP_APP_SECRET` environment variable  
**Fix:** `supabase secrets set WA_APP_SECRET=your_secret`

### Error: "rate_limit_exceeded" (429)
**Cause:** Too many messages from same number  
**Fix:** Increase rate limits or disable temporarily

### No logs at all
**Cause:** Webhook not reaching your server  
**Fix:** Verify Meta webhook URL points to `wa-webhook-core`

---

## Next Steps

1. **Run Phase 1 diagnostics** - Verify webhook connectivity
2. **Check Meta webhook configuration** - Ensure it points to `wa-webhook-core`
3. **Verify all environment variables** - Use `supabase secrets list`
4. **Monitor logs while sending test message** - `supabase functions logs wa-webhook-core --tail`
5. **Check database for events** - Verify messages are being stored

---

## Support Resources

- **Supabase Dashboard:** https://app.supabase.com/project/YOUR_PROJECT_ID
- **Meta Business Manager:** https://business.facebook.com/
- **Logs:** `supabase functions logs wa-webhook-core`
- **Health Check:** `https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-core/health`

---

## Appendix: Key Files Reference

- **Main Router:** `supabase/functions/wa-webhook-core/index.ts`
- **Config:** `supabase/functions/wa-webhook/config.ts`
- **Environment Template:** `.env.example` (lines 39-73)
- **Deployment Script:** `package.json` (line 13: `functions:deploy:wa`)
- **Troubleshooting Guide:** `docs/archive/deployment/WA_WEBHOOK_TROUBLESHOOTING.md`

---

**Report Generated:** 2025-11-28  
**Confidence Level:** High - Based on comprehensive code analysis  
**Recommended Action:** Start with Phase 1 diagnostics, then verify Meta webhook configuration
