# AI Agent Stack - Migration & Rollback Guide

## Overview

This document outlines deployment procedures, rollback strategies, and de-risking approaches for the AI Agent Stack.

## Pre-Deployment Checklist

### Environment Preparation

- [ ] OpenAI API key configured and tested
- [ ] Supabase project accessible with service role key
- [ ] Feature flags set to `false` for initial deployment
- [ ] Monitoring/observability endpoints configured (if enabled)
- [ ] Database schema includes `profiles` and `vouchers` tables
- [ ] WhatsApp Business API credentials configured (if using chat)
- [ ] SIP trunk credentials configured (if using voice)

### Code Validation

- [ ] All unit tests passing: `pnpm --filter @easymo/ai test`
- [ ] Build succeeds: `pnpm --filter @easymo/ai build`
- [ ] TypeScript compilation clean: `pnpm type-check`
- [ ] Linting passes: `pnpm lint`
- [ ] No secrets in client-side code (VITE_* or NEXT_PUBLIC_* vars)

## Deployment Strategy

### Phase 1: Infrastructure (Low Risk)

Deploy Supabase Edge Functions with feature flags **OFF**:

```bash
# Deploy functions
supabase functions deploy ai-lookup-customer
supabase functions deploy ai-create-voucher
supabase functions deploy ai-redeem-voucher
supabase functions deploy ai-void-voucher
supabase functions deploy ai-whatsapp-webhook
supabase functions deploy ai-realtime-webhook

# Set secrets
supabase secrets set OPENAI_API_KEY="sk-..."
supabase secrets set FEATURE_AGENT_CHAT="false"
supabase secrets set FEATURE_AGENT_VOICE="false"
supabase secrets set FEATURE_AGENT_VOUCHERS="false"
```

**Validation:**
- Functions deployed successfully
- Health checks pass (HTTP 200 responses)
- Logs show "feature disabled" messages

**Rollback:** Delete functions if needed:
```bash
supabase functions delete ai-lookup-customer
# ... repeat for each function
```

### Phase 2: Smoke Testing (Internal Only)

Enable features for internal testing only:

```bash
# Set feature flags to true
supabase secrets set FEATURE_AGENT_CHAT="true"
supabase secrets set FEATURE_AGENT_VOUCHERS="true"
supabase secrets set FEATURE_AGENT_CUSTOMER_LOOKUP="true"
```

**Test Cases:**
1. WhatsApp: Send "hello" → Expect greeting response
2. WhatsApp: Send "lookup +250788000000" → Expect customer lookup
3. WhatsApp: Send "create voucher 10000 for +250788000000" → Expect voucher creation
4. Direct API: Call `ai-lookup-customer` function → Verify response
5. Direct API: Call `ai-create-voucher` function → Verify voucher in database

**Validation:**
- All test cases pass
- Structured logs show correlation IDs
- PII masked correctly in logs
- No errors in Supabase function logs

**Rollback:** Disable features:
```bash
supabase secrets set FEATURE_AGENT_CHAT="false"
supabase secrets set FEATURE_AGENT_VOUCHERS="false"
```

### Phase 3: Limited Rollout (Beta Users)

Gradual rollout to beta users:

1. **Select 5-10 internal staff** for beta testing
2. **Monitor closely** for 24-48 hours:
   - Tool call success rates
   - Response latency
   - Error rates
   - Cost per interaction

**Metrics to Watch:**
- Tool call success rate > 95%
- P95 latency < 3 seconds
- Cost per conversation < $0.10
- Zero PII leaks in logs

**Rollback Triggers:**
- Success rate < 90%
- P95 latency > 5 seconds
- PII exposed in logs
- Cost spike > 200% of expected

### Phase 4: Production Rollout

After successful beta (minimum 7 days):

1. **Announce to users** via appropriate channels
2. **Enable for all customers** (feature flags remain ON)
3. **Monitor continuously** for first week

**Monitoring Dashboard:**
- Requests per hour
- Success/failure rates
- Top error types
- OpenAI API costs
- User satisfaction scores (if available)

## Rollback Procedures

### Quick Rollback (< 5 minutes)

**Scenario:** Critical bug or outage

```bash
# Disable all features immediately
supabase secrets set FEATURE_AGENT_CHAT="false"
supabase secrets set FEATURE_AGENT_VOICE="false"
supabase secrets set FEATURE_AGENT_VOUCHERS="false"
```

