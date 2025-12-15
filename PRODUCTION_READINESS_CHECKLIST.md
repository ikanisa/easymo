# Production Readiness Checklist

## 🚀 Go-Live Preparation for Mobility & Insurance

### Phase 1: Database Setup (CRITICAL - BLOCKING)

- [ ] **Apply complete schema migration**
  ```bash
  cd /Users/jeanbosco/workspace/easymo
  supabase db push --db-url "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"
  ```
  - Migration: `20251213091500_complete_mobility_schema.sql`
  - Creates: trips, profiles, location_cache, favorites, vehicles, insurance_certificates, insurance_quote_requests, ai_agent_sessions
  - Creates RPC functions: `create_trip`, `find_matches`, `haversine_distance`
  - Enables RLS policies

- [ ] **Verify tables created**
  ```bash
  PGPASSWORD=Pq0jyevTlfoa376P psql -h db.lhbowpbcpwoiparwnwgt.supabase.co -U postgres -d postgres -c "\dt"
  ```
  Expected: trips, profiles, location_cache, favorites, vehicles, insurance_certificates, insurance_quote_requests, ai_agent_sessions, menu_items, admin_contacts

- [ ] **Verify RPC functions**
  ```bash
  PGPASSWORD=Pq0jyevTlfoa376P psql -h db.lhbowpbcpwoiparwnwgt.supabase.co -U postgres -d postgres -c "\df find_matches"
  PGPASSWORD=Pq0jyevTlfoa376P psql -h db.lhbowpbcpwoiparwnwgt.supabase.co -U postgres -d postgres -c "\df create_trip"
  ```

### Phase 2: Code Quality Fixes (HIGH PRIORITY)

- [ ] **Remove console.log statements**
  ```bash
  # Dry run first
  node scripts/fix-console-logs.mjs --dry-run
  
  # Apply fixes
  node scripts/fix-console-logs.mjs
  ```
  Target: 181 console.log statements in wa-webhook-mobility

- [ ] **Verify structured logging**
  ```bash
  grep -r "console\." supabase/functions/wa-webhook-mobility --include="*.ts" | grep -v test | wc -l
  ```
  Expected: 0 (or only in DEBUG blocks)

- [ ] **Run TypeScript type checking**
  ```bash
  cd supabase/functions/wa-webhook-mobility
  deno check index.ts
  ```

### Phase 3: Configuration & Environment

