# Quick Deployment Guide - AI Agents

## 🎯 Goal
Deploy 4 AI agents (Property Rental, Schedule Trip, Quincaillerie, Shops) with OpenAI integration to Supabase.

## ✅ Prerequisites Checklist

- [x] OpenAI API key configured in `.env`
- [x] Supabase project linked
- [x] All agent code written
- [x] Database migrations created
- [x] Test scripts ready

## 🚀 3-Step Deployment

### Step 1: Deploy Database (2 minutes)

```bash
# Push all migrations to Supabase
supabase db push

# Expected output:
# ✓ Applying migration 20260215100000_property_rental_agent.sql
# ✓ Applying migration 20260215110000_schedule_trip_agent.sql
# ✓ Applying migration 20260215120000_shops_quincaillerie_agents.sql
```

**Verify:**
```bash
# Check if tables exist
supabase db diff
```

---

### Step 2: Set OpenAI Secret (1 minute)

```bash
# Set the OpenAI API key in Supabase
supabase secrets set OPENAI_API_KEY="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"

# Expected output:
# ✓ Finished supabase secrets set.
```

**Verify:**
```bash
# List secrets (won't show values)
supabase secrets list
```

---

### Step 3: Deploy Functions (3 minutes)

```bash
# Deploy each agent function
supabase functions deploy agents/property-rental --no-verify-jwt
supabase functions deploy agents/schedule-trip --no-verify-jwt
supabase functions deploy agents/quincaillerie --no-verify-jwt
supabase functions deploy agents/shops --no-verify-jwt

# Optional: Deploy negotiation function
supabase functions deploy agent-negotiation --no-verify-jwt
```

**Expected output for each:**
```
Deploying function (project: your-project-ref)
Version: <version-id>
✓ Deployed function agents/property-rental
```

---

## ✅ Verification (2 minutes)

### Test 1: Database
```bash
# Run quick database check
supabase db diff
# Should show: No schema changes detected
```

### Test 2: Functions
```bash
# Run automated tests
cd /Users/jeanbosco/workspace/easymo-
./scripts/test-ai-agents.sh
```

### Test 3: Manual API Call
```bash
# Get your project details
SUPABASE_URL=$(grep VITE_SUPABASE_URL .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")

# Test Property Rental Agent
curl -X POST "$SUPABASE_URL/functions/v1/agents/property-rental" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-123",
    "action": "find",
    "rentalType": "short_term",
    "location": {"latitude": -1.9441, "longitude": 30.0619},
    "bedrooms": 2
  }'

# Expected: JSON response with "success": true or property matches
```

---

## 🔍 Troubleshooting

### Issue: "supabase: command not found"
```bash
# Install Supabase CLI
brew install supabase/tap/supabase
```

### Issue: "Project ref not found"
```bash
# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF
```

### Issue: "Function deployment failed"
```bash
# Check function logs
supabase functions logs agents/property-rental

# Verify deno.json exists in function directory
ls -la supabase/functions/agents/property-rental/
```

### Issue: "Database push failed"
```bash
# Check connection
supabase db ping

# Reset and retry
supabase db reset
supabase db push
```

---

## 📊 Post-Deployment Monitoring

### Check Function Status
```bash
# List all deployed functions
supabase functions list

# Check function logs
supabase functions logs agents/property-rental --tail
supabase functions logs agents/schedule-trip --tail
```

### Query Agent Activity
```sql
-- In Supabase SQL Editor

-- Check recent agent sessions
SELECT 
  agent_type,
  flow_type,
  status,
  COUNT(*) as count
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY agent_type, flow_type, status;

-- Check OpenAI usage
SELECT 
  agent_type,
  jsonb_array_length(metadata->'ai_requests') as ai_calls
FROM agent_sessions
WHERE metadata ? 'ai_requests'
LIMIT 10;
```

---

## 🎉 Success Indicators

You'll know deployment is successful when:

1. ✅ `supabase db push` completes without errors
2. ✅ All 4 functions deploy successfully
3. ✅ Test script shows "All tests passed!"
4. ✅ Manual API call returns valid JSON
5. ✅ No errors in function logs

---

## 📞 Next Actions

After successful deployment:

1. **Integrate with WhatsApp Webhook:**
   - Update `wa-webhook` to route to new agents
   - Test end-to-end WhatsApp flows

2. **Monitor Performance:**
   - Watch function logs for errors
   - Check response times
   - Monitor OpenAI API usage

3. **User Testing:**
   - Test with real WhatsApp numbers
   - Gather feedback
   - Iterate on agent responses

---

## 🆘 Need Help?

```bash
# View comprehensive implementation report
cat AI_AGENTS_IMPLEMENTATION_REPORT.md

# Run full setup script (does everything)
./scripts/setup-ai-agents.sh

# Run tests
./scripts/test-ai-agents.sh
```

**Common Commands:**
```bash
# Check project status
supabase status

# View database
supabase db diff

# List functions
supabase functions list

# View logs
supabase functions logs <function-name> --tail

# Reset database (careful!)
supabase db reset
```

---

## ⏱️ Total Deployment Time: ~8 minutes

- Step 1 (DB): 2 min
- Step 2 (Secrets): 1 min
- Step 3 (Functions): 3 min
- Verification: 2 min

---

**Ready to Deploy?** Start with Step 1! 🚀
