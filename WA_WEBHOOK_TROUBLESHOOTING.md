# WhatsApp Webhook Troubleshooting Guide

## Common Issues & Solutions

### Issue: Messages Not Being Received

**Symptoms:**
- WhatsApp messages sent but no response
- Function logs show no activity

**Diagnosis:**
```bash
# Check if webhook is receiving requests
supabase functions logs wa-webhook --tail

# Look for WEBHOOK_REQUEST_RECEIVED events
```

**Common Causes:**

1. **WhatsApp webhook not configured**
   - Go to Meta Business Manager
   - Verify webhook URL points to your Supabase function
   - Check verify token matches `WA_VERIFY_TOKEN` env var

2. **Signature verification failing**
   ```bash
   # Check logs for SIG_VERIFY_FAIL
   supabase functions logs wa-webhook | grep SIG_VERIFY
   ```
   - Verify `WA_APP_SECRET` is correct
   - Check webhook subscription includes all message types

3. **Rate limiting**
   ```bash
   # Check for rate limit events
   supabase functions logs wa-webhook | grep RATE_LIMIT
   ```
   - Increase `RATE_LIMIT_MAX_REQUESTS` if needed

---

### Issue: 500 Internal Server Error

**Symptoms:**
- Webhook returns 500 status
- Log shows `WEBHOOK_UNHANDLED_ERROR`

**Diagnosis:**
```bash
# Check for unhandled errors
supabase functions logs wa-webhook | grep WEBHOOK_UNHANDLED_ERROR
```

**Common Causes:**

1. **Missing environment variables**
   ```bash
   # Verify all required vars are set
   supabase secrets list
   ```
   Required:
   - `WA_PHONE_ID`
   - `WA_TOKEN`
   - `WA_APP_SECRET`
   - `WA_VERIFY_TOKEN`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. **Database constraint violations**
   - Check error message for "constraint" or "violates"
   - Verify all migrations are applied

3. **Missing tables**
   ```sql
   -- Verify critical tables exist
   SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wa_events');
   SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wa_interactions');
   SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles');
   ```

---

### Issue: Health Check Fails

**Symptoms:**
- `GET /health` returns unhealthy status
- `"database": false` in health check response

**Diagnosis:**
```bash
curl https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook/health
```

**Solutions:**

1. **Database check failing**
   ```sql
   -- Verify wa_interactions table exists
   SELECT * FROM wa_interactions LIMIT 1;
   ```
   - If missing, apply migration `20251120220100_create_wa_interactions_table.sql`

2. **RLS policy issues**
   ```sql
   -- Check policies on wa_interactions
   SELECT * FROM pg_policies WHERE tablename = 'wa_interactions';
   ```
   - Ensure `svc_rw_wa_interactions` policy exists

---

### Issue: Duplicate Messages

**Symptoms:**
- Users receive same message multiple times
- Idempotency not working

**Diagnosis:**
```bash
# Check for IDEMPOTENCY_HIT events (should be ~1-5%)
supabase functions logs wa-webhook | grep IDEMPOTENCY
```

**Solutions:**

1. **wa_events table missing unique constraint**
   ```sql
   -- Verify unique constraint exists
   SELECT conname FROM pg_constraint 
   WHERE conrelid = 'public.wa_events'::regclass 
   AND contype = 'u';
   ```
   - Should return `wa_events_message_id_key`
   - If missing, apply migration `20251120143500_wa_events_message_id_unique.sql`

2. **event_type not being set**
   - Verify idempotency.ts sets `event_type = "idempotency_check"`
   - Check latest code is deployed

---

### Issue: Messages Stuck in Processing

**Symptoms:**
- Message received but no response
- `MESSAGE_TIMEOUT_FALLBACK` in logs

**Diagnosis:**
```bash
# Check for timeout events
supabase functions logs wa-webhook | grep TIMEOUT
```

**Solutions:**

1. **Increase handler timeout**
   ```bash
   # Set environment variable
   supabase secrets set WA_HANDLER_TIMEOUT_MS=15000
   ```

2. **Downstream service slow/failing**
   - Check if routing to microservices is enabled
   - Verify microservice health
   ```bash
   curl https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-core/health
   ```

