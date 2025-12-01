# 🚀 AI Agent System - Quick Reference Guide

**Last Updated**: 2025-12-01  
**Status**: Production Ready ✅

---

## 📊 SYSTEM OVERVIEW

**9 Active AI Agents** | **193 Tools** | **Database-Driven** | **Redis Cached** | **Analytics Enabled**

| Agent | Tools | Features | Status |
|-------|-------|----------|--------|
| Support | 15 | Routing, FAQ, Tickets | ✅ Active |
| Marketplace | 7 | Listings, Contact Seller | ✅ Active |
| Waiter | 34 | Menu, Orders, Reservations | ✅ Active |
| Farmer | 22 | Produce, Markets | ✅ Active |
| Jobs | 24 | Search, Apply, Schedule | ✅ Active |
| Real Estate | 31 | Properties, Viewings | ✅ Active |
| Rides | 16 | Booking, Tracking | ✅ Active |
| Insurance | 13 | Quotes, Claims | ✅ Active |
| Sales | 31 | Cold Calling, Leads | ✅ Active |

**Total**: 193 active tools across 9 agents

---

## ⚡ QUICK COMMANDS

### Monitor Agent Health
```bash
export DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"

# Check all agents
psql "$DATABASE_URL" -c "SELECT * FROM get_agent_health_status();"

# Check specific agent
psql "$DATABASE_URL" -c "SELECT * FROM get_agent_health_status() WHERE agent_slug = 'support';"
```

### View Analytics
```sql
-- Performance last 7 days
SELECT * FROM agent_performance_dashboard 
WHERE date >= CURRENT_DATE - 7;

-- Top tools
SELECT agent_slug, tool_name, execution_count, success_rate 
FROM tool_usage_analytics 
WHERE date >= CURRENT_DATE - 7 
ORDER BY execution_count DESC LIMIT 10;

-- Cache stats
SELECT * FROM config_cache_performance 
ORDER BY hour DESC LIMIT 24;
```

### Manage Cache
```sql
-- Invalidate cache
SELECT invalidate_agent_cache('support');

-- Check cache metrics
SELECT agent_slug, load_source, load_time_ms 
FROM agent_config_cache_metrics 
ORDER BY created_at DESC LIMIT 10;
```

---

## 🏗️ ARCHITECTURE

### Request Flow
```
WhatsApp Message 
  ↓
wa-webhook-unified
  ↓
Agent Router
  ↓
BaseAgent.process()
  ↓
AgentConfigLoader.loadAgentConfig('support')
  ↓
1. Check Memory Cache (5 min TTL) → HIT? Return
2. Check Redis Cache (15 min TTL) → HIT? Return  
3. Load from Database → Cache in Redis + Memory → Return
  ↓
Build System Prompt from DB Config
  ↓
Call Gemini with Tools
  ↓
Execute Tools via ToolExecutor
  ↓
Return Response
```

### Caching Strategy
- **Level 1**: Memory Cache (5 min, per-function)
- **Level 2**: Redis Cache (15 min, shared)
- **Level 3**: Database (source of truth)
- **Invalidation**: Automatic via triggers

---

## 🔧 ENVIRONMENT VARIABLES

### Required
```bash
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=AIza...
```

### Optional Tools
```bash
# Redis (15 min shared cache)
REDIS_URL=redis://default:password@host:6379

# Weather
OPENWEATHER_API_KEY=your_key

# Translation
GOOGLE_TRANSLATE_API_KEY=your_key

# Maps/Geocoding
GOOGLE_MAPS_API_KEY=your_key

# SMS
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your_token

# Search
SERPER_API_KEY=your_key  # OR
TAVILY_API_KEY=your_key

# Payments
MOMO_API_KEY=your_key
MOMO_USER_ID=your_user
MOMO_SUBSCRIPTION_KEY=your_key

# Cache Invalidation
INVALIDATION_WEBHOOK_SECRET=your_secret
```

---

## 📊 ANALYTICS VIEWS

| View | Purpose | Retention |
|------|---------|-----------|
| `agent_performance_dashboard` | Daily stats, response times | 30 days |
| `tool_usage_analytics` | Tool execution metrics | 30 days |
| `config_cache_performance` | Cache hit rates | 24 hours |
| `agent_satisfaction_metrics` | User ratings | 30 days |
| `agent_error_summary` | Error tracking | 7 days |
| `ai_agent_experiment_analytics` | A/B test results | Active tests |
| `agent_daily_summary` | Pre-aggregated data | 90 days |

---

## 🧪 A/B TESTING

### Start Experiment
```sql
UPDATE ai_agent_instruction_experiments 
SET status = 'active' 
WHERE experiment_name = 'Support Agent: Verbose vs Concise Prompts';
```

