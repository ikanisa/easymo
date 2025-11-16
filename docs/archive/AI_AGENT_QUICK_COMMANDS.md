# 🚀 AI Agent System - Quick Deployment Commands

**Last Updated**: November 13, 2025  
**Status**: READY FOR DEPLOYMENT

---

## ⚡ Quick Start (5 Minutes)

```bash
# 1. Set environment variable in Supabase Dashboard
# Go to: Project Settings → Edge Functions → Add secret
# Name: OPENAI_API_KEY
# Value: sk-your-key-here

# 2. Apply database migration
cd /Users/jeanbosco/workspace/easymo-
supabase db push

# 3. Deploy edge function
supabase functions deploy wa-webhook

# 4. Enable feature flag (via SQL Editor in Supabase Dashboard)
INSERT INTO feature_flags (flag_name, enabled, description)
VALUES ('ai_agents_enabled', true, 'Enable AI agent system')
ON CONFLICT (flag_name) DO UPDATE SET enabled = true;

# 5. Test health
curl https://your-project.supabase.co/functions/v1/wa-webhook/health

# 6. View logs
supabase functions logs wa-webhook --tail
```

---

## 📊 Monitoring Queries (Copy-Paste Ready)

### Real-Time Stats (Last Hour)

```sql
SELECT
  COUNT(*) AS messages,
  AVG(latency_ms)::INTEGER AS avg_latency_ms,
  SUM(cost_usd)::NUMERIC(10,4) AS total_cost_usd,
  COUNT(DISTINCT conversation_id) AS conversations,
  (COUNT(*) FILTER (WHERE success = true)::FLOAT / COUNT(*) * 100)::INTEGER AS success_rate_pct
FROM agent_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour';
```

### By Agent Type (Last 24h)

```sql
SELECT
  agent_type,
  COUNT(*) AS messages,
  AVG(latency_ms)::INTEGER AS avg_latency_ms,
  SUM(cost_usd)::NUMERIC(10,4) AS total_cost_usd,
  (COUNT(*) FILTER (WHERE success = true)::FLOAT / COUNT(*) * 100)::INTEGER AS success_rate_pct
FROM agent_metrics
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY agent_type
ORDER BY messages DESC;
```

### Tool Usage Stats

```sql
SELECT
  tool_name,
  COUNT(*) AS executions,
  (COUNT(*) FILTER (WHERE success = true)::FLOAT / COUNT(*) * 100)::INTEGER AS success_rate_pct,
  AVG(execution_time_ms)::INTEGER AS avg_execution_ms
FROM agent_tool_executions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY tool_name
ORDER BY executions DESC;
```

### Errors (Last Hour)

```sql
SELECT
  agent_type,
  error_message,
  COUNT(*) AS occurrences,
  MAX(timestamp) AS last_occurrence
FROM agent_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour'
  AND success = false
GROUP BY agent_type, error_message
ORDER BY occurrences DESC;
```

### Cost Tracking (Today)

```sql
SELECT
  DATE_TRUNC('hour', timestamp) AS hour,
  COUNT(*) AS messages,
  SUM(cost_usd)::NUMERIC(10,4) AS cost_usd,
  SUM(tokens_total) AS tokens
FROM agent_metrics
WHERE timestamp > DATE_TRUNC('day', NOW())
GROUP BY hour
ORDER BY hour DESC;
```

---

## 🔧 Common Configuration Changes

### Adjust Agent Temperature

```sql
UPDATE ai_agents
SET model_config = jsonb_set(
  model_config,
  '{temperature}',
  '0.8'::jsonb
)
WHERE type = 'customer_service';
```

### Change Max Tokens

```sql
UPDATE ai_agents
SET model_config = jsonb_set(
  model_config,
  '{max_tokens}',
  '500'::jsonb
)
WHERE type = 'general';
```

### Disable an Agent Temporarily

```sql
UPDATE ai_agents
SET status = 'maintenance'
WHERE type = 'marketplace';
```

### Enable/Disable Feature Flag

```sql
-- Disable AI agents (fallback to existing handlers)
UPDATE feature_flags
SET enabled = false
WHERE flag_name = 'ai_agents_enabled';

-- Re-enable
UPDATE feature_flags
SET enabled = true
WHERE flag_name = 'ai_agents_enabled';
```

---

## 🐛 Quick Troubleshooting

### Agent Not Responding

```bash
# Check feature flag
echo "SELECT * FROM feature_flags WHERE flag_name = 'ai_agents_enabled';" | psql $DATABASE_URL

# Check logs
supabase functions logs wa-webhook --tail | grep -i "ai_agent"

# Check recent errors
echo "SELECT * FROM agent_metrics WHERE success = false AND timestamp > NOW() - INTERVAL '10 minutes' ORDER BY timestamp DESC LIMIT 5;" | psql $DATABASE_URL
```

### High Latency

```bash
# Check connection pool stats (look for "CONNECTION_POOL_MAINTENANCE" in logs)
supabase functions logs wa-webhook --tail | grep "CONNECTION_POOL"

# Check slow queries
echo "SELECT conversation_id, latency_ms, llm_latency_ms, tool_execution_ms FROM agent_metrics WHERE latency_ms > 2000 AND timestamp > NOW() - INTERVAL '1 hour' ORDER BY latency_ms DESC LIMIT 10;" | psql $DATABASE_URL
```