---

### Issue: Specific User Not Receiving Messages

**Symptoms:**
- Most users work fine
- One specific user has issues

**Diagnosis:**
```bash
# Check logs for specific phone number
supabase functions logs wa-webhook | grep "+250XXXXXXXXX"
```

**Common Causes:**

1. **Invalid phone number format**
   - Check logs for `wa_message_invalid_sender`
   - Verify phone number is E.164 format

2. **Profile creation failed**
   ```sql
   -- Check if profile exists
   SELECT * FROM profiles WHERE whatsapp_e164 = '+250XXXXXXXXX';
   ```
   - If missing, may be validation issue

3. **Chat state corrupted**
   ```sql
   -- Check user's chat state
   SELECT * FROM chat_state WHERE user_id = 'USER_ID_HERE';
   ```
   - Can manually reset if needed

---

## Debug Commands

### Check Recent Errors
```bash
# Last 100 error events
supabase functions logs wa-webhook --tail 100 | grep -E "ERROR|FAIL|UNHANDLED"
```

### Monitor Live Activity
```bash
# Real-time log streaming
supabase functions logs wa-webhook --tail
```

### Check Message Flow
```bash
# Trace a specific message by correlation ID
supabase functions logs wa-webhook | grep "CORRELATION_ID_HERE"
```

### Database Health
```sql
-- Check table row counts
SELECT 
  (SELECT COUNT(*) FROM wa_events) as wa_events_count,
  (SELECT COUNT(*) FROM wa_interactions) as wa_interactions_count,
  (SELECT COUNT(*) FROM profiles) as profiles_count,
  (SELECT COUNT(*) FROM chat_state) as chat_state_count;
```

### Performance Metrics
```bash
# Get metrics summary
curl https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook/metrics/summary
```

---

## Emergency Procedures

### Webhook Completely Down

1. **Check function status**
   ```bash
   supabase functions list
   ```

2. **Redeploy function**
   ```bash
   supabase functions deploy wa-webhook --no-verify-jwt
   ```

3. **Check Supabase project status**
   - Go to dashboard
   - Verify project is active
   - Check for any incidents

### High Error Rate

1. **Enable debug logging**
   ```bash
   supabase secrets set LOG_LEVEL=debug
   ```

2. **Disable router (if causing issues)**
   ```bash
   supabase secrets set WA_ROUTER_MODE=disabled
   ```

3. **Bypass signature verification (non-prod only)**
   ```bash
   supabase secrets set SKIP_SIGNATURE_VERIFICATION=true
   ```

### Database Issues

1. **Check RLS policies**
   ```sql
   -- Temporarily disable RLS for debugging (CAUTION!)
   ALTER TABLE wa_events DISABLE ROW LEVEL SECURITY;
   -- Re-enable when done
   ALTER TABLE wa_events ENABLE ROW LEVEL SECURITY;
   ```

2. **Reload schema cache**
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

---

## Useful Queries

### Recent Message Activity
```sql
SELECT 
  event_type,
  correlation_id,
  message_id,
  created_at
FROM wa_events 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 50;
```

### Idempotency Hit Rate
```sql
SELECT 
  COUNT(*) FILTER (WHERE event_type = 'idempotency_check') as idempotency_checks,
  COUNT(*) FILTER (WHERE event_type != 'idempotency_check') as actual_events,
  ROUND(100.0 * COUNT(*) FILTER (WHERE event_type = 'idempotency_check') / COUNT(*), 2) as hit_rate_percent
FROM wa_events
WHERE created_at > NOW() - INTERVAL '1 hour';
```

### Active Users
```sql
SELECT 
  COUNT(DISTINCT phone_number) as unique_users,
  COUNT(*) as total_interactions
FROM wa_interactions
WHERE created_at > NOW() - INTERVAL '24 hours';
```

---

## Contact & Escalation

### Log Analysis
Always include:
- Correlation ID
- Timestamp (with timezone)
- Error message from logs
- Environment (production/staging)

### Performance Issues
Check metrics first:
```bash
curl https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook/metrics
```

---

**Last Updated**: 2025-11-20  
**Maintained by**: Platform Team
