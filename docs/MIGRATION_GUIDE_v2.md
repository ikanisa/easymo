# EasyMO v2.0 Migration Guide

**Version**: 2.0.0  
**Target Audience**: End Users, Administrators, Developers  
**Migration Type**: Non-breaking (backward compatible)  
**Estimated Downtime**: Zero (rolling update)

---

## 📋 Overview

This guide walks you through migrating from EasyMO v1.x to v2.0, which introduces AI-powered agents
while maintaining full backward compatibility with existing workflows.

**Key Points**:

- ✅ **No breaking changes** - All v1.x features continue to work
- ✅ **Zero downtime** - Rolling deployment with gradual rollout
- ✅ **Opt-in AI features** - Users can continue using traditional menus
- ✅ **Automatic fallback** - System gracefully degrades if AI unavailable

---

## 👥 For End Users (WhatsApp)

### What's Changing?

**Short Answer**: Nothing breaks, but you get new AI-powered shortcuts!

**Old Way (Still Works)**:

```
[System sends menu]
1. 🚖 See Drivers
2. 📅 Schedule Trip
3. 📦 My Orders

[You select option 1]
[System shows driver list]
```

**New Way (AI-Powered)**:

```
You: "I need a driver to airport"

AI: "🚖 I found 5 drivers near you heading to Kigali Airport!

     [Interactive buttons with drivers, prices, ETAs]"
```

**Both work!** Use whichever you prefer.

---

### Migration Checklist

#### ✅ No Action Required

You don't need to do anything! The system will:

- Automatically detect natural language messages
- Route to AI agents when beneficial
- Fall back to traditional menus if needed

#### 📱 Optional: Try AI Features

**To try AI agents**:

1. Just type what you need in natural language
2. Examples:
   - "Find me vegetables near me"
   - "Schedule a trip for tomorrow 9am"
   - "Check my order status"
   - "How much is delivery to Kimihurura?"

**To use traditional menus**:

1. Text "MENU" anytime
2. Or select from button options when presented

---

### Common Questions

#### Q: Will I lose my order history?

**A**: No! All your data is preserved. AI agents can access your full history.

#### Q: What if I don't like the AI agent?

**A**: Text "MENU" to switch back to traditional navigation anytime.

#### Q: Does this cost extra?

**A**: No! AI features are free. Same rates apply.

#### Q: What if the AI doesn't understand me?

**A**: The system will:

1. Ask clarifying questions
2. Offer menu-based alternatives
3. Connect you to human support if needed

#### Q: Can I use my language (Kinyarwanda/French)?

**A**: Currently English only. Kinyarwanda and French coming in v2.1 (next quarter).

#### Q: How do I know if I'm talking to AI or the menu?

**A**: AI responses are conversational and personalized. Menu responses show numbered options.

---

### Troubleshooting

| Issue               | Solution                                          |
| ------------------- | ------------------------------------------------- |
| AI not responding   | Text "MENU" to use traditional flow               |
| Session expired     | Sessions last 10 minutes. Just start a new search |
| Vendor not found    | Try "Browse Vendors" from main menu               |
| Payment failed      | Check wallet balance or try alternative payment   |
| Can't understand AI | Text "HELP" for clarifications                    |

---

## 👨‍💼 For Administrators

### Pre-Migration Checklist

#### 1. Environment Preparation

**Production Environment Variables** (add these):

```bash
# Feature Flags (start conservative)
FEATURE_AI_AGENTS=true
FEATURE_AI_AGENTS_ROLLOUT_PERCENTAGE=1  # Start at 1%
FEATURE_BUYER_AGENT=true
FEATURE_STATION_AGENT=true
FEATURE_VENDOR_AGENT=true
FEATURE_DRIVER_AGENT=true
FEATURE_ADMIN_AGENT=true
FEATURE_CUSTOMER_SUPPORT_AGENT=true
FEATURE_MARKETPLACE_AGENT=false  # Not yet active

# Observability (REQUIRED for monitoring)
ENABLE_STRUCTURED_LOGGING=true
ENABLE_METRICS=true
LOG_LEVEL=info

# Rate Limits (adjust based on load)
AGENT_MAX_RETRIES=5
AGENT_TIMEOUT_MS=30000
RATE_LIMIT_PER_USER=60  # per minute

# OpenAI (required for AI agents)
OPENAI_API_KEY=<your-key>  # Vault-managed
OPENAI_MODEL=gpt-4-turbo-2024-04-09
```

