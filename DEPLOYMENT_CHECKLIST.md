# ✅ AI Agents Deployment Checklist

Use this checklist to deploy your AI agents step by step.

---

## Phase 1: Pre-Deployment Setup

### Environment Setup
- [ ] Install Supabase CLI: `brew install supabase/tap/supabase`
- [ ] Verify Supabase CLI: `supabase --version`
- [ ] Install pnpm (if not installed): `npm install -g pnpm`
- [ ] Navigate to project: `cd /Users/jeanbosco/workspace/easymo-`

### API Keys & Credentials
- [ ] Obtain OpenAI API key from https://platform.openai.com/api-keys
- [ ] Ensure OpenAI API key has GPT-4 access
- [ ] (Optional) Get WhatsApp Business API credentials from Meta
- [ ] Create `.env` file from `.env.example`
- [ ] Add `OPENAI_API_KEY=sk-proj-...` to `.env`

---

## Phase 2: Local Setup

### Start Supabase
- [ ] Run: `supabase start`
- [ ] Wait for initialization (2-3 minutes)
- [ ] Note down the API URL (usually `http://localhost:54321`)
- [ ] Note down the anon key
- [ ] Note down the service_role key
- [ ] Verify status: `supabase status`

### Database Setup
- [ ] Apply migrations: `supabase db push`
- [ ] Verify no errors in output
- [ ] Check tables exist: `supabase db execute "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"`
- [ ] Confirm these tables exist:
  - [ ] `scheduled_trips`
  - [ ] `travel_patterns`
  - [ ] `trip_predictions`
  - [ ] `properties`
  - [ ] `property_inquiries`
  - [ ] `agent_sessions`
  - [ ] `agent_quotes`
  - [ ] `vendor_catalog`

---

## Phase 3: Deploy Agents

### Automated Deployment (Recommended)
- [ ] Make script executable: `chmod +x scripts/deploy-agents.sh`
- [ ] Run deployment: `./scripts/deploy-agents.sh`
- [ ] Check for any errors in output
- [ ] Verify all 4 agents deployed successfully:
  - [ ] Property Rental Agent
  - [ ] Schedule Trip Agent
  - [ ] Quincaillerie Agent
  - [ ] Shops Agent

### Manual Deployment (Alternative)
- [ ] Deploy Property Rental: `supabase functions deploy agents/property-rental`
- [ ] Deploy Schedule Trip: `supabase functions deploy agents/schedule-trip`
- [ ] Deploy Quincaillerie: `supabase functions deploy agents/quincaillerie`
- [ ] Deploy Shops: `supabase functions deploy agents/shops`

### Set Function Secrets
- [ ] Set OpenAI key: `supabase secrets set OPENAI_API_KEY=sk-proj-...`
- [ ] Set Service Role key: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJh...`
- [ ] (Optional) Set WhatsApp token: `supabase secrets set WHATSAPP_ACCESS_TOKEN=...`
- [ ] (Optional) Set WhatsApp phone ID: `supabase secrets set WHATSAPP_PHONE_NUMBER_ID=...`

---

## Phase 4: Testing

### Automated Tests
- [ ] Make test script executable: `chmod +x scripts/test-agents.sh`
- [ ] Run tests: `./scripts/test-agents.sh`
- [ ] Verify all tests pass (10/10)
- [ ] Check test output for any failures

### Manual API Tests

#### Test 1: Property Rental Agent
```bash
SUPABASE_URL=$(supabase status | grep "API URL" | awk '{print $NF}')
ANON_KEY=$(supabase status | grep "anon key" | awk '{print $NF}')

curl -X POST "$SUPABASE_URL/functions/v1/agents/property-rental" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-001",
    "action": "find",
    "rentalType": "long_term",
    "bedrooms": 3,
    "maxBudget": 500000,
    "location": {
      "latitude": -1.9536,
      "longitude": 30.0606
    }
  }'
```

- [ ] Verify response contains `"success": true` or `"searchId"`
- [ ] Check response message is formatted correctly

#### Test 2: Schedule Trip Agent
```bash
curl -X POST "$SUPABASE_URL/functions/v1/agents/schedule-trip" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-001",
    "action": "schedule",
    "pickupLocation": {
      "latitude": -1.9536,
      "longitude": 30.0606,
      "address": "Kigali City Tower"
    },
    "dropoffLocation": {
      "latitude": -1.9440,
      "longitude": 30.0619,
      "address": "KCC"
    },
    "scheduledTime": "2025-01-10T08:00:00Z",
    "vehiclePreference": "Moto",
    "recurrence": "weekdays"
  }'
```

- [ ] Verify response contains `"tripId"`
- [ ] Check scheduled trip was created in database

#### Test 3: Pattern Analysis
```bash
curl -X POST "$SUPABASE_URL/functions/v1/agents/schedule-trip" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-001",
    "action": "analyze_patterns"
  }'