### High Costs

```bash
# Check expensive conversations
echo "SELECT conversation_id, SUM(cost_usd) AS total_cost, COUNT(*) AS messages, SUM(tokens_total) AS tokens FROM agent_metrics WHERE timestamp > NOW() - INTERVAL '24 hours' GROUP BY conversation_id ORDER BY total_cost DESC LIMIT 10;" | psql $DATABASE_URL

# Reduce token limits
echo "UPDATE ai_agents SET model_config = jsonb_set(model_config, '{max_tokens}', '400'::jsonb) WHERE type = 'general';" | psql $DATABASE_URL
```

---

## ✅ Health Check Checklist

### After Deployment

- [ ] Health endpoint returns 200:
      `curl https://your-project.supabase.co/functions/v1/wa-webhook/health`
- [ ] Feature flag is enabled: Check `feature_flags` table
- [ ] 5 agents are active: `SELECT COUNT(*) FROM ai_agents WHERE status = 'active';`
- [ ] Default configs exist: `SELECT COUNT(*) FROM agent_configurations;`
- [ ] Logs are flowing: `supabase functions logs wa-webhook --tail`

### Test Messages

Send these via WhatsApp to test each agent:

1. **General**: "Hello" → Should greet and offer help
2. **Customer Service**: "I need help" → Should offer support options
3. **Booking**: "I want to book a trip to Kigali" → Should search trips
4. **Payment**: "What is my balance?" → Should check wallet
5. **Marketplace**: "Show me nearby pharmacies" → Should search businesses

---

## 📈 Expected Baseline Metrics (First Hour)

After 1 hour of production traffic, you should see:

```sql
-- Run this query after 1 hour
SELECT
  COUNT(*) AS messages,
  AVG(latency_ms)::INTEGER AS avg_latency_ms,
  MAX(latency_ms) AS max_latency_ms,
  SUM(cost_usd)::NUMERIC(10,4) AS total_cost_usd,
  (COUNT(*) FILTER (WHERE success = true)::FLOAT / COUNT(*) * 100)::INTEGER AS success_rate_pct,
  COUNT(DISTINCT conversation_id) AS conversations
FROM agent_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour';
```

**Expected Values**:

- Avg Latency: 600-900ms
- Success Rate: > 90%
- Cost per Message: $0.02-$0.04
- Messages per Conversation: 2-5

---

## 🚨 Alert Thresholds

Monitor these and alert if exceeded:

```sql
-- High error rate (> 5%)
SELECT
  (COUNT(*) FILTER (WHERE success = false)::FLOAT / COUNT(*))::NUMERIC(3,2) AS error_rate
FROM agent_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour'
HAVING error_rate > 0.05;

-- High latency (> 10% of requests over 2s)
SELECT
  (COUNT(*) FILTER (WHERE latency_ms > 2000)::FLOAT / COUNT(*))::NUMERIC(3,2) AS slow_rate
FROM agent_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour'
HAVING slow_rate > 0.10;

-- High cost (> $1/hour)
SELECT
  SUM(cost_usd) AS hourly_cost
FROM agent_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour'
HAVING hourly_cost > 1.0;
```

---

## 📞 Emergency Commands

### Disable AI Agents Immediately

```sql
UPDATE feature_flags
SET enabled = false
WHERE flag_name = 'ai_agents_enabled';
```

### Force Redeploy

```bash
supabase functions deploy wa-webhook --no-verify-jwt
```

### View Last 100 Errors

```sql
SELECT
  timestamp,
  agent_type,
  error_message,
  metadata
FROM agent_metrics
WHERE success = false
ORDER BY timestamp DESC
LIMIT 100;
```

### Clear Old Data (if database full)

```sql
-- Run the cleanup function
SELECT cleanup_old_agent_data();

-- Check result
SELECT
  'agent_metrics' AS table_name,
  COUNT(*) AS row_count,
  MIN(timestamp) AS oldest,
  MAX(timestamp) AS newest
FROM agent_metrics
UNION ALL
SELECT
  'agent_messages',
  COUNT(*),
  MIN(created_at),
  MAX(created_at)
FROM agent_messages;
```

---

## 📚 Documentation References

- **Full Deployment Guide**: `AI_AGENT_DEPLOYMENT_GUIDE.md`
- **Technical Review**: `AI_AGENT_IMPLEMENTATION_DEEP_REVIEW.md`
- **Final Status**: `AI_AGENT_FINAL_STATUS.md`
- **Database Schema**: `supabase/migrations/20251113140000_ai_agent_production_ready.sql`

---

## 🎯 Success Criteria

After 24 hours, verify these metrics:

- [ ] **Coverage**: > 60% of messages handled by AI
- [ ] **Latency P95**: < 1500ms
- [ ] **Success Rate**: > 95%
- [ ] **Cost**: < $20/day for 10k messages
- [ ] **User Satisfaction**: No complaints in first 24h
- [ ] **Zero Critical Errors**: No database failures, no auth issues

---

**Quick Links**:

- Supabase Dashboard: https://app.supabase.com/project/your-project
- Logs: `supabase functions logs wa-webhook --tail`
- Database: `psql $DATABASE_URL`

**Support**: Check troubleshooting sections in deployment guide
