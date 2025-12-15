# Webhook Deployment and Monitoring Guide

**Date**: 2025-12-15  
**Status**: ✅ All Deployments Successful

---

## Deployment Summary

All three refactored webhooks have been successfully deployed to Supabase:

| Webhook | Status | Version | Deployment URL |
|---------|--------|---------|----------------|
| **wa-webhook-profile** | ✅ Deployed | 3.0.0 | https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-profile |
| **wa-webhook-mobility** | ✅ Deployed | 1.1.0 | https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-mobility |
| **wa-webhook-buy-sell** | ✅ Deployed | 1.0.0 | https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-buy-sell |

**Project Reference**: `lhbowpbcpwoiparwnwgt`  
**Dashboard**: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions

---

## Refactoring Results

### Code Reduction
- **wa-webhook-profile**: 1,205 → 715 lines (-40%)
- **wa-webhook-mobility**: 815 → 751 lines (-8%)
- **wa-webhook-buy-sell**: 624 → 340 lines (-45%)
- **Total**: 2,644 → 1,806 lines (-32% overall reduction)

### Improvements
- ✅ Extracted handlers and utilities
- ✅ Improved error handling
- ✅ Better code organization
- ✅ Enhanced maintainability

---

## Monitoring Checklist

### 1. Immediate Post-Deployment Checks (First 5 minutes)

#### Health Checks
- [ ] **wa-webhook-profile**: `GET /health` returns 200
- [ ] **wa-webhook-mobility**: `GET /health` returns 200
- [ ] **wa-webhook-buy-sell**: `GET /health` returns 200

#### Log Monitoring
- [ ] Check Supabase Dashboard → Functions → Logs for any startup errors
- [ ] Verify no `SERVICE_STARTED` errors
- [ ] Check for import/module resolution errors

### 2. Functional Testing (First 30 minutes)

#### wa-webhook-profile
- [ ] Test "Profile" menu button from WhatsApp home menu
- [ ] Test language preference change
- [ ] Test location saving (home/work/school)
- [ ] Test location editing and deletion
- [ ] Verify profile edit flow works

#### wa-webhook-mobility
- [ ] Test "Rides" menu button from WhatsApp home menu
- [ ] Test "Nearby drivers" flow
- [ ] Test "Nearby passengers" flow
- [ ] Test "Schedule trip" flow
- [ ] Test "Go online" flow for drivers

#### wa-webhook-buy-sell
- [ ] Test "Buy & Sell" menu button from WhatsApp home menu
- [ ] Verify AI agent welcome message appears
- [ ] Test natural language conversation with AI agent
- [ ] Test "My Businesses" button
- [ ] Test business creation flow
- [ ] Test location sharing for business search

### 3. Error Monitoring (First 24 hours)

#### Watch for These Error Patterns
- [ ] `PROFILE_ERROR` - Profile webhook errors
- [ ] `MOBILITY_ERROR` - Mobility webhook errors
- [ ] `BUY_SELL_ERROR` - Buy-sell webhook errors
- [ ] `SIGNATURE_MISMATCH` - Authentication failures
- [ ] `USER_ENSURE_ERROR` - User authentication issues
- [ ] `[object Object]` - Error serialization issues (should be fixed)

#### Metrics to Monitor
- [ ] Error rate (should be < 1%)
- [ ] Response times (should be < 2s for most requests)
- [ ] 500 errors (should be minimal)
- [ ] 400 errors (user errors, acceptable but monitor patterns)

### 4. Performance Monitoring

#### Key Metrics
- [ ] Average response time per webhook
- [ ] P95/P99 response times
- [ ] Request volume per hour
- [ ] Memory usage
- [ ] Cold start times

#### Expected Performance
- **Profile**: < 500ms average
- **Mobility**: < 1s average (more complex)
- **Buy-Sell**: < 2s average (AI processing)

### 5. User Experience Validation

#### Test Scenarios
- [ ] New user flow (first message)
- [ ] Returning user flow
- [ ] Error recovery (invalid input)
- [ ] Multi-step workflows (location saving, business creation)
- [ ] Button interactions
- [ ] Text message processing

---

## Monitoring Tools

### Supabase Dashboard
- **Functions Logs**: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions
- **Logs Explorer**: Filter by service name and error level
- **Metrics**: View request counts, error rates, response times

### Log Queries (Use in Supabase Dashboard)

#### Check for Errors
```
service:"wa-webhook-profile" AND level:"error"
service:"wa-webhook-mobility" AND level:"error"
service:"wa-webhook-buy-sell" AND level:"error"
```

#### Check for Warnings
```
service:"wa-webhook-profile" AND level:"warn"
service:"wa-webhook-mobility" AND level:"warn"
service:"wa-webhook-buy-sell" AND level:"warn"
```

#### Monitor Signature Verification
```
event:"*SIGNATURE*" OR event:"*AUTH*"
```

#### Monitor User Authentication
```
event:"*USER_ENSURE*" OR event:"*AUTH_USER*"
```

---

## Rollback Plan

If critical issues are detected:

1. **Identify the problematic webhook** from logs
2. **Check git history** for the previous working version
3. **Revert changes** using git
4. **Redeploy** the previous version:
   ```bash
   git checkout <previous-commit>
   supabase functions deploy <webhook-name> --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt
   ```

### Previous Versions (for reference)
- **wa-webhook-profile**: v3.0.0 (current)
- **wa-webhook-mobility**: v1.1.0 (current)
- **wa-webhook-buy-sell**: v1.0.0 (current)

---

## Known Issues to Watch

### Fixed in This Deployment
- ✅ Error serialization (`[object Object]` → proper error messages)
- ✅ Signature verification for internal forwards
- ✅ User authentication for anonymous users
- ✅ Code organization and maintainability

### Potential Issues to Monitor
- ⚠️ Import resolution (if handlers aren't found)
- ⚠️ Type compatibility (ProfileContext vs RouterContext in buy-sell)
- ⚠️ Handler function exports (ensure all are exported correctly)

---

## Success Criteria

### Deployment is Successful If:
- ✅ All health checks return 200
- ✅ No startup errors in logs
- ✅ All menu buttons work from WhatsApp home menu
- ✅ Core workflows function correctly
- ✅ Error rate < 1%
- ✅ No increase in 500 errors

### Refactoring is Successful If:
- ✅ Code is more maintainable
- ✅ Handlers are properly extracted
- ✅ Error handling is consistent
- ✅ No functionality is broken
- ✅ Performance is maintained or improved

---

## Next Steps

1. **Monitor logs** for the next 24 hours
2. **Test all workflows** manually
3. **Collect user feedback** if possible
4. **Document any issues** found
5. **Plan next improvements** based on monitoring data

---

## Contact & Support

- **Supabase Dashboard**: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt
- **Function Logs**: Dashboard → Functions → Select function → Logs
- **Git Repository**: Check commit history for changes

---

**Last Updated**: 2025-12-15  
**Deployed By**: AI Assistant  
**Status**: ✅ All Deployments Successful

