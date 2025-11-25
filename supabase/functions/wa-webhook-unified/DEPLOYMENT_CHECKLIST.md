# Production Deployment Checklist

## Pre-Deployment (Complete Before Starting)

### Environment Verification
- [ ] Supabase project accessible
- [ ] Database credentials verified
- [ ] Supabase CLI installed and authenticated
- [ ] All environment variables documented
- [ ] WhatsApp Business API credentials ready
- [ ] Gemini API key valid and tested

### Code Review
- [ ] All 10 agents reviewed and approved
- [ ] Orchestrator logic verified
- [ ] Session management tested
- [ ] Intent classification validated
- [ ] Feature flags configured correctly
- [ ] No hardcoded credentials in code

### Database Preparation
- [ ] Backup current database
- [ ] Review migration script
- [ ] Test migration on staging database
- [ ] Verify backward-compatible views work
- [ ] Check indexes are created
- [ ] Confirm RLS policies are correct

### Testing Verification
- [ ] Unit tests passing (`./run-tests.sh unit`)
- [ ] Integration tests passing (`./run-tests.sh integration`)
- [ ] E2E tests passing (`./run-tests.sh e2e`)
- [ ] Manual testing completed on staging
- [ ] All critical flows tested end-to-end

---

## Deployment Day 1: Initial Deploy (1% Rollout)

### Step 1: Apply Database Migration
```bash
cd supabase
supabase db push
```

**Verify:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'unified_%';

-- Should return: unified_sessions, unified_listings, 
-- unified_applications, unified_matches, unified_agent_events
```

- [ ] All unified tables created
- [ ] Backward-compatible views created
- [ ] Indexes created successfully
- [ ] No migration errors

### Step 2: Set Environment Variables
```bash
supabase secrets set \
  GEMINI_API_KEY="your-key" \
  WHATSAPP_APP_SECRET="your-secret" \
  WA_VERIFY_TOKEN="your-token" \
  --project-ref your-project-ref
```

- [ ] All secrets set
- [ ] Secrets verified in Supabase dashboard

### Step 3: Deploy Function
```bash
cd functions/wa-webhook-unified
./deploy.sh production
```

**Or manually:**
```bash
supabase functions deploy wa-webhook-unified \
  --project-ref your-project-ref \
  --no-verify-jwt
```

- [ ] Function deployed successfully
- [ ] No deployment errors
- [ ] Function visible in Supabase dashboard

### Step 4: Health Check
```bash
curl https://your-project.supabase.co/functions/v1/wa-webhook-unified/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "wa-webhook-unified",
  "domains": ["marketplace", "jobs", "property", ...]
}
```

- [ ] Health check returns 200 OK
- [ ] All domains listed
- [ ] No error messages

### Step 5: Configure Feature Flags (0% Initially)
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
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

- [ ] Feature flags inserted
- [ ] All agents enabled
- [ ] Rollout at 0%

### Step 6: Enable 1% Rollout
```sql
UPDATE app_config 
SET value = jsonb_set(value, '{unifiedServiceRolloutPercent}', '1')
WHERE key = 'unified_service_flags';
```

- [ ] Rollout updated to 1%
- [ ] Change confirmed in database

### Step 7: Monitor (24 hours)

**Check every 4 hours:**
```sql
-- Error rate
SELECT 
  COUNT(*) FILTER (WHERE payload->>'error' IS NOT NULL) as errors,
  COUNT(*) as total,
  (COUNT(*) FILTER (WHERE payload->>'error' IS NOT NULL)::float / COUNT(*)) * 100 as error_rate
FROM unified_agent_events
WHERE created_at > NOW() - INTERVAL '4 hours';

-- Messages by agent
SELECT agent_type, COUNT(*) as count
FROM unified_agent_events
WHERE created_at > NOW() - INTERVAL '4 hours'
GROUP BY agent_type
ORDER BY count DESC;

