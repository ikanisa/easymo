# Week 4-8 Supabase Functions Consolidation Plan
**Status**: AUTONOMOUS EXECUTION  
**Last Updated**: December 3, 2025  
**Owner**: AI Agent (Full Responsibility)

---

## 📊 Current State (78 Functions Deployed)

### Production-Critical (PROTECTED - Additive Only)
✅ **wa-webhook-mobility** (v495) - 585 lines - LIVE TRAFFIC  
✅ **wa-webhook-profile** (v297) - 1142 lines - LIVE TRAFFIC  
✅ **wa-webhook-insurance** (v345) - 398 lines - LIVE TRAFFIC  

### Consolidation Targets (To Merge into wa-webhook-unified)
🔄 **wa-webhook-ai-agents** (v533) - 241 lines  
🔄 **wa-webhook-jobs** (v480) - 614 lines  
🔄 **wa-webhook-marketplace** (v317) - 715 lines  
🔄 **wa-webhook-property** (v432) - 525 lines  

### Core Infrastructure (Keep)
✅ **wa-webhook-core** (v601) - 248 lines - Base handler  
✅ **wa-webhook-unified** (v212) - 364 lines - Consolidation target  
✅ **wa-webhook** (v268) - 120 lines - Legacy router  
✅ **wa-webhook-wallet** (v195) - Financial ops  

### Archived Locally (22 Functions - To Delete from Supabase)
📦 **Agent Duplicates** (13): `.archive/agent-duplicates-20251203/`
- agent-chat, agent-config-invalidator, agent-monitor
- agent-negotiation, agent-property-rental, agent-quincaillerie
- agent-runner, agent-schedule-trip, agent-shops
- agent-tools-general-broker, agents
- job-board-ai-agent, waiter-ai-agent

📦 **Inactive Functions** (9): `.archive/inactive-functions-20251203/` & `.archive/inactive-batch2-20251203/`
- admin-subscriptions, campaign-dispatch, cart-reminder
- flow-exchange, flow-exchange-mock, housekeeping
- order-pending-reminder, simulator, wa-webhook-diag

---

## 🎯 Goal: 78 → 64 Functions (-18% reduction)

**Deletion Breakdown**:
- Week 4: Delete 22 archived functions (13 agents + 9 inactive)
- Week 8: Delete 4 consolidated webhooks (after traffic migration)
- **Total**: 26 functions removed

---

## 📅 Week 4 (Dec 3-10): Immediate Cleanup

### Phase 4.1: Delete Agent Duplicates (Day 1 - Dec 3)
**Status**: ✅ READY TO EXECUTE  
**Risk**: LOW (archived locally, no production traffic)

```bash
# Delete 13 agent duplicates
for func in agent-chat agent-config-invalidator agent-monitor agent-negotiation \
            agent-property-rental agent-quincaillerie agent-runner agent-schedule-trip \
            agent-shops agent-tools-general-broker agents job-board-ai-agent waiter-ai-agent; do
  supabase functions delete $func --project-ref $SUPABASE_PROJECT_REF
done
```

**Verification**:
```bash
supabase functions list | grep -E "agent-|waiter-ai|job-board-ai"
# Should return ZERO results
```

**Rollback** (if needed):
```bash
# Restore from archive
for func in agent-chat agent-config-invalidator agent-monitor; do
  cp -r .archive/agent-duplicates-20251203/$func supabase/functions/
  supabase functions deploy $func --no-verify-jwt
done
```

---

### Phase 4.2: Delete Inactive Functions (Day 2 - Dec 4)
**Status**: ✅ READY TO EXECUTE  
**Risk**: LOW (1+ month inactive, no code refs)

```bash
# Delete 9 inactive functions
for func in admin-subscriptions campaign-dispatch cart-reminder flow-exchange \
            flow-exchange-mock housekeeping order-pending-reminder simulator wa-webhook-diag; do
  supabase functions delete $func --project-ref $SUPABASE_PROJECT_REF
done
```

**Verification**:
```bash
supabase functions list | grep -E "admin-sub|campaign-dis|cart-rem|flow-ex|housekeep|order-pen|simulator|wa-webhook-diag"
# Should return ZERO results
```

---

### Phase 4.3: Verify wa-webhook-unified (Day 3 - Dec 5)
**Status**: VALIDATION  
**Risk**: MEDIUM (need to ensure feature parity)

**Tests**:
1. Health check returns all agents
2. Handles all 4 domain intents (jobs, marketplace, property, ai-agents)
3. Session handoffs work correctly
4. Dual AI provider fallback (Gemini → GPT-5)

