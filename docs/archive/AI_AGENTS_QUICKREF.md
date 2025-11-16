# AI Agents Quick Reference

**Last Updated:** November 14, 2025, 8:50 PM

---

## 🚀 Quick Deploy

```bash
# 1. Apply migrations
supabase db push

# 2. Set up OpenAI API key (must support Deep Research models)
# In Supabase Dashboard: Settings → Edge Functions → Secrets
# Add: OPENAI_API_KEY=sk-...

# 3. Deploy functions
supabase functions deploy openai-deep-research
supabase functions deploy waiter-ai-agent
supabase functions deploy agent-property-rental
supabase functions deploy wa-webhook

# 4. Run tests
./test-ai-agents-complete.sh

# 5. Trigger first deep research (takes 2-5 minutes)
curl -X POST "$SUPABASE_URL/functions/v1/openai-deep-research" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "scrape", "testMode": true, "countries": ["RW"]}'

# Wait 2-5 minutes for results...
```

**⚠️ Important:** Deep Research uses `o4-mini-deep-research` model which:

- Takes 2-5 minutes per country/city
- Conducts real web searches for current listings
- Returns comprehensive reports with inline citations
- Costs ~$0.08 per research run

---

## 📁 File Structure

```
supabase/functions/
├── openai-deep-research/       # NEW: Property scraping agent
│   ├── index.ts                # Main research logic
│   └── deno.json              # Deno config
├── waiter-ai-agent/            # EXISTING: Restaurant AI
│   ├── index.ts                # Waiter conversation logic
│   └── deno.json
├── agents/property-rental/     # UPDATED: Real estate AI
│   ├── index.ts                # Now includes deep research data
│   ├── config/
│   └── deno.json
└── wa-webhook/domains/
    ├── bars/
    │   ├── search.ts           # EXISTING
    │   └── waiter_ai.ts        # NEW: Waiter integration
    └── property/
        ├── search.ts           # EXISTING
        └── ai_agent.ts         # NEW: Property AI integration

supabase/migrations/
├── 20251114194200_openai_deep_research_tables.sql       # NEW
└── 20251114194300_schedule_deep_research_cron.sql       # NEW
```

---

## 🗄️ Database Tables

### New Tables

```sql
-- Deep Research
research_sessions              -- Tracks each research run
researched_properties          -- AI-discovered properties

-- Waiter AI (if not exist)
waiter_conversations           -- Chat sessions
waiter_messages               -- Message history
waiter_reservations           -- Table bookings
waiter_feedback               -- Post-meal ratings
menu_items                    -- Restaurant menus
menu_categories               -- Menu organization
draft_orders                  -- Active orders
draft_order_items             -- Order line items
wine_pairings                 -- Wine recommendations
```

### Key Functions

```sql
search_researched_properties(...)    -- Find AI properties
search_nearby_properties(...)        -- Find user properties
```

---

## 🔑 Environment Variables

```bash
# Required for all agents
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# Optional
DATABASE_URL=postgresql://...  # For direct DB access
```

---

## 🧪 Quick Tests

### Test Deep Research

```bash
curl -X POST "$SUPABASE_URL/functions/v1/openai-deep-research" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"action": "scrape", "testMode": true, "countries": ["RW"]}'
```

### Test Waiter AI

```bash
curl -X POST "$SUPABASE_URL/functions/v1/waiter-ai-agent" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{
    "action": "start_conversation",
    "userId": "test-123",
    "language": "en"
  }'
```

### Test Property AI

```bash
curl -X POST "$SUPABASE_URL/functions/v1/agents/property-rental" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{
    "userId": "test-456",
    "action": "find",
    "rentalType": "long_term",
    "bedrooms": 2,
    "maxBudget": 500000,
    "location": {"latitude": -1.9441, "longitude": 30.0619}
  }'
```

---

## 📊 Check Status

### Research Sessions

```sql
SELECT * FROM research_sessions ORDER BY started_at DESC LIMIT 5;
```

### Researched Properties

```sql
SELECT location_country, COUNT(*), AVG(price)
FROM researched_properties
GROUP BY location_country;
```

### Cron Jobs

```sql
SELECT * FROM cron.job WHERE jobname LIKE 'openai-deep-research%';
```

### Waiter Conversations

```sql
SELECT COUNT(*) FROM waiter_conversations WHERE status = 'active';
```

---

## 🔧 Common Tasks

### Manually Trigger Deep Research

```bash
curl -X POST "$SUPABASE_URL/functions/v1/openai-deep-research" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"action": "scrape"}'
```

### Check Logs

```bash
supabase functions logs openai-deep-research --tail
supabase functions logs waiter-ai-agent --tail
supabase functions logs agent-property-rental --tail
```

### Clean Old Data

```sql
-- Archive old research sessions
DELETE FROM research_sessions
WHERE completed_at < NOW() - INTERVAL '30 days';

-- Deactivate old properties
UPDATE researched_properties
SET status = 'inactive'
WHERE scraped_at < NOW() - INTERVAL '60 days';
```

---

## 🐛 Troubleshooting

### Deep Research Not Running

```sql
-- Check cron jobs exist
SELECT * FROM cron.job;

-- Check recent runs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Manually reschedule
SELECT cron.unschedule('openai-deep-research-morning');
-- Then re-run migration
```

### No Properties Found