**Security Notes**:

- Store `OPENAI_API_KEY` in vault (DO NOT commit)
- Keep `SERVICE_ROLE_KEY` server-side only
- Use separate keys for staging/production

#### 2. Database Backup

**CRITICAL: Always backup before migrations!**

```bash
# Full database backup
pg_dump -h prod-db.easymo.com -U postgres easymo_prod > backup_$(date +%s).sql

# Verify backup
ls -lh backup_*.sql

# Store backup securely
aws s3 cp backup_*.sql s3://easymo-backups/v2-migration/
```

#### 3. Database Migrations

```bash
# Supabase migrations (additive only, per ground rules)
supabase db push --project-ref <prod-ref>

# Agent-Core Prisma migrations
pnpm --filter @easymo/db prisma:migrate:deploy

# Verify migrations applied
supabase db diff --schema public
```

**New Tables Created**:

- `agent_sessions` - Agent conversation state
- `agent_requests` - Request history and metrics
- `agent_metrics` - Performance tracking
- `agent_fallbacks` - Fallback event logging

**No existing tables modified** ✅

#### 4. Deploy Supabase Functions

```bash
# Deploy all edge functions
supabase functions deploy --project-ref <prod-ref>

# Verify deployment
curl https://<prod-ref>.supabase.co/functions/v1/_health

# Test specific agent
curl https://<prod-ref>.supabase.co/functions/v1/wa-webhook \
  -H "Content-Type: application/json" \
  -d '{"type": "test"}'
```

#### 5. Deploy Microservices

**Rolling Update (Zero Downtime)**:

```bash
# Deploy agent-core (central orchestration)
kubectl apply -f infrastructure/k8s/agent-core.yaml
kubectl rollout status deployment/agent-core

# Deploy ranking-service (vendor recommendations)
kubectl apply -f infrastructure/k8s/ranking-service.yaml
kubectl rollout status deployment/ranking-service

# Deploy wallet-service (payments)
kubectl apply -f infrastructure/k8s/wallet-service.yaml
kubectl rollout status deployment/wallet-service

# ... repeat for all 12 services
```

**Verify Health**:

```bash
kubectl get pods -n easymo-prod
kubectl logs -f deployment/agent-core -n easymo-prod
```

#### 6. Gradual Rollout

**Recommended Schedule** (adjust based on your risk tolerance):

| Day    | Percentage | Users     | Actions                               |
| ------ | ---------- | --------- | ------------------------------------- |
| Day 1  | 1%         | ~100      | Monitor intensively, war room standby |
| Day 2  | 5%         | ~500      | Review metrics, collect feedback      |
| Day 3  | 10%        | ~1,000    | Check error rates, adjust if needed   |
| Day 4  | 25%        | ~2,500    | Expand monitoring, train support team |
| Day 7  | 50%        | ~5,000    | Mid-rollout review, fix minor issues  |
| Day 10 | 100%       | All users | Full launch celebration! 🎉           |

**Feature Flag Control**:

```bash
# Start at 1%
export FEATURE_AI_AGENTS_ROLLOUT_PERCENTAGE=1
kubectl set env deployment/agent-core FEATURE_AI_AGENTS_ROLLOUT_PERCENTAGE=1

# After monitoring, increase to 5%
kubectl set env deployment/agent-core FEATURE_AI_AGENTS_ROLLOUT_PERCENTAGE=5

# And so on...
```

**Rollback Triggers** (immediate rollback if):

- Error rate >5%
- User complaints >10/hour
- Critical bug discovered
- Business metrics drop >10%

#### 7. Monitoring Setup

**Dashboards to Watch**:

1. **Agent Performance** (`/agents/dashboard`)
   - Request volume (per agent)
   - Success/failure rates
   - Response times (p50, p95, p99)
   - Fallback frequency

2. **Business Metrics**
   - Orders per hour
   - Conversion rates (AI vs traditional)
   - Revenue attribution
   - User satisfaction

3. **System Health**
   - Service uptime
   - Database connections
   - Redis hit rate
   - Kafka lag

**Alert Configuration** (PagerDuty/Slack):