```bash
# Health check
curl https://PROJECT_REF.supabase.co/functions/v1/wa-webhook-unified/health

# Expected agents:
# - waiter, farmer, support, sales_cold_caller
# - buy_sell (consolidates marketplace + business_broker)
# - jobs, real_estate, rides, insurance
```

---

### Phase 4.4: Database Schema Push (Day 4 - Dec 6)
**Status**: PENDING  
**Risk**: LOW (schema changes only)

```bash
# Apply pending migrations
supabase db push

# Verify migration hygiene
./scripts/check-migration-hygiene.sh

# Check RLS policies
grep -r "CREATE POLICY\|ALTER POLICY" supabase/migrations/
```

---

### Phase 4.5: Document Deletions (Day 5 - Dec 7)
**Status**: DOCUMENTATION  

Create deletion report:
- Functions deleted: 22
- Total size freed: ~150KB
- Archive locations
- Rollback procedures

---

## 📅 Week 5 (Dec 11-17): 10% Traffic Migration

### Phase 5.1: Deploy Traffic Router (Day 1 - Dec 11)
**Status**: IMPLEMENTATION  
**Risk**: LOW (shadow mode first)

Update `wa-webhook-core/router.ts`:
```typescript
// Route 10% traffic to wa-webhook-unified
const routeToUnified = Math.random() < 0.10;

if (routeToUnified && ['jobs', 'marketplace', 'property', 'ai_agents'].includes(intent)) {
  return 'wa-webhook-unified';
}
```

Deploy:
```bash
supabase functions deploy wa-webhook-core --no-verify-jwt
```

---

### Phase 5.2: Monitor & Metrics (Day 2-7 - Dec 12-17)
**Status**: OBSERVABILITY  
**Risk**: LOW (monitoring only)

Track metrics:
```sql
-- Traffic split
SELECT 
  service,
  COUNT(*) as requests,
  AVG(response_time_ms) as avg_latency,
  COUNT(DISTINCT user_phone) as unique_users
FROM wa_events_log
WHERE created_at > NOW() - INTERVAL '7 days'
  AND service IN ('wa-webhook-unified', 'wa-webhook-jobs', 'wa-webhook-marketplace', 'wa-webhook-property', 'wa-webhook-ai-agents')
GROUP BY service;

-- Error rates
SELECT 
  service,
  error_type,
  COUNT(*) as errors
FROM wa_errors_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY service, error_type;
```

**Success Criteria** (Week 5):
- Error rate < 0.5% on wa-webhook-unified
- Latency < 2s (p95)
- Zero session data loss
- Successful cross-domain handoffs

---

## 📅 Week 6 (Dec 18-24): 50% Traffic Migration

### Phase 6.1: Increase Traffic (Day 1 - Dec 18)
**Status**: SCALING  
**Risk**: MEDIUM (larger traffic shift)

Update router to 50%:
```typescript
const routeToUnified = Math.random() < 0.50;
```

Deploy:
```bash
supabase functions deploy wa-webhook-core --no-verify-jwt
```

---

### Phase 6.2: Performance Validation (Day 2-7 - Dec 19-24)
**Status**: LOAD TESTING  

Run load tests:
```bash
# Simulate 1000 req/min
deno run --allow-net tools/load-test-wa-webhook.ts \
  --target wa-webhook-unified \
  --duration 10m \
  --rate 1000
```

**Success Criteria** (Week 6):
- Error rate < 0.3%
- Latency < 1.5s (p95)
- Handle 1000+ req/min
- Zero critical alerts

---

## 📅 Week 7 (Dec 25-31): 100% Migration

### Phase 7.1: Full Cutover (Day 1 - Dec 25)
**Status**: FINAL MIGRATION  
**Risk**: HIGH (all traffic)

Update router to 100%:
```typescript
// All traffic to unified
if (['jobs', 'marketplace', 'property', 'ai_agents'].includes(intent)) {
  return 'wa-webhook-unified';
}
```

Deploy:
```bash
supabase functions deploy wa-webhook-core --no-verify-jwt
```

---

### Phase 7.2: Monitoring (Day 2-5 - Dec 26-29)
**Status**: CRITICAL WATCH  

24/7 monitoring for 5 days:
- Real-time error dashboard
- Latency alerts (>3s)
- Session integrity checks
- User complaint monitoring

---

### Phase 7.3: Archive Old Webhooks (Day 6 - Dec 30)
**Status**: PREPARATION  
**Risk**: LOW (local archive only)