### Check Results
```sql
SELECT variant, sample_size, success_rate, avg_satisfaction
FROM ai_agent_experiment_analytics
WHERE experiment_name LIKE '%Support%';
```

### Choose Winner
```sql
-- Stop test
UPDATE ai_agent_instruction_experiments 
SET status = 'completed', end_date = NOW() 
WHERE id = 'experiment_id';

-- Activate winner
UPDATE ai_agent_system_instructions 
SET is_active = true 
WHERE id = 'winning_variant_id';
```

---

## 🛠️ TROUBLESHOOTING

### Issue: Agent Not Responding

```sql
-- 1. Check health
SELECT * FROM get_agent_health_status() WHERE agent_slug = 'support';

-- 2. Check errors
SELECT error_type, error_count FROM agent_error_summary 
WHERE slug = 'support';

-- 3. Verify config loaded
SELECT load_source, load_time_ms FROM agent_config_cache_metrics 
WHERE agent_slug = 'support' ORDER BY created_at DESC LIMIT 1;
```

**Expected**: `load_source = 'redis'` or `'database'` (NOT 'fallback')

### Issue: Tools Failing

```sql
SELECT tool_name, success, error 
FROM ai_agent_tool_executions 
WHERE agent_id = (SELECT id FROM ai_agents WHERE slug = 'support')
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC LIMIT 10;
```

**Fix**: Check API keys for failed tools

### Issue: Slow Response Times

```sql
SELECT avg_response_time_seconds 
FROM agent_performance_dashboard 
WHERE slug = 'support' AND date >= CURRENT_DATE - 1;
```

**If >5s**: Check cache hit rate, database queries

---

## 📋 DEPLOYMENT CHECKLIST

### New Agent
1. Add to `ai_agents` table
2. Create `ai_agent_personas` entry
3. Add `ai_agent_system_instructions`
4. Define tools in `ai_agent_tools`
5. Update `whatsapp_home_menu_items`
6. Test & monitor

### New Tool
1. Add to `ai_agent_tools`
2. Implement in `tool-executor.ts` (if needed)
3. Test execution
4. Monitor success rate

### Config Update
1. Update database (auto-invalidates cache)
2. Verify in logs
3. Test behavior
4. Monitor metrics

---

## 📈 PERFORMANCE TARGETS

| Metric | Target | Status |
|--------|--------|--------|
| Cache Hit Rate | >90% | TBD |
| Tool Success Rate | >95% | TBD |
| Avg Response Time | <2s | TBD |
| User Satisfaction | >4.0/5 | TBD |
| Config Load (cached) | <10ms | ✅ |
| Config Load (DB) | <200ms | ✅ |

---

## 📚 KEY FILES

### Code
- `supabase/functions/_shared/agent-config-loader.ts` - Config loading + Redis
- `supabase/functions/_shared/tool-executor.ts` - Tool execution
- `supabase/functions/wa-webhook-unified/` - Main webhook
- `supabase/functions/agent-config-invalidator/` - Cache invalidation

### Migrations
- `20251201102239_add_support_marketplace_agents.sql` - Base system
- `20251201110000_add_common_tools.sql` - 20 new tools
- `20251201111000_ab_testing_framework.sql` - A/B testing
- `20251201112000_analytics_dashboard.sql` - Analytics
- `20251201120000_cache_invalidation_triggers.sql` - Auto-invalidation

### Docs
- `NEXT_STEPS_ROADMAP.md` - 4-week implementation plan
- `AGENT_DATABASE_FIXES_DEPLOYED.md` - Technical deep-dive
- `IMPLEMENTATION_SUMMARY.md` - Deployment guide
- `QUICK_REFERENCE.md` - This file

---

## 🚀 DEPLOYMENT HISTORY

- **Week 1**: Database-driven architecture (9 agents, 174 tools)
- **Week 2**: Common tools + A/B testing (193 tools)
- **Week 3**: Analytics dashboard (7 views, 5 tables)
- **Week 4**: Redis caching + invalidation webhooks

**System Version**: 4.0.0  
**Last Deployment**: 2025-12-01  
**Next Review**: 2025-12-15

---

## 💡 TIPS

- **Redis URL Format**: `redis://default:password@host.upstash.io:6379`
- **Cache TTL**: Memory=5min, Redis=15min, Auto-invalidates on config change
- **Monitoring**: Check health daily, review analytics weekly
- **A/B Tests**: Run for 100+ conversations before choosing winner
- **Tool Failures**: Usually API key issues, check env vars

---

**Need Help?** Check docs above or logs: `supabase functions logs wa-webhook-unified --tail`