-- Active sessions
SELECT current_agent, COUNT(*) as sessions
FROM unified_sessions
WHERE status = 'active'
AND last_message_at > NOW() - INTERVAL '1 hour'
GROUP BY current_agent;
```

**Metrics to track:**
- [ ] Error rate < 1%
- [ ] Response time acceptable
- [ ] No user complaints
- [ ] Sessions creating successfully
- [ ] All agents receiving traffic

---

## Day 2-3: Increase to 10%

### Prerequisites
- [ ] 1% rollout stable for 24+ hours
- [ ] No critical errors
- [ ] User feedback positive
- [ ] Metrics within acceptable range

### Action
```sql
UPDATE app_config 
SET value = jsonb_set(value, '{unifiedServiceRolloutPercent}', '10')
WHERE key = 'unified_service_flags';
```

### Monitor (48 hours)
- [ ] Error rate < 1%
- [ ] Response time p95 < 2s
- [ ] No increase in user complaints
- [ ] Agent handoffs working
- [ ] Session persistence verified

---

## Day 4: Increase to 50%

### Prerequisites
- [ ] 10% rollout stable for 48+ hours
- [ ] All metrics healthy
- [ ] No blocking issues

### Action
```sql
UPDATE app_config 
SET value = jsonb_set(value, '{unifiedServiceRolloutPercent}', '50')
WHERE key = 'unified_service_flags';
```

### Monitor (48 hours)
- [ ] Error rate < 0.5%
- [ ] Response time stable
- [ ] Cross-domain features working
- [ ] Database performance acceptable

---

## Day 5: Increase to 100%

### Prerequisites
- [ ] 50% rollout stable for 48+ hours
- [ ] Confidence in system stability
- [ ] Team ready for full rollout

### Action
```sql
UPDATE app_config 
SET value = jsonb_set(value, '{unifiedServiceRolloutPercent}', '100')
WHERE key = 'unified_service_flags';
```

### Monitor (1 week)
- [ ] All traffic on unified service
- [ ] Error rate < 0.5%
- [ ] Performance acceptable
- [ ] User satisfaction maintained

---

## Day 6-7: Deprecate Legacy Services

### Prerequisites
- [ ] 100% rollout stable for 1 week
- [ ] No plans to rollback
- [ ] All stakeholders informed

### Actions
1. **Disable legacy services**
```bash
# Disable each legacy service
supabase functions delete wa-webhook-marketplace
supabase functions delete wa-webhook-jobs
supabase functions delete wa-webhook-property
supabase functions delete wa-webhook-ai-agents
```

2. **Archive legacy code**
```bash
git checkout -b archive/legacy-webhooks
git add supabase/functions/wa-webhook-{marketplace,jobs,property,ai-agents}
git commit -m "Archive legacy webhook services"
git push origin archive/legacy-webhooks
```

3. **Update documentation**
- [ ] Update README files
- [ ] Update API documentation
- [ ] Notify team of changes

---

## Rollback Procedures

### Quick Rollback (Reduce Rollout)
```sql
-- Reduce to 0%
UPDATE app_config 
SET value = jsonb_set(value, '{unifiedServiceRolloutPercent}', '0')
WHERE key = 'unified_service_flags';
```

### Full Rollback (Disable Service)
```sql
-- Disable completely
UPDATE app_config 
SET value = jsonb_set(value, '{unifiedServiceEnabled}', 'false')
WHERE key = 'unified_service_flags';
```

### Emergency Rollback
If database update fails:
1. Redeploy legacy services
2. Update WhatsApp webhook URL
3. Investigate and fix issues
4. Plan new deployment

---

## Troubleshooting

### Issue: Health check fails
**Symptoms:** 500 error on health endpoint

**Check:**
- Function deployed correctly
- Environment variables set
- Database accessible
- No syntax errors in code

**Fix:**
```bash
# Redeploy function
./deploy.sh production

# Check logs
supabase functions logs wa-webhook-unified
```

### Issue: Messages not routing
**Symptoms:** Users not getting responses

**Check:**
- Feature flags enabled
- Rollout percentage > 0
- User phone in rollout bucket
- Intent classifier working

**Debug:**
```sql
-- Check recent events
SELECT * FROM unified_agent_events
ORDER BY created_at DESC
LIMIT 10;

-- Check sessions
SELECT * FROM unified_sessions
WHERE user_phone = '+250788123456';
```

### Issue: High error rate
**Symptoms:** Error rate > 1%

**Actions:**
1. Check error logs
2. Identify error pattern
3. Reduce rollout percentage
4. Fix issue
5. Gradually increase again

---

## Success Criteria

### Performance
- ✅ Response time p95 < 2s
- ✅ Error rate < 0.5%
- ✅ Session creation success > 99%
- ✅ Agent handoff < 5ms

### Functionality
- ✅ All 10 agents working
- ✅ Hybrid flows functioning
- ✅ Cross-domain handoffs smooth
- ✅ Session persistence reliable

### Business
- ✅ No user complaints
- ✅ User satisfaction maintained
- ✅ All features working as expected
- ✅ Team confident in system

---

## Post-Deployment

### Week 1
- [ ] Daily monitoring
- [ ] Review error logs
- [ ] Collect user feedback
- [ ] Document any issues

### Week 2
- [ ] Weekly review meeting
- [ ] Performance analysis
- [ ] Optimization opportunities
- [ ] Plan next improvements

### Month 1
- [ ] Monthly metrics review
- [ ] Cost analysis
- [ ] User satisfaction survey
- [ ] Celebrate success! 🎉

---

## Contact Information

**On-Call Engineer:** [Your Name]  
**Escalation:** [Manager Name]  
**Emergency:** [Emergency Contact]

**Resources:**
- Deployment Guide: `DEPLOYMENT.md`
- Testing Plan: `TESTING_PLAN.md`
- Walkthrough: `walkthrough.md`
- Code: `supabase/functions/wa-webhook-unified/`

---

**Deployment Status:** ⏳ Ready to Start  
**Estimated Duration:** 7 days  
**Risk Level:** Low (with feature flags and gradual rollout)