```bash
# Check if research ran
psql $DATABASE_URL -c "SELECT COUNT(*) FROM researched_properties;"

# Check countries configured
psql $DATABASE_URL -c "SELECT * FROM countries WHERE active = true;"

# Manually trigger
curl -X POST "$SUPABASE_URL/functions/v1/openai-deep-research" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"action": "scrape", "testMode": true}'
```

### Waiter AI Not Responding

```sql
-- Check if conversation exists
SELECT * FROM waiter_conversations
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC;

-- Check OpenAI key
SELECT current_setting('app.settings.openai_api_key', true);
```

---

## 💰 Cost Monitoring

### Estimate Daily Costs (Updated for Deep Research)

```bash
# Deep Research (o4-mini-deep-research):
#   3 runs/day × 2 countries × 3 cities × ~$0.08 = ~$1.44/day = ~$43/month
#
# Waiter AI (gpt-4-turbo-preview):
#   100 conversations × $0.05 = ~$5/day = ~$150/month
#
# Property AI (gpt-4-turbo-preview):
#   50 searches × $0.02 = ~$1/day = ~$30/month
#
# Total: ~$7.50/day = ~$225/month

# Using o3-deep-research (more thorough):
#   3 runs/day × 2 countries × 3 cities × ~$1.30 = ~$23/day = ~$690/month (!)
#   Recommendation: Use o4-mini for production

# Control costs with max_tool_calls parameter:
# - 50 tool calls (default): ~$0.08 per run
# - 30 tool calls (reduced): ~$0.05 per run
# - 20 tool calls (minimal): ~$0.03 per run
```

### Monitor Deep Research Performance

```sql
-- View research session details with tool usage
SELECT
  id,
  started_at,
  properties_found,
  properties_inserted,
  duration_ms / 1000 as duration_seconds,
  (metadata->>'toolCallsUsed')::int as tool_calls,
  (metadata->>'webSearches')::int as web_searches
FROM research_sessions
WHERE started_at > NOW() - INTERVAL '7 days'
ORDER BY started_at DESC;

-- Calculate average cost per session
SELECT
  AVG(properties_inserted) as avg_properties,
  AVG(duration_ms / 1000) as avg_seconds,
  AVG((metadata->>'toolCallsUsed')::int) as avg_tool_calls,
  -- Estimate cost: ~$0.08 per 50 tool calls
  AVG((metadata->>'toolCallsUsed')::int) * 0.08 / 50 as est_cost_per_run
FROM research_sessions
WHERE started_at > NOW() - INTERVAL '7 days';
```

### Monitor Usage

```sql
-- Research runs per day
SELECT DATE(started_at), COUNT(*)
FROM research_sessions
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(started_at);

-- Waiter conversations per day
SELECT DATE(created_at), COUNT(*)
FROM waiter_conversations
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);

-- Property searches per day
SELECT DATE(created_at), COUNT(*)
FROM agent_sessions
WHERE agent_type = 'property_rental'
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);
```

---

## 📱 WhatsApp Integration

### Test Waiter AI via WhatsApp

1. Send: "Bars & Restaurants"
2. Select a bar
3. Click "💬 Chat with AI Waiter"
4. Chat naturally:
   - "Show me your menu"
   - "I want a steak medium rare"
   - "Book table for 4 at 7pm"
   - "What wine pairs with fish?"

### Test Property AI via WhatsApp

1. Send: "Property Rentals"
2. Select "Search Properties"
3. Choose rental type
4. Enter: "2 bedrooms"
5. Enter: "500000"
6. Share location
7. View results (user + AI properties)

---

## 🎯 KPIs to Track

```sql
-- Deep Research Effectiveness
SELECT
  DATE(started_at),
  COUNT(*) as runs,
  SUM(properties_found) as found,
  SUM(properties_inserted) as inserted,
  ROUND(AVG(duration_ms / 1000), 2) as avg_seconds
FROM research_sessions
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(started_at);

-- Waiter AI Engagement
SELECT
  DATE(created_at),
  COUNT(DISTINCT user_id) as users,
  COUNT(*) as conversations,
  AVG(message_count) as avg_messages
FROM (
  SELECT c.user_id, c.created_at, COUNT(m.id) as message_count
  FROM waiter_conversations c
  LEFT JOIN waiter_messages m ON m.conversation_id = c.id
  GROUP BY c.id
) s
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);

-- Property AI Success Rate
SELECT
  DATE(created_at),
  COUNT(*) as searches,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) as rate
FROM agent_sessions
WHERE agent_type = 'property_rental'
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);
```

---

## 📚 Documentation

- **Full Guide:** `AI_AGENTS_DEPLOYMENT_COMPLETE.md`
- **Status Report:** `AI_AGENTS_ACTUAL_STATUS.md`
- **Test Script:** `test-ai-agents-complete.sh`
- **This Quick Ref:** `AI_AGENTS_QUICKREF.md`

---

## 🎉 Success Checklist

- [x] OpenAI Deep Research implemented
- [x] Waiter AI Agent ready
- [x] Property AI Agent enhanced
- [x] WhatsApp integration complete
- [x] Database migrations applied
- [x] Cron jobs scheduled (3x daily)
- [x] Tests documented
- [x] Monitoring queries ready
- [x] Cost estimates provided
- [x] Troubleshooting guide included

**Status:** ✅ PRODUCTION READY

---

**Need Help?**

1. Check logs: `supabase functions logs FUNCTION_NAME`
2. Query database: `psql $DATABASE_URL`
3. Review full guide: `AI_AGENTS_DEPLOYMENT_COMPLETE.md`
4. Run tests: `./test-ai-agents-complete.sh`