- [ ] **Verify environment variables set**
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY` (for AI features)
  - `WA_VERIFY_TOKEN` (WhatsApp webhook verification)
  - `WA_PHONE_NUMBER_ID`
  - `WA_ACCESS_TOKEN`

- [ ] **Check no secrets in client vars**
  ```bash
  grep -E "VITE_|NEXT_PUBLIC_" .env* | grep -E "SERVICE_ROLE|ADMIN_TOKEN"
  ```
  Expected: No matches

- [ ] **Rate limiting configured**
  - Mobility: 100 req/min (high volume WhatsApp)
  - Insurance: 30 req/min
  - Buy/Sell: 50 req/min

### Phase 4: Security Audit

- [ ] **RLS policies enabled on all tables**
  ```sql
  SELECT tablename, rowsecurity 
  FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename IN ('trips', 'profiles', 'insurance_certificates');
  ```
  Expected: All true

- [ ] **Webhook signature verification active**
  - File: `supabase/functions/_shared/webhook-utils.ts`
  - Used in: wa-webhook-mobility/index.ts, wa-webhook-core/index.ts

- [ ] **No exposed secrets in codebase**
  ```bash
  git secrets --scan
  # OR
  grep -r "eyJ[A-Za-z0-9_-]" supabase/functions --include="*.ts" | grep -v test
  ```

### Phase 5: Testing

- [ ] **Run production readiness test suite**
  ```bash
  node scripts/production-readiness-test.mjs
  ```
  Expected: 0 critical issues

- [ ] **Run unit tests**
  ```bash
  cd supabase/functions/wa-webhook-mobility
  deno test --allow-all
  ```
  Expected: All pass

- [ ] **Manual E2E test - Mobility**
  1. Send WhatsApp message to bot
  2. Request nearby drivers/passengers
  3. Share location
  4. View matches
  5. Verify phone number exchange works
  
- [ ] **Manual E2E test - Insurance**
  1. Send WhatsApp message to insurance option
  2. Verify contact info displayed
  3. Check admin notification sent

### Phase 6: Monitoring & Observability

- [ ] **Structured logging active**
  - All events use `logStructuredEvent()`
  - Correlation IDs present in all webhook calls
  - PII scrubbing enabled

- [ ] **Sentry configured**
  - `SENTRY_DSN_SUPABASE` env var set
  - Error tracking active
  - Release tracking enabled

- [ ] **PostHog configured (optional)**
  - `POSTHOG_API_KEY` env var set
  - Event tracking active

### Phase 7: Performance

- [ ] **Database indexes created**
  - trips: pickup_coords, status, expires_at, user_id
  - profiles: user_id, wa_id, phone_number
  - All verified with `\d+ trips` in psql

- [ ] **Edge function cold start < 2s**
  ```bash
  curl -X POST https://PROJECT.supabase.co/functions/v1/wa-webhook-mobility/health
  ```

- [ ] **Trip matching query < 500ms**
  ```sql
  EXPLAIN ANALYZE SELECT * FROM find_matches('test-trip-id'::uuid, 9);
  ```

### Phase 8: Documentation

- [ ] **README.md updated**
  - wa-webhook-mobility/README.md
  - wa-webhook-core/README.md

- [ ] **API endpoints documented**
  - Health check endpoints
  - Webhook endpoints
  - RPC function signatures

- [ ] **Deployment process documented**
  - Environment setup
  - Migration process
  - Rollback procedure

### Phase 9: Deployment

- [ ] **Deploy to staging first**
  ```bash
  supabase functions deploy wa-webhook-mobility --project-ref STAGING_REF
  supabase functions deploy wa-webhook-core --project-ref STAGING_REF
  ```

- [ ] **Smoke test staging**
  - Health checks pass
  - Sample webhook delivery works
  - Database queries successful

- [ ] **Deploy to production**
  ```bash
  supabase functions deploy wa-webhook-mobility --project-ref PROD_REF
  supabase functions deploy wa-webhook-core --project-ref PROD_REF
  ```

- [ ] **Verify production deployment**
  - Health checks pass
  - Webhook verification works
  - First real message processed successfully

### Phase 10: Post-Deployment Monitoring

- [ ] **Monitor error rates (first 1 hour)**
  - Target: < 1% error rate
  - Check Sentry dashboard

- [ ] **Monitor response times**
  - p50 < 200ms
  - p95 < 1000ms
  - p99 < 2000ms

- [ ] **Monitor database performance**
  - Query times < 500ms
  - No connection pool exhaustion
  - RLS not causing slowdowns

- [ ] **User feedback collection**
  - First 10 user interactions logged
  - Any UX issues reported
  - Success rate > 80%

## 🚨 Rollback Plan

If critical issues arise:

1. **Immediate**: Disable edge functions
   ```bash
   # Update function to return maintenance message
   ```

2. **Database**: Rollback migration if needed
   ```bash
   # Restore from backup (before schema change)
   ```

3. **Communication**: Notify users via WhatsApp broadcast
   "Service temporarily unavailable. We're working to fix it."

## ✅ Sign-Off

- [ ] **Tech Lead Review**: _______________
- [ ] **QA Sign-off**: _______________
- [ ] **Security Review**: _______________
- [ ] **Product Owner Approval**: _______________

**Go-Live Date**: _______________  
**Time**: _______________  
**Rollback Window**: 24 hours

---

## Quick Commands Reference

```bash
# Apply complete schema
cd /Users/jeanbosco/workspace/easymo
supabase db push --db-url "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

# Fix console.logs
node scripts/fix-console-logs.mjs

# Run readiness tests
node scripts/production-readiness-test.mjs

# Type check
cd supabase/functions/wa-webhook-mobility && deno check index.ts

# Run tests
cd supabase/functions/wa-webhook-mobility && deno test --allow-all

# Deploy
supabase functions deploy wa-webhook-mobility
supabase functions deploy wa-webhook-core
```