**Effect:** 
- Webhooks still receive requests but immediately return success
- No AI processing occurs
- Users revert to previous workflow

### Partial Rollback (5-10 minutes)

**Scenario:** One feature problematic, others working

```bash
# Example: Disable only voice, keep chat working
supabase secrets set FEATURE_AGENT_VOICE="false"
# FEATURE_AGENT_CHAT remains true
```

### Full Rollback (30 minutes)

**Scenario:** Major issues, need to remove all AI components

```bash
# 1. Disable features
supabase secrets set FEATURE_AGENT_CHAT="false"
supabase secrets set FEATURE_AGENT_VOICE="false"

# 2. Delete functions (optional, for complete removal)
supabase functions delete ai-lookup-customer
supabase functions delete ai-create-voucher
supabase functions delete ai-redeem-voucher
supabase functions delete ai-void-voucher
supabase functions delete ai-whatsapp-webhook
supabase functions delete ai-realtime-webhook

# 3. Remove package (if needed)
git revert <commit-sha>
pnpm install
```

## De-risking Strategies

### 1. Feature Flags

All features default to OFF. Enable gradually:
- Internal testing first
- Beta users second
- Full rollout last

### 2. Observability

Monitor everything:
- Structured logs with correlation IDs
- OpenTelemetry tracing (if enabled)
- Success/failure metrics
- Cost tracking

### 3. Rate Limiting

Implement per-customer rate limits:
```typescript
// In tool router
const rateLimit = 10; // calls per minute
const window = 60000; // 1 minute
```

### 4. Idempotency

WhatsApp messages deduplicated by message ID:
- Prevents double-processing on retries
- 1-hour cache TTL

### 5. Graceful Degradation

Errors don't crash webhooks:
- Always return HTTP 200
- Send friendly error messages to users
- Log errors for debugging

### 6. Database Safeguards

Voucher operations validate state:
- Can only redeem `issued` vouchers
- Can only void `issued` vouchers
- Ownership verified before redemption

## Monitoring & Alerts

### Key Metrics

1. **Success Rate**
   - Target: > 95%
   - Alert: < 90%

2. **Latency (P95)**
   - Target: < 3 seconds
   - Alert: > 5 seconds

3. **Error Rate**
   - Target: < 5%
   - Alert: > 10%

4. **Cost per Conversation**
   - Target: < $0.10
   - Alert: > $0.20

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Success Rate | < 95% | < 90% | Investigate immediately |
| Latency P95 | > 3s | > 5s | Check OpenAI API status |
| Error Rate | > 5% | > 10% | Review logs, consider rollback |
| Cost per Conv | > $0.10 | > $0.20 | Check token usage |

## Post-Deployment

### Day 1-7

- [ ] Monitor metrics hourly
- [ ] Review logs daily for errors
- [ ] Check cost reports daily
- [ ] Collect user feedback
- [ ] Document any issues

### Week 2-4

- [ ] Monitor metrics daily
- [ ] Review logs weekly
- [ ] Optimize based on usage patterns
- [ ] Refine prompts if needed
- [ ] Update documentation

### Month 2+

- [ ] Standard monitoring
- [ ] Quarterly cost reviews
- [ ] Evaluate new OpenAI features
- [ ] Plan enhancements

## Communication Plan

### Internal Team

- **Pre-deployment**: Email to engineering team
- **During deployment**: Slack channel for real-time updates
- **Post-deployment**: Summary report with metrics

### External Users

- **Beta users**: Direct email with instructions
- **All users**: Announcement via appropriate channel
- **Documentation**: Update help docs with AI features

## Rollback Decision Matrix

| Issue | Severity | Rollback Type | Timeline |
|-------|----------|---------------|----------|
| PII leak | Critical | Full | Immediate |
| High error rate (>50%) | Critical | Quick | < 5 min |
| Cost spike (>500%) | High | Quick | < 5 min |
| Moderate errors (10-20%) | Medium | Partial | < 30 min |
| Slow responses (>10s) | Medium | Partial | < 30 min |
| Minor bugs | Low | Fix forward | Next release |

## Emergency Contacts

- **On-call Engineer**: [Contact info]
- **Platform Lead**: [Contact info]
- **OpenAI Support**: api-support@openai.com
- **Supabase Support**: support@supabase.io

## Lessons Learned (to be updated)

Document issues encountered and resolutions:

- **Issue**: [Description]
- **Root Cause**: [Analysis]
- **Resolution**: [Fix applied]
- **Prevention**: [Future safeguards]
