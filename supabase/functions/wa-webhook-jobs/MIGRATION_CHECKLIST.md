# WA-Webhook-Jobs Migration Checklist

## ✅ Pre-Deployment

- [x] All files copied from wa-webhook/domains/jobs/
- [x] Imports updated to use relative paths (../_shared/)
- [x] Health check working - verifies all job tables
- [x] Unit tests implemented for intent detection and i18n
- [ ] Integration tests passing
- [ ] Load tested (100 req/s)

## 🚀 Deployment

- [ ] Deploy to staging
- [ ] Test in staging environment
- [ ] Feature flag: Route 10% traffic
- [ ] Monitor metrics (10 minutes)
- [ ] Increase to 50% traffic
- [ ] Monitor metrics (10 minutes)
- [ ] Increase to 100% traffic
- [ ] Monitor for 1 hour

## 📊 Validation

- [ ] Cold start < 2s ✅
- [ ] Memory usage < 128MB ✅
- [ ] Error rate < 0.5% ✅
- [ ] No user complaints ✅
- [ ] Metrics looking good ✅

## 🧹 Cleanup

- [ ] Archive old jobs code in wa-webhook
- [ ] Update routing in wa-webhook-core
- [ ] Update documentation
- [ ] Announce to team

## 🚨 Rollback Plan

If issues occur:
1. Set feature flag to 0% (immediate)
2. Monitor for 5 minutes
3. Investigate logs
4. Fix and redeploy, or
5. Keep at 0% and debug offline

## 📈 Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Cold Start | <2s | ___ |
| Memory | <128MB | ___ |
| p95 Latency | <300ms | ___ |
| Error Rate | <0.5% | ___ |
| Throughput | 100 req/s | ___ |

## 📝 Implementation Notes

### Entry Point Consolidation
- Single `index.ts` now integrates handlers, health checks, and webhook verification
- Removed dependency on non-existent npm packages (@easymo/wa-webhook-shared)
- Uses relative imports to `../_shared/` directory

### Database Schema
- Uses `posted_by` (phone number) for job_listings queries
- Uses `seeker_id` (UUID) for job_applications queries  
- Uses `phone_number` for job_seekers lookups

### Features Implemented
- WhatsApp webhook verification (GET request)
- Health check endpoint with multi-table verification
- Job board menu with WhatsApp list messages
- Intent detection for intelligent routing
- My Applications and My Jobs queries
- AI agent routing for complex queries
- Multi-language support (en, fr, rw)
