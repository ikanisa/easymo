# Android SMS Bridge Gateway Implementation

This directory contains the complete implementation of the Android SMS Bridge Gateway for the Ibimina SACCO+ platform.

## Overview

The Android SMS Bridge Gateway enables automatic processing of Mobile Money payment SMS messages received on dedicated Android devices. It provides:

- **AI-powered SMS parsing** using Gemini and OpenAI
- **Automatic payment record creation** with intelligent allocation
- **Gateway health monitoring** with offline alerts
- **Real-time notifications** via database triggers
- **Comprehensive audit trail** for compliance

## Files Created

### Edge Functions

1. **`supabase/functions/android-sms-bridge/index.ts`**
   - Main endpoint for receiving SMS from Android devices
   - Validates HMAC signatures for security
   - Parses SMS using regex → Gemini → OpenAI fallback chain
   - Creates payment records and audit logs
   - Handles heartbeats and device registration

2. **`supabase/functions/gateway-health-check/index.ts`**
   - Scheduled health check for gateway devices
   - Detects offline devices (no heartbeat > 5 minutes)
   - Sends email alerts to administrators
   - Updates device active status

3. **`supabase/functions/_shared/gemini-parser.ts`**
   - Gemini AI integration for SMS parsing
   - Structured output with transaction extraction
   - Format conversion to standard ParsedTransaction

### Database Migration

4. **`supabase/migrations/20251126125320_android_sms_gateway.sql`**
   - Creates `app.gateway_devices` table (device registry)
   - Creates `app.gateway_heartbeats` table (health monitoring)
   - Creates `app.raw_sms_logs` table (SMS audit trail)
   - Adds RLS policies for secure data access
   - Creates database triggers for real-time notifications
   - Adds indexes for query performance

### Documentation

5. **`docs/ANDROID_SMS_BRIDGE_SETUP.md`**
   - Complete setup and configuration guide
   - Environment variable documentation
   - Android app configuration instructions
   - Monitoring and troubleshooting guide
   - Security considerations
   - API reference

6. **`docs/ANDROID_SMS_BRIDGE_TESTS.md`**
   - Comprehensive test suite documentation
   - Sample SMS messages for testing
   - Unit test specifications
   - Integration test procedures
   - Performance test guidelines
   - Security test cases

### Tests

7. **`supabase/functions/_tests/gemini-parser.test.ts`**
   - Unit tests for Gemini parser
   - Format conversion tests
   - Integration tests with real API (optional)

### Configuration

8. **`.env.example`** (updated)
   - Added `GEMINI_API_KEY` and `GEMINI_MODEL`
   - Added `ANDROID_BRIDGE_HMAC_SECRET`
   - Added `GATEWAY_OFFLINE_ALERT_EMAIL`
   - Added `GATEWAY_OFFLINE_THRESHOLD_MINUTES`

## Architecture

```
┌─────────────────────┐
│  Android Device     │
│  (SMS Receiver)     │
└──────────┬──────────┘
           │ HTTPS + HMAC
           ▼
┌─────────────────────┐
│  android-sms-bridge │
│  Edge Function      │
└──────────┬──────────┘
           │
           ├─────────────┐
           │             ▼
           │    ┌─────────────────┐
           │    │  Regex Parser   │
           │    │  (Free, Fast)   │
           │    └─────────────────┘
           │             │
           │             ▼ (if failed)
           │    ┌─────────────────┐
           │    │  Gemini Parser  │
           │    │  ($0.02/1K req) │
           │    └─────────────────┘
           │             │
           │             ▼ (if failed)
           │    ┌─────────────────┐
           │    │  OpenAI Parser  │
           │    │  ($0.50/1K req) │
           │    └─────────────────┘
           │
           ▼
┌─────────────────────┐
│  Database Tables    │
│  - raw_sms_logs     │
│  - payments         │
│  - gateway_devices  │
│  - gateway_heartbeats│
└─────────────────────┘
           │
           ▼
┌─────────────────────┐
│  Real-time Notifs   │
│  (PostgreSQL NOTIFY)│
└─────────────────────┘
```

## Key Features

### 1. Multi-AI Parser Cascade

Cost-efficient fallback chain:
- **Regex** (free, instant) - tries first
- **Gemini** (cheap, fast) - falls back if regex fails
- **OpenAI** (expensive, accurate) - last resort

### 2. Security

- HMAC-SHA256 request signing
- Timestamp validation (5-minute window)
- Sender ID filtering (only known MoMo providers)
- MSISDN encryption (AES-256-GCM)
- Rate limiting (100 req/min per device)
- Row-Level Security (RLS) policies

### 3. Health Monitoring

- Heartbeat tracking every request
- Scheduled health checks (5-minute interval)
- Email alerts for offline devices
- Device metrics (battery, signal, network)

