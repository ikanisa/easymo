# EasyMO Agent System - Operations Quick Reference

**Last Updated:** November 22, 2025  
**Status:** ✅ Production

---

## Quick Health Check

```bash
# 1. Check edge function health
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-ai-agents/health | jq

# 2. Run full system test
./test-agent-system.sh

# 3. Check feature flag status
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  -c "SELECT key, value->'enabled', value->'rollout_percentage' FROM system_config;"
```

---

## Critical Commands

### Rollback (Emergency)
```sql
-- Disable unified agent system immediately
UPDATE system_config 
SET value = jsonb_set(value, '{enabled}', 'false')
WHERE key = 'feature_unified_agent_system';
```

### Gradual Rollout
```sql
-- Start with 10%
UPDATE system_config 
SET value = jsonb_set(value, '{rollout_percentage}', '10')
WHERE key = 'feature_unified_agent_system';

-- Increase to 50%
UPDATE system_config 
SET value = jsonb_set(value, '{rollout_percentage}', '50')
WHERE key = 'feature_unified_agent_system';

-- Full rollout
UPDATE system_config 
SET value = jsonb_set(value, '{rollout_percentage}', '100')
WHERE key = 'feature_unified_agent_system';
```

### Check System Activity
```sql
-- Active conversations in last hour
SELECT 
  a.slug,
  COUNT(DISTINCT c.id) as conversations,
  COUNT(m.id) as messages
FROM ai_agents a
LEFT JOIN whatsapp_conversations c ON c.agent_id = a.id
LEFT JOIN whatsapp_messages m ON m.conversation_id = c.id
WHERE m.created_at > now() - interval '1 hour'
GROUP BY a.slug
ORDER BY messages DESC;

-- Intent success rate (last 24h)
SELECT 
  intent_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'applied') as applied,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'applied') / COUNT(*), 1) as pct
FROM ai_agent_intents
WHERE created_at > now() - interval '24 hours'
GROUP BY intent_type
ORDER BY total DESC;

-- Response time by agent
SELECT 
  a.slug,
  ROUND(AVG(EXTRACT(EPOCH FROM (i.applied_at - i.created_at))), 2) as avg_sec
FROM ai_agent_intents i
JOIN ai_agents a ON a.id = i.agent_id
WHERE i.applied_at IS NOT NULL
  AND i.created_at > now() - interval '1 hour'
GROUP BY a.slug
ORDER BY avg_sec DESC;
```

---

## Deploy Edge Function

```bash
# Deploy webhook handler
supabase functions deploy wa-webhook-ai-agents --project-ref lhbowpbcpwoiparwnwgt

# Watch logs
supabase functions logs wa-webhook-ai-agents --project-ref lhbowpbcpwoiparwnwgt --tail
```

---

## Database Connection

```bash
# Quick connect
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

# Or export for scripts
export DATABASE_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"
```

---

## Monitoring Queries

```sql
-- Failed intents (needs attention)
SELECT 
  i.id,
  a.slug,
  i.intent_type,
  i.error_message,
  i.created_at
FROM ai_agent_intents i
JOIN ai_agents a ON a.id = i.agent_id
WHERE i.status = 'failed'
  AND i.created_at > now() - interval '1 hour'
ORDER BY i.created_at DESC;

-- Slow responses (> 5 seconds)
SELECT 
  a.slug,
  i.intent_type,
  EXTRACT(EPOCH FROM (i.applied_at - i.created_at)) as seconds
FROM ai_agent_intents i
JOIN ai_agents a ON a.id = i.agent_id
WHERE i.applied_at IS NOT NULL
  AND EXTRACT(EPOCH FROM (i.applied_at - i.created_at)) > 5
  AND i.created_at > now() - interval '1 hour'
ORDER BY seconds DESC;

-- Most active users
SELECT 
  wu.phone_number,
  COUNT(DISTINCT wc.id) as conversations,
  COUNT(wm.id) as messages,
  MAX(wm.created_at) as last_active
FROM whatsapp_users wu
JOIN whatsapp_conversations wc ON wc.user_id = wu.id
JOIN whatsapp_messages wm ON wm.conversation_id = wc.id
WHERE wm.created_at > now() - interval '24 hours'
GROUP BY wu.phone_number
ORDER BY messages DESC
LIMIT 10;
```

---

## Architecture at a Glance

```
WhatsApp → wa-webhook-ai-agents → AgentOrchestrator → AI Runtime
                                         ↓
                                   ai_agent_intents
                                         ↓
                                  apply_intent_*()
                                         ↓
                                  Domain Tables
                                         ↓
                                  WhatsApp Reply
```

---

## Key Tables

- `ai_agents` - 9 agents (8 AI + 1 profile)
- `ai_agent_intents` - Parsed user intents
- `whatsapp_users` - User profiles
- `whatsapp_conversations` - Active chats
- `whatsapp_messages` - Message history
- `system_config` - Feature flags

---

## Key Functions

- `apply_intent_waiter()`
- `apply_intent_farmer()`
- `apply_intent_business_broker()`
- `apply_intent_real_estate()`
- `apply_intent_jobs()`
- `apply_intent_sales_sdr()`
- `apply_intent_rides()`
- `apply_intent_insurance()`

---

## Important URLs

- **Health:** https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-ai-agents/health
- **Dashboard:** https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt
- **Functions:** https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions

---

## Troubleshooting

### Issue: No messages being processed

1. Check edge function health
2. Check WhatsApp webhook configuration
3. Check function logs: `supabase functions logs wa-webhook-ai-agents --tail`
4. Verify feature flag is enabled

### Issue: High error rate

1. Check failed intents: See "Failed intents" query above
2. Check function logs for errors
3. Verify database connectivity
4. Check OpenAI API status

### Issue: Slow responses

1. Check slow responses query above
2. Check database query performance
3. Check OpenAI API latency
4. Consider caching optimization

### Issue: Need to rollback

1. Run rollback SQL (see "Critical Commands" above)
2. Verify with feature flag check
3. Monitor for traffic drop
4. Investigate issue before re-enabling

---

## Support Contacts

**Production Issues:**
1. Check this guide first
2. Run `./test-agent-system.sh`
3. Check function logs
4. Check monitoring queries

**Documentation:**
- Architecture: `docs/architecture/agents-map.md`
- Pipeline: `docs/architecture/whatsapp-pipeline.md`
- Full Report: `COMPLETE_AGENT_REFACTOR_DEPLOYMENT_2025-11-22.md`

---

## Deployment Info

- **Deployed:** November 22, 2025 @ 10:33 UTC
- **Version:** 3.0.0
- **Database:** lhbowpbcpwoiparwnwgt
- **Region:** us-east-1
- **Status:** ✅ Production

---

**Keep this handy for operations!** 📋