```

- [ ] Verify response (may have no patterns initially)
- [ ] Check response structure is correct

### Database Verification
- [ ] Check agent_sessions: `supabase db execute "SELECT * FROM agent_sessions ORDER BY created_at DESC LIMIT 5;"`
- [ ] Check scheduled_trips: `supabase db execute "SELECT * FROM scheduled_trips LIMIT 5;"`
- [ ] Check properties: `supabase db execute "SELECT * FROM properties LIMIT 5;"`
- [ ] Verify geographic queries work: `supabase db execute "SELECT ST_AsText(location) FROM properties LIMIT 3;"`

---

## Phase 5: Monitoring & Logs

### View Logs
- [ ] Property Rental logs: `supabase functions logs agents/property-rental`
- [ ] Schedule Trip logs: `supabase functions logs agents/schedule-trip`
- [ ] Quincaillerie logs: `supabase functions logs agents/quincaillerie`
- [ ] Shops logs: `supabase functions logs agents/shops`

### Check for Errors
- [ ] Review logs for any ERROR messages
- [ ] Check for OpenAI API errors
- [ ] Verify database connection successful
- [ ] Confirm no authentication errors

### Supabase Studio
- [ ] Open Studio: http://localhost:54323
- [ ] Check Table Editor
- [ ] Review recent database operations
- [ ] Verify PostGIS extension loaded

---

## Phase 6: Production Readiness

### Performance Check
- [ ] Run load test (if available)
- [ ] Check response times < 10 seconds
- [ ] Verify database queries < 500ms
- [ ] Test with multiple concurrent requests

### Security Review
- [ ] Ensure service role key is not in client code
- [ ] Verify RLS policies are enabled
- [ ] Check CORS headers are correct
- [ ] Confirm API keys are in secrets, not code

### Documentation Review
- [ ] Read QUICK_START.md
- [ ] Review AGENTS_FINAL_STATUS_REPORT.md
- [ ] Check all agent documentation
- [ ] Verify code comments are clear

---

## Phase 7: Optional - WhatsApp Integration

### Setup WhatsApp Webhook
- [ ] Go to Meta for Developers: https://developers.facebook.com/
- [ ] Create/select WhatsApp Business App
- [ ] Configure webhook URL: `https://your-project.supabase.co/functions/v1/wa-webhook`
- [ ] Set webhook verify token
- [ ] Subscribe to message events
- [ ] Test webhook with sample message

### Test End-to-End
- [ ] Send WhatsApp message to your number
- [ ] Verify webhook receives message
- [ ] Check agent processes request
- [ ] Confirm response sent back via WhatsApp

---

## Phase 8: Post-Deployment

### Documentation
- [ ] Update README.md with deployment notes
- [ ] Document any issues encountered
- [ ] Update CHANGELOG.md
- [ ] Create deployment report

### Backup
- [ ] Backup database: `supabase db dump -f backup.sql`
- [ ] Save environment variables
- [ ] Document API endpoints
- [ ] Save test results

### Monitoring Setup
- [ ] Set up error alerting (optional)
- [ ] Configure log aggregation (optional)
- [ ] Enable performance monitoring (optional)
- [ ] Create dashboard (optional)

---

## Troubleshooting Checklist

### If Supabase Won't Start
- [ ] Check Docker is running
- [ ] Run: `supabase stop && supabase start`
- [ ] Check ports 54321-54323 are available
- [ ] Review Supabase logs

### If Functions Won't Deploy
- [ ] Check Supabase is running: `supabase status`
- [ ] Verify function syntax: `deno check supabase/functions/agents/*/index.ts`
- [ ] Try deploying with `--no-verify-jwt` flag
- [ ] Check function logs for errors

### If Tests Fail
- [ ] Verify database migrations applied
- [ ] Check environment variables set
- [ ] Confirm OpenAI API key is valid
- [ ] Review function logs for errors
- [ ] Try manual curl tests

### If OpenAI API Errors
- [ ] Verify API key is correct
- [ ] Check you have GPT-4 access
- [ ] Confirm billing is enabled
- [ ] Check rate limits not exceeded

---

## Final Verification

### All Systems Go
- [ ] ✅ Supabase running
- [ ] ✅ Database migrated
- [ ] ✅ All 4 agents deployed
- [ ] ✅ Secrets configured
- [ ] ✅ Tests passing
- [ ] ✅ Logs clean
- [ ] ✅ Documentation complete

### Ready for Production
- [ ] ✅ Environment variables secured
- [ ] ✅ API keys protected
- [ ] ✅ Backup created
- [ ] ✅ Monitoring configured
- [ ] ✅ Team notified

---

## Success Criteria

### Deployment is successful when:
- ✅ All 4 agents respond to API calls
- ✅ Database queries return results
- ✅ OpenAI integration works (generates insights)
- ✅ Geographic searches work (PostGIS)
- ✅ Session management functions correctly
- ✅ No critical errors in logs
- ✅ Response times < 10 seconds
- ✅ All automated tests pass

---

## Next Actions

Once this checklist is complete:

1. **Test with Real Users** (if applicable)
2. **Monitor Performance** for 24-48 hours
3. **Review Logs** daily for first week
4. **Iterate and Improve** based on feedback
5. **Scale Infrastructure** as needed

---

## Support Resources

- **Quick Start Guide**: `QUICK_START.md`
- **Status Report**: `AGENTS_FINAL_STATUS_REPORT.md`
- **Agent Catalog**: `AGENTS_INDEX.md`
- **Deployment Script**: `scripts/deploy-agents.sh`
- **Test Script**: `scripts/test-agents.sh`

---

**Estimated Time**: 30-45 minutes for complete deployment

**Last Updated**: 2025-01-08

---

## Sign-Off

Deployment completed by: ___________________  
Date: ___________________  
Status: ✅ SUCCESS / ⚠️ PARTIAL / ❌ FAILED  
Notes: _____________________________________

---

*Print this checklist and check off items as you complete them.*