### 4. Audit Trail

- Complete SMS log (`raw_sms_logs`)
- Parser metadata (source, confidence)
- Payment linkage
- Error tracking

### 5. Real-time Updates

- Database triggers on new SMS
- PostgreSQL NOTIFY for instant updates
- Supabase realtime subscriptions support

## Environment Setup

### Required Environment Variables

```bash
# AI Parsing
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-1.5-flash

# Security
ANDROID_BRIDGE_HMAC_SECRET=$(openssl rand -hex 32)
HMAC_SHARED_SECRET=$(openssl rand -hex 32)

# Monitoring
GATEWAY_OFFLINE_ALERT_EMAIL=admin@yoursacco.rw
GATEWAY_OFFLINE_THRESHOLD_MINUTES=5

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional Fallback
OPENAI_API_KEY=sk-your-openai-key
```

### Deployment Steps

1. **Apply database migration:**
   ```bash
   supabase db push
   ```

2. **Deploy edge functions:**
   ```bash
   supabase functions deploy android-sms-bridge
   supabase functions deploy gateway-health-check
   ```

3. **Set function secrets:**
   ```bash
   supabase secrets set \
     GEMINI_API_KEY=your-key \
     ANDROID_BRIDGE_HMAC_SECRET=your-secret \
     GATEWAY_OFFLINE_ALERT_EMAIL=admin@example.com
   ```

4. **Configure cron schedule** (for health checks):
   ```sql
   SELECT cron.schedule(
     'gateway-health-check',
     '*/5 * * * *',  -- Every 5 minutes
     $$
     SELECT net.http_post(
       url := 'https://your-project.supabase.co/functions/v1/gateway-health-check',
       headers := '{"Content-Type": "application/json"}'::jsonb
     )
     $$
   );
   ```

## Testing

### Unit Tests

```bash
cd supabase/functions
deno test _tests/gemini-parser.test.ts
```

### Integration Test

```bash
# Set API key
export GEMINI_API_KEY=your-actual-key

# Run with network access
deno test _tests/gemini-parser.test.ts --allow-net --allow-env
```

### Manual Endpoint Test

```bash
# See docs/ANDROID_SMS_BRIDGE_TESTS.md for full examples
curl -X POST "https://your-project.supabase.co/functions/v1/android-sms-bridge" \
  -H "Content-Type: application/json" \
  -H "x-signature: <hmac-signature>" \
  -H "x-timestamp: <iso-timestamp>" \
  -d '{"sender_id":"MTN","raw_message":"...","received_at":1234567890000,"device_id":"test"}'
```

## Monitoring Queries

### Check Recent SMS

```sql
SELECT * FROM app.raw_sms_logs 
ORDER BY created_at DESC LIMIT 10;
```

### Check Device Health

```sql
SELECT 
  device_id,
  device_name,
  is_active,
  last_heartbeat_at,
  EXTRACT(EPOCH FROM (NOW() - last_heartbeat_at))/60 as minutes_since_heartbeat
FROM app.gateway_devices
ORDER BY last_heartbeat_at DESC;
```

### Parser Performance

```sql
SELECT 
  parse_source,
  COUNT(*) as total,
  AVG(parse_confidence) as avg_confidence,
  COUNT(*) FILTER (WHERE status = 'PARSED') as success,
  COUNT(*) FILTER (WHERE status = 'FAILED') as failed
FROM app.raw_sms_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY parse_source;
```

## Cost Estimate

**Assumptions:** 1,000 SMS/month, 70% regex, 25% Gemini, 5% OpenAI

| Parser | Volume | Unit Cost | Monthly Cost |
|--------|--------|-----------|--------------|
| Regex  | 700    | $0        | $0           |
| Gemini | 250    | $0.002    | $0.50        |
| OpenAI | 50     | $0.05     | $2.50        |
| **Total** | 1,000 | -      | **$3.00**    |

## Support

- **Setup Guide:** `docs/ANDROID_SMS_BRIDGE_SETUP.md`
- **Test Guide:** `docs/ANDROID_SMS_BRIDGE_TESTS.md`
- **Edge Function Logs:** `supabase functions logs android-sms-bridge`
- **Database Queries:** See "Monitoring Queries" section above

## Next Steps

1. ✅ Database migration applied
2. ✅ Edge functions deployed
3. ✅ Environment variables configured
4. ⏳ Android SMS Bridge app development (separate project)
5. ⏳ Production testing with real devices
6. ⏳ Monitoring dashboard integration

## Contributing

When modifying this system:

1. Update relevant documentation
2. Add/update tests
3. Test locally with sample SMS messages
4. Verify database migrations are backwards compatible
5. Check security implications (RLS, HMAC, encryption)
6. Update cost estimates if changing AI providers

## License

Part of the Ibimina SACCO+ platform.