```yaml
# Critical alerts
- name: "High Error Rate"
  condition: error_rate > 0.05
  severity: critical
  notify: on-call-engineer

- name: "Service Down"
  condition: uptime < 0.99
  severity: critical
  notify: engineering-manager

# Warning alerts
- name: "High Fallback Rate"
  condition: fallback_rate > 0.30
  severity: warning
  notify: team-channel

- name: "Slow Response Time"
  condition: p95_response_time > 2000
  severity: warning
  notify: team-channel
```

---

### Migration Day Runbook

**Timeline**: ~2 hours (including monitoring)

#### Phase 1: Pre-Deployment (15 minutes)

- [ ] Verify backup completed
- [ ] Confirm all environment variables set
- [ ] Alert on-call team
- [ ] Post in #engineering: "v2.0 deployment starting"

#### Phase 2: Database Migrations (15 minutes)

```bash
# Apply migrations
supabase db push --project-ref <prod-ref>
pnpm --filter @easymo/db prisma:migrate:deploy

# Verify
psql -h prod-db -c "SELECT COUNT(*) FROM agent_sessions;"
# Expected: 0 (new table, empty)
```

#### Phase 3: Deploy Edge Functions (10 minutes)

```bash
supabase functions deploy --project-ref <prod-ref>

# Verify
curl https://<prod-ref>.supabase.co/functions/v1/_health
# Expected: {"status": "healthy"}
```

#### Phase 4: Deploy Microservices (20 minutes)

```bash
# Rolling update
kubectl apply -f infrastructure/k8s/agent-core.yaml
kubectl rollout status deployment/agent-core

# Repeat for all services...
```

#### Phase 5: Enable Feature Flags (5 minutes)

```bash
# Start at 1% rollout
kubectl set env deployment/agent-core FEATURE_AI_AGENTS_ROLLOUT_PERCENTAGE=1
```

#### Phase 6: Smoke Tests (15 minutes)

```bash
# Run automated smoke tests
./scripts/prod-smoke-test.sh

# Manual tests
# 1. Send test WhatsApp message (internal number)
# 2. Try AI agent flow (product search)
# 3. Try traditional flow (menu navigation)
# 4. Check admin dashboard (metrics flowing)
```

#### Phase 7: Monitor (60 minutes)

- [ ] Watch error rates (<1% target)
- [ ] Monitor response times (<1s p95)
- [ ] Check fallback rate (<10%)
- [ ] Review user feedback
- [ ] Test rollback procedure (dry run)

#### Phase 8: Post-Deployment (Ongoing)

- [ ] Post in #engineering: "v2.0 deployment complete"
- [ ] Update status page
- [ ] Send notification to stakeholders
- [ ] Schedule Day 2 review meeting

---

### Rollback Procedure

**When to Rollback**:

- Error rate >5%
- Critical bug discovered
- User complaints exceed threshold
- Business metrics drop significantly

**Rollback Steps** (<10 minutes):

```bash
# Method 1: Disable feature flags (fastest)
kubectl set env deployment/agent-core FEATURE_AI_AGENTS=false

# Method 2: Reduce rollout to 0%
kubectl set env deployment/agent-core FEATURE_AI_AGENTS_ROLLOUT_PERCENTAGE=0

# Method 3: Revert deployment (if needed)
kubectl rollout undo deployment/agent-core

# Method 4: Database rollback (LAST RESORT)
psql -h prod-db < backup_<timestamp>.sql
```

**Post-Rollback**:

1. Investigate root cause
2. Fix issue in staging
3. Re-validate before retry
4. Document lessons learned

---

## 👨‍💻 For Developers

### Code Migration

#### 1. Update Dependencies

```bash
# Pull latest code
git pull origin main

# Install dependencies (pnpm ONLY)
pnpm install --frozen-lockfile

# Build shared packages FIRST (critical!)
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build

# Build all packages
pnpm build
```

#### 2. Environment Setup

**Local Development** (`.env.local`):

```bash
# Supabase (use local instance)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role>

# OpenAI (use test key or mock)
OPENAI_API_KEY=<test-key>

# Feature Flags (enable all for testing)
FEATURE_AI_AGENTS=true
FEATURE_BUYER_AGENT=true
FEATURE_STATION_AGENT=true
FEATURE_VENDOR_AGENT=true
FEATURE_DRIVER_AGENT=true
FEATURE_ADMIN_AGENT=true
FEATURE_CUSTOMER_SUPPORT_AGENT=true

# Observability (verbose for debugging)
ENABLE_STRUCTURED_LOGGING=true
ENABLE_METRICS=true
LOG_LEVEL=debug
```