```bash
# Move to archive
mkdir -p supabase/functions/.archive/wa-webhook-deprecated-$(date +%Y%m%d)
mv supabase/functions/wa-webhook-{jobs,marketplace,property,ai-agents} \
   supabase/functions/.archive/wa-webhook-deprecated-$(date +%Y%m%d)/
```

**Commit**:
```bash
git add supabase/functions/.archive/
git commit -m "chore: archive consolidated webhooks (jobs, marketplace, property, ai-agents)"
git push origin main
```

---

## 📅 Week 8 (Jan 1-7): Final Cleanup

### Phase 8.1: Delete Consolidated Webhooks (Day 1 - Jan 1)
**Status**: FINAL DELETION  
**Risk**: LOW (100% traffic on unified for 7 days)

**Pre-flight Checks**:
- [ ] 100% traffic on wa-webhook-unified for 7+ days
- [ ] Error rate < 0.1%
- [ ] Zero critical incidents
- [ ] Stakeholder approval

```bash
# Delete 4 consolidated webhooks
for func in wa-webhook-jobs wa-webhook-marketplace wa-webhook-property wa-webhook-ai-agents; do
  supabase functions delete $func --project-ref $SUPABASE_PROJECT_REF
done
```

**Verification**:
```bash
supabase functions list | grep -E "wa-webhook-(jobs|marketplace|property|ai-agents)"
# Should return ZERO results
```

---

### Phase 8.2: Update Documentation (Day 2 - Jan 2)
**Status**: DOCUMENTATION  

Update:
- `supabase/functions/README.md` - Remove deleted functions
- `docs/ARCHITECTURE.md` - Update webhook routing
- `CHANGELOG.md` - Document consolidation

---

### Phase 8.3: Final Verification (Day 3-7 - Jan 3-7)
**Status**: VALIDATION  

Final checks:
```bash
# Count functions
supabase functions list | wc -l
# Expected: 64 (down from 78)

# Check no orphaned references
grep -r "wa-webhook-jobs\|wa-webhook-marketplace\|wa-webhook-property\|wa-webhook-ai-agents" \
  --include="*.ts" --include="*.tsx" --include="*.sql" supabase/ src/ admin-app/
# Should only find in .archive/
```

---

## 🎯 Success Metrics

### Week 4 Targets
- ✅ 22 functions deleted from Supabase
- ✅ 0 production incidents
- ✅ All archives validated

### Week 5-6 Targets
- ✅ 50%+ traffic on wa-webhook-unified
- ✅ Error rate < 0.3%
- ✅ Latency p95 < 1.5s

### Week 7-8 Targets
- ✅ 100% traffic migrated
- ✅ 4 webhooks deleted
- ✅ Final count: 64 functions

---

## 🚨 Rollback Procedures

### If wa-webhook-unified fails (Week 5-7):
```bash
# Revert router to 0%
git revert <commit-sha>
supabase functions deploy wa-webhook-core --no-verify-jwt
```

### If need to restore deleted function:
```bash
# From archive
cp -r supabase/functions/.archive/<function-name> supabase/functions/
supabase functions deploy <function-name> --no-verify-jwt
```

---

## 📋 Execution Checklist

### Week 4 (Immediate)
- [ ] Delete 13 agent duplicates
- [ ] Delete 9 inactive functions
- [ ] Run `supabase db push`
- [ ] Verify deletions
- [ ] Git commit & push

### Week 5 (10% Traffic)
- [ ] Deploy router with 10% split
- [ ] Monitor metrics daily
- [ ] Validate error rates < 0.5%

### Week 6 (50% Traffic)
- [ ] Update router to 50%
- [ ] Run load tests
- [ ] Performance validation

### Week 7 (100% Migration)
- [ ] Full cutover to unified
- [ ] 24/7 monitoring for 5 days
- [ ] Archive old webhooks locally

### Week 8 (Final Cleanup)
- [ ] Delete 4 consolidated webhooks
- [ ] Update documentation
- [ ] Final verification: 78 → 64 functions

---

## 📞 Emergency Contacts

**If critical incident occurs**:
1. Revert to 0% unified traffic immediately
2. Check error logs: `SELECT * FROM wa_errors_log ORDER BY created_at DESC LIMIT 100`
3. Restore from archive if needed
4. Document incident in postmortem

---

**Status**: READY FOR AUTONOMOUS EXECUTION  
**Next Action**: Execute Phase 4.1 (Delete Agent Duplicates)
