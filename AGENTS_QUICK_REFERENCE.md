# 🚀 AI Agents Quick Reference Card

## Phase 1 Complete Summary

### 📊 By the Numbers
- **4 Agents Implemented** (Property, Schedule, Quincaillerie, Shops)
- **47KB Total Code** (TypeScript)
- **23.9KB SQL Migrations** (3 new files)
- **12 Database Tables** created
- **8 Database Functions** written
- **~1,818 Lines of Code**

---

## 🎯 Quick Deploy

```bash
# 1. Apply migrations
cd /path/to/easymo-
supabase db push

# 2. Deploy functions
supabase functions deploy agents/property-rental
supabase functions deploy agents/schedule-trip
supabase functions deploy agents/quincaillerie
supabase functions deploy agents/shops

# 3. Test
curl -X POST $SUPABASE_URL/functions/v1/agents/property-rental \
  -H "Authorization: Bearer $ANON_KEY" \
  -d '{"userId":"test","action":"search","location":{"latitude":-1.9441,"longitude":30.0619}}'
```

---

## 📱 WhatsApp Integration Snippets

### Intent Detection
```typescript
if (msg.includes('property') || msg.includes('rent')) 
  return 'property_rental';
if (msg.includes('schedule') || msg.includes('tomorrow')) 
  return 'schedule_trip';
if (msg.includes('hardware') || msg.includes('construction')) 
  return 'quincaillerie';
if (msg.includes('shop') || msg.includes('product')) 
  return 'shops';
```

### Agent Invocation
```typescript
const result = await fetch(`${SUPABASE_URL}/functions/v1/agents/${agentType}`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
```

---

## 🗄️ Database Quick Queries

### Check Active Sessions
```sql
SELECT agent_type, COUNT(*), AVG(EXTRACT(EPOCH FROM (NOW() - started_at))) 
FROM agent_sessions 
WHERE status = 'searching' 
GROUP BY agent_type;
```

### Top Performing Quotes
```sql
SELECT vendor_name, COUNT(*), AVG(ranking_score)
FROM agent_quotes
WHERE status = 'accepted'
GROUP BY vendor_name
ORDER BY COUNT(*) DESC
LIMIT 10;
```

### Pattern Learning Stats
```sql
SELECT user_id, COUNT(*) as trips, 
       ARRAY_AGG(DISTINCT day_of_week) as active_days
FROM travel_patterns
GROUP BY user_id
HAVING COUNT(*) > 5;
```

---

## 🔑 Environment Variables

```bash
# Required
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
OPENAI_API_KEY=sk-xxx...

# Optional
PROPERTY_SEARCH_RADIUS_KM=10
SCHEDULE_NOTIFICATION_MINUTES=30
AGENT_TIMEOUT_MS=300000
```

---

## 📊 Key Metrics Dashboard

### Monitor These:
```sql
-- Response times
SELECT agent_type, 
       percentile_cont(0.50) WITHIN GROUP (ORDER BY duration_ms) as p50,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95
FROM agent_sessions 
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY agent_type;

-- Success rates
SELECT agent_type,
       COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) as success_rate
FROM agent_sessions
GROUP BY agent_type;

-- Acceptance rates  
SELECT agent_type,
       COUNT(*) FILTER (WHERE status = 'accepted') * 100.0 / COUNT(*) as acceptance_rate
FROM agent_quotes
JOIN agent_sessions ON agent_quotes.session_id = agent_sessions.id
GROUP BY agent_type;
```

---

## 🛠️ Troubleshooting

### Common Issues:

**Agent not responding**
```bash
# Check logs
supabase functions logs agents/property-rental --tail

# Verify env vars
supabase secrets list
```

**OCR failing**
```typescript
// Check OpenAI API
const test = await fetch('https://api.openai.com/v1/models', {
  headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
});
console.log(await test.json());
```

**Geo-search not working**
```sql
-- Verify PostGIS
SELECT PostGIS_version();

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('properties', 'shops', 'vendors');
```

---

## 📁 File Locations

```
📂 supabase/
├── 📂 functions/agents/
│   ├── 📂 property-rental/     (10KB)
│   ├── 📂 schedule-trip/       (14KB)
│   ├── 📂 quincaillerie/       (10KB)
│   └── 📂 shops/               (13KB)
└── 📂 migrations/
    ├── 📄 20260215100000_property_rental_agent.sql (5.6KB)
    ├── 📄 20260215110000_schedule_trip_agent.sql (8.7KB)
    └── 📄 20260215120000_shops_quincaillerie_agents.sql (9.6KB)
```

---

## 🎯 Feature Matrix

| Feature | Property | Schedule | Quincaillerie | Shops |
|---------|----------|----------|---------------|-------|
| Geo-search | ✅ | ✅ | ✅ | ✅ |
| OCR/Vision | ❌ | ❌ | ✅ | ✅ |
| ML Predictions | ❌ | ✅ | ❌ | ❌ |
| Price Negotiation | ✅ | ❌ | ✅ | ✅ |
| Reviews | ✅ | ❌ | ✅ | ✅ |
| Recurring | ❌ | ✅ | ❌ | ❌ |
| Multi-vendor | ✅ | ❌ | ✅ | ✅ |
| Add Listing | ✅ | ❌ | ❌ | ✅ |

---

## 🚦 Status Indicators

### Agent Status
- 🟢 **Active** - Accepting requests
- 🟡 **Degraded** - Slow responses
- 🔴 **Down** - Not responding
- ⚪ **Disabled** - Turned off

### Session Status
- `searching` - Looking for vendors
- `negotiating` - Getting quotes
- `presenting` - Showing options
- `completed` - User selected
- `timeout` - Exceeded SLA

---

## 📞 Quick Commands

```bash
# Deploy all agents
for agent in property-rental schedule-trip quincaillerie shops; do
  supabase functions deploy agents/$agent
done

# Check function status
supabase functions list

# Tail all logs
supabase functions logs --tail

# Run migrations
supabase db push

# Generate types
supabase gen types typescript --local > types/database.ts
```

---

## 🎉 Success Checklist

- [x] Code deployed
- [x] Migrations applied
- [x] Tests passing
- [x] Monitoring configured
- [x] Documentation complete
- [ ] Production traffic enabled
- [ ] User feedback collected
- [ ] Analytics dashboard live

---

**Version**: 1.0.0  
**Last Updated**: Feb 15, 2026  
**Status**: ✅ Production Ready  
**Next Phase**: Drivers & Pharmacy Agents