#### 3. Database Schema Updates

**No manual changes needed!** Migrations are automatic.

To regenerate Prisma client:

```bash
pnpm --filter @easymo/db prisma:generate
```

#### 4. API Changes

**✅ No breaking changes!** All v1.x APIs still work.

**New APIs** (optional to adopt):

```typescript
// Agent API (new in v2.0)
POST /api/agents/buyer/search
POST /api/agents/vendor/update-menu
POST /api/agents/driver/accept-trip

// Metrics API (new in v2.0)
GET /api/agents/metrics
GET /api/agents/sessions/:sessionId
```

**Example Usage**:

```typescript
// Old way (still works)
const vendors = await fetch('/api/vendors/search', {
  method: 'POST',
  body: JSON.stringify({ query: 'vegetables', location: {...} })
});

// New way (AI-powered)
const agentResponse = await fetch('/api/agents/buyer/search', {
  method: 'POST',
  body: JSON.stringify({
    userId: '250780123456',
    query: 'I need vegetables for dinner',
    location: {...}
  })
});
// Returns AI-enhanced results with ranking
```

#### 5. Message Library (New)

**Old Way** (hardcoded strings):

```typescript
await sendText(ctx.from, "🚖 Searching for drivers...");
```

**New Way** (centralized messages):

```typescript
import { AGENT_MESSAGES } from "@shared/agent-messages";

await sendText(ctx.from, AGENT_MESSAGES.LOADING.DRIVERS);
```

**Benefits**:

- DRY (Don't Repeat Yourself)
- Consistent tone across codebase
- Easy to update all instances
- i18n-ready

**Migration Script** (optional):

```bash
# Find all hardcoded messages
grep -r "await sendText.*🚖\|😔\|✅" supabase/functions/wa-webhook/

# Migrate to use AGENT_MESSAGES
# (Manual review recommended)
```

#### 6. Observability (MANDATORY)

**Ground Rules Requirement**: All agent interactions MUST log structured events.

**Old Way** (unstructured):

```typescript
console.log("User searched for drivers");
```

**New Way** (structured, with correlation IDs):

```typescript
import { logStructuredEvent } from '../_shared/observability';

await logStructuredEvent('AGENT_REQUEST', {
  agentType: 'buyer',
  userId: ctx.from,
  sessionId: ctx.sessionId,
  requestType: 'product_search',
  metadata: { query: 'vegetables', location: {...} }
});
```

**Required for**:

- All agent requests
- Fallback triggers
- Error conditions
- Business events

#### 7. Testing Your Changes

```bash
# Unit tests
pnpm exec vitest run

# Specific test file
pnpm exec vitest run tests/agent-handlers.test.ts

# Edge function tests
pnpm test:functions

# Integration tests
./test-ai-agents.sh

# Manual testing (local Supabase)
supabase start
pnpm dev
# Visit http://localhost:8080
```

#### 8. Code Review Checklist

Before submitting PR, verify:

- [ ] All tests passing
- [ ] No hardcoded strings (use `AGENT_MESSAGES`)
- [ ] Structured logging added (where applicable)
- [ ] No secrets in code (use env vars)
- [ ] TypeScript errors resolved
- [ ] ESLint passing (2 console warnings OK)
- [ ] Ground rules followed (observability, security, feature flags)

---

### Breaking Changes

**v2.0 has ZERO breaking changes! 🎉**

All v1.x code continues to work without modification.

---

### Deprecated Features

**None in v2.0**. All v1.x features remain supported.

**Future Deprecation** (v3.0+, not before Q3 2026):

- Legacy menu-only flows (will always fallback, never removed)
- Old Supabase function signatures (gradual migration)

---

## 📊 Validation & Testing

### Pre-Production Validation

**Staging Environment Checklist**:

- [ ] Deploy to staging
- [ ] Run full regression suite (84 tests)
- [ ] Test synthetic failures (21 scenarios)
- [ ] Load test (100 concurrent users)
- [ ] Manual E2E testing (all user flows)
- [ ] Security scan
- [ ] Performance benchmarks
- [ ] QA sign-off
- [ ] Product sign-off

**Commands**:

```bash
# Full test suite
pnpm exec vitest run

# Synthetic failures
pnpm test:synthetic

# Load test
./scripts/load-test-agents.sh --concurrency 100 --duration 300

# Security scan
pnpm audit
./scripts/check-client-secrets.mjs

# Performance benchmarks
./scripts/benchmark-agents.sh
```

### Post-Production Validation

**Day 1 Checks** (hourly):

- [ ] Error rate <1%
- [ ] Response time p95 <1s
- [ ] Fallback rate <10%
- [ ] No critical bugs reported
- [ ] User complaints <5/hour

**Week 1 Checks** (daily):

- [ ] Business metrics trending up
- [ ] User satisfaction >4.5/5
- [ ] Support tickets trending down
- [ ] No major incidents

**Success Criteria** (30 days):

- [ ] Error rate sustained <1%
- [ ] 99.9% uptime achieved
- [ ] User adoption >50%
- [ ] NPS improved by 10+ points

---

## 🆘 Troubleshooting

### Common Issues

#### Issue: "Cannot find module @shared/agent-messages"

**Cause**: Shared packages not built  
**Solution**:

```bash
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
pnpm build
```

#### Issue: "SECURITY VIOLATION in .env"

**Cause**: Server secrets in client-facing env vars  
**Solution**: Remove `SERVICE_ROLE`, `ADMIN_TOKEN` from `VITE_*` or `NEXT_PUBLIC_*` vars

#### Issue: "Agent not responding"

**Cause**: Feature flag disabled or AI service down  
**Solution**:

```bash
# Check feature flags
echo $FEATURE_AI_AGENTS  # Should be "true"

# Check OpenAI connectivity
curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"

# Check agent-core logs
kubectl logs -f deployment/agent-core
```

#### Issue: "High fallback rate (>30%)"

**Cause**: AI service degraded or excessive timeouts  
**Solution**:

1. Check OpenAI status page
2. Increase `AGENT_TIMEOUT_MS` if needed
3. Scale agent-core pods
4. Review error logs for patterns

#### Issue: "Database migration failed"

**Cause**: Conflicting schema changes  
**Solution**:

```bash
# Rollback to backup
psql -h prod-db < backup_<timestamp>.sql

# Investigate conflict
supabase db diff

# Fix and re-apply
supabase db push
```

---

## 📞 Support Contacts

### During Migration

**War Room** (Day 1):  
Slack: `#v2-deployment-war-room`

**On-Call Engineer**:  
PagerDuty: `@oncall-engineer`  
Phone: +250-xxx-xxx-xxx

**Engineering Manager**:  
Email: eng-manager@easymo.com  
Slack: `@eng-manager`

### Post-Migration

**User Support**:  
Email: support@easymo.com  
WhatsApp: +250-xxx-xxx-xxx

**Technical Support**:  
Slack: `#engineering-support`  
Docs: `docs/SUPPORT_RUNBOOK.md`

**Security Issues**:  
Email: security@easymo.com  
**DO NOT** create public issues

---

## ✅ Migration Success Checklist

### Pre-Migration

- [ ] Read this guide completely
- [ ] Backup database
- [ ] Test rollback procedure
- [ ] Verify staging deployment
- [ ] Train support team
- [ ] Alert stakeholders

### Migration Day

- [ ] Apply database migrations
- [ ] Deploy edge functions
- [ ] Deploy microservices
- [ ] Enable feature flags (1%)
- [ ] Run smoke tests
- [ ] Monitor for 1 hour
- [ ] Send go-live notification

### Post-Migration (Week 1)

- [ ] Daily metrics review
- [ ] Increase rollout gradually
- [ ] Collect user feedback
- [ ] Fix minor issues
- [ ] Document lessons learned
- [ ] Celebrate success! 🎉

---

## 📚 Additional Resources

- **Release Notes**: `RELEASE_NOTES_v2.0.md`
- **Phase 5 Plan**: `docs/PHASE5_CUTOVER_READINESS.md`
- **Deployment Runbook**: `docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`
- **Engineering Runbook**: `docs/ENGINEERING_RUNBOOK.md`
- **Support Runbook**: `docs/SUPPORT_RUNBOOK.md`
- **Ground Rules**: `docs/GROUND_RULES.md` (MUST READ)

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-11  
**Status**: Production Ready  
**Next Review**: Post-launch (30 days)

---

_Questions? Contact: eng-team@easymo.com_
