# Unified AI Agent Microservices - Deployment Guide

## Prerequisites

- Supabase CLI installed
- Database access
- Environment variables configured
- Feature flags ready

## Environment Variables

```bash
# Supabase
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# WhatsApp
export WA_VERIFY_TOKEN="your-verify-token"
export WHATSAPP_APP_SECRET="your-app-secret"

# AI
export GEMINI_API_KEY="your-gemini-api-key"

# Feature Flags
export UNIFIED_SERVICE_ENABLED="true"
export UNIFIED_SERVICE_ROLLOUT_PERCENT="0"  # Start at 0%
```

## Deployment Steps

### 1. Apply Database Migration

```bash
cd supabase
supabase db push
```

Verify migration:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'unified_%';
```

### 2. Deploy Function

```bash
cd functions/wa-webhook-unified
./deploy.sh staging
```

Or manually:
```bash
supabase functions deploy wa-webhook-unified \
  --project-ref your-project-ref \
  --no-verify-jwt
```

### 3. Set Environment Variables

```bash
supabase secrets set \
  GEMINI_API_KEY="$GEMINI_API_KEY" \
  WHATSAPP_APP_SECRET="$WHATSAPP_APP_SECRET" \
  WA_VERIFY_TOKEN="$WA_VERIFY_TOKEN" \
  --project-ref your-project-ref
```

### 4. Health Check

```bash
curl https://your-project.supabase.co/functions/v1/wa-webhook-unified/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "wa-webhook-unified",
  "version": "1.0.0",
  "features": {
    "unifiedOrchestrator": true,
    "multiDomain": true,
    "agentHandoffs": true,
    "structuredFlows": true
  },
  "domains": [
    "marketplace", "jobs", "property", "farmer",
    "waiter", "insurance", "rides", "sales",
    "business_broker", "support"
  ]
}
```

### 5. Configure Feature Flags

Start with 0% rollout:
```sql
INSERT INTO app_config (key, value) VALUES (
  'unified_service_flags',
  '{
    "unifiedServiceEnabled": true,
    "unifiedServiceRolloutPercent": 0,
    "agentFlags": {
      "marketplace": true,
      "jobs": true,
      "property": true,
      "farmer": true,
      "waiter": true,
      "insurance": true,
      "rides": true,
      "sales": true,
      "business_broker": true,
      "support": true
    },
    "features": {
      "crossDomainHandoffs": true,
      "unifiedSearch": false,
      "sharedPreferences": false,
      "hybridFlows": true
    }
  }'::jsonb
);
```

### 6. Gradual Rollout

**Day 1: 1% Canary**
```sql
UPDATE app_config 
SET value = jsonb_set(value, '{unifiedServiceRolloutPercent}', '1')
WHERE key = 'unified_service_flags';
```

Monitor for 24 hours:
- Error rates
- Response times
- User complaints

**Day 2-3: 10%**
```sql
UPDATE app_config 
SET value = jsonb_set(value, '{unifiedServiceRolloutPercent}', '10')
WHERE key = 'unified_service_flags';
```

**Day 4: 50%**
```sql
UPDATE app_config 
SET value = jsonb_set(value, '{unifiedServiceRolloutPercent}', '50')
WHERE key = 'unified_service_flags';
```

**Day 5: 100%**
```sql
UPDATE app_config 
SET value = jsonb_set(value, '{unifiedServiceRolloutPercent}', '100')
WHERE key = 'unified_service_flags';
```

## Monitoring

### Key Metrics

```sql
-- Messages processed by agent
SELECT 
  agent_type,
  COUNT(*) as message_count,
  AVG(duration_ms) as avg_duration
FROM unified_agent_events
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY agent_type;

-- Error rates
SELECT 
  COUNT(*) FILTER (WHERE payload->>'error' IS NOT NULL) as errors,
  COUNT(*) as total,
  (COUNT(*) FILTER (WHERE payload->>'error' IS NOT NULL)::float / COUNT(*)) * 100 as error_rate
FROM unified_agent_events
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Active sessions
SELECT 
  current_agent,
  COUNT(*) as active_sessions
FROM unified_sessions
WHERE status = 'active'
AND last_message_at > NOW() - INTERVAL '5 minutes'
GROUP BY current_agent;
```

### Alerts

Set up alerts for:
- Error rate > 1%
- Response time p95 > 3s
- Session creation failures
- Database connection issues

## Rollback

If issues detected:

### Quick Rollback (reduce rollout)
```sql
UPDATE app_config 
SET value = jsonb_set(value, '{unifiedServiceRolloutPercent}', '0')
WHERE key = 'unified_service_flags';
```

### Full Rollback (disable service)
```sql
UPDATE app_config 
SET value = jsonb_set(value, '{unifiedServiceEnabled}', 'false')
WHERE key = 'unified_service_flags';
```

Legacy services will automatically take over.

## Troubleshooting

### Issue: Health check fails
**Check:**
- Function deployed correctly
- Environment variables set
- Database accessible

### Issue: Messages not routing
**Check:**
- Feature flags enabled
- Rollout percentage > 0
- User phone in rollout bucket

### Issue: Agent not responding
**Check:**
- Agent enabled in feature flags
- Keywords configured correctly
- Gemini API key valid

### Issue: Session not persisting
**Check:**
- `unified_sessions` table exists
- Database permissions correct
- Session expiration not too short

## Post-Deployment

### Week 1
- Monitor error rates daily
- Review user feedback
- Adjust rollout based on metrics

### Week 2
- Increase rollout to 100%
- Disable legacy services
- Archive legacy code

### Week 3
- Remove legacy endpoints
- Clean up old session stores
- Update documentation

## Success Checklist

- [ ] Database migration applied
- [ ] Function deployed
- [ ] Health check passing
- [ ] Feature flags configured
- [ ] Monitoring dashboard ready
- [ ] Alerts configured
- [ ] Rollback plan tested
- [ ] Team trained on new system
- [ ] Documentation updated
- [ ] Legacy services on standby
