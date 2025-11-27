# Mobility Webhook - Quick Reference Card

**Service**: `wa-webhook-mobility` | **Status**: 🟡 50% Ready | **Target**: 85% in 6 weeks

---

## 🚨 Critical Actions (Do These First)

```bash
# 1. Remove duplicate code (saves 230KB)
./execute-mobility-phase1-cleanup.sh

# 2. Deploy database schema
supabase db push supabase/migrations/YYYYMMDD_mobility_core_tables.sql

# 3. Run existing tests
cd supabase/functions/wa-webhook-mobility
deno test --allow-all

# 4. Deploy function
supabase functions deploy wa-webhook-mobility
```

---

## 📊 Quick Stats

| Metric | Value |
|--------|-------|
| Total Code | 200KB+ |
| Files | 50+ |
| Largest File | schedule.ts (41.2KB) |
| Duplicate Code | ~150KB (DELETE!) |
| Test Coverage | 30% → **Target: 80%** |
| Production Ready | 50% → **Target: 85%** |

---

## 🔴 Top 3 Blockers

### 1. Code Duplication (~150KB)
- **handlers/** ←→ **mobility/** (identical files)
- **Fix**: `./execute-mobility-phase1-cleanup.sh`
- **Time**: 1 day
- **Risk**: Low

### 2. Missing Trip Lifecycle
- No start/complete/cancel flows
- No payment integration
- No rating system
- **Fix**: Implement `handlers/trip_lifecycle.ts`
- **Time**: 2 weeks
- **Risk**: Medium

### 3. Test Coverage (30%)
- nearby.ts (28KB) - NO TESTS ❌
- schedule.ts (41KB) - NO TESTS ❌
- **Fix**: Test suite templates in plan
- **Time**: 2 weeks
- **Risk**: Low

---

## 📂 File Structure

```
wa-webhook-mobility/
├── index.ts (16KB)          ✅ Main entry, routing
├── handlers/                ✅ KEEP THIS
│   ├── nearby.ts (28KB)     ✅ Driver/passenger matching
│   ├── schedule.ts (41KB)   ✅ Trip scheduling
│   ├── go_online.ts (5KB)   ✅ Driver status
│   └── ... (12 more)
├── mobility/                ❌ DELETE (duplicates)
├── flows/                   ✅ Conversation flows
├── state/                   ✅ State management
├── wa/                      ✅ WhatsApp client
├── utils/                   ✅ Helpers
├── i18n/                    ✅ Translations
└── observe/                 ✅ Logging
```

---

## 🗄️ Database Tables Needed

**Priority 1** (Deploy this week):
```sql
driver_status          -- Online drivers & location
mobility_matches       -- Trip matching
scheduled_trips        -- Future bookings
driver_insurance       -- Insurance certs
```

**Priority 2** (Week 2):
```sql
saved_locations        -- Favorite places
trip_ratings          -- Driver/passenger ratings
location_cache        -- Temp location storage
```

**Migration**: See `MOBILITY_WEBHOOK_PRODUCTION_READINESS_PLAN.md` Section 1.2

---

## 🔄 State Machine (Core Flow)

```
home
  ├─→ SEE_DRIVERS → mobility_nearby_select → mobility_nearby_location → results
  ├─→ SCHEDULE_TRIP → schedule_role → schedule_vehicle → schedule_location → ...
  └─→ GO_ONLINE → go_online_prompt → update status
  
MISSING: Trip Start → In Progress → Complete → Payment → Rating
```

---

## ✅ What Works

- ✅ Webhook verification (HMAC)
- ✅ Driver/passenger matching
- ✅ Trip scheduling
- ✅ Insurance validation
- ✅ Location services
- ✅ State management
- ✅ i18n support
- ✅ Structured logging

---

## ❌ What's Missing

- ❌ Trip lifecycle (start, track, complete)
- ❌ Real-time tracking
- ❌ Payment integration
- ❌ Rating system
- ❌ Trip history
- ❌ Comprehensive tests
- ❌ Driver verification (beyond insurance)

---

## 📅 6-Week Timeline

| Week | Goal | Deliverable |
|------|------|-------------|
| 1-2 | Stabilization | Remove duplicates, add tests → **65% ready** |
| 2-3 | Trip Lifecycle | Start/complete/cancel flows → **75% ready** |
| 3-4 | Payment | Fare calc, MoMo integration → **80% ready** |
| 4-5 | Features | Rating, verification → **85% ready** |
| 5-6 | Testing | Integration tests, monitoring → **90% ready** ✅ |

---

## 🧪 Testing Strategy

**Current**:
```
✅ intent_cache.test.ts (~80% coverage)
✅ location_cache.test.ts (~80% coverage)
❌ nearby.ts - NO TESTS (28KB!)
❌ schedule.ts - NO TESTS (41KB!)
```

**Target**:
- Unit tests for all handlers
- Integration tests for complete flows
- 80%+ overall coverage

**Templates**: See `MOBILITY_WEBHOOK_PRODUCTION_READINESS_PLAN.md` Section 1.3

---

## 🔧 Common Commands

```bash
# Development
cd supabase/functions/wa-webhook-mobility
deno run --allow-all index.ts

# Test
deno test --allow-all
deno test --allow-all handlers/nearby.test.ts

# Build
deno cache --lock=deno.lock deps.ts

# Deploy
supabase functions deploy wa-webhook-mobility

# Logs
supabase functions logs wa-webhook-mobility --tail

# Health Check
curl https://PROJECT.supabase.co/functions/v1/wa-webhook-mobility/health
```

---

## 🐛 Troubleshooting

**Build fails**:
```bash
# Rebuild lock file
deno cache --reload --lock=deno.lock --lock-write deps.ts
```

**Tests fail**:
```bash
# Check for missing tables
psql $DATABASE_URL -c "\dt *driver_status*"
psql $DATABASE_URL -c "\dt *mobility_matches*"
```

**Webhook not responding**:
```bash
# Check signature verification
# Set WA_ALLOW_UNSIGNED_WEBHOOKS=true for testing
```

---

## 📚 Documentation

1. **Implementation Plan**: `MOBILITY_WEBHOOK_PRODUCTION_READINESS_PLAN.md`
2. **Executive Summary**: `MOBILITY_WEBHOOK_AUDIT_SUMMARY.md`
3. **Architecture Diagram**: `MOBILITY_WEBHOOK_ARCHITECTURE_VISUAL.txt`
4. **Cleanup Script**: `execute-mobility-phase1-cleanup.sh`
5. **Ground Rules**: `docs/GROUND_RULES.md`

---

## 🚀 Execute Phase 1 Now

```bash
# Backup is automatic
./execute-mobility-phase1-cleanup.sh

# Review changes
git diff supabase/functions/wa-webhook-mobility/

# Commit
git add .
git commit -m "refactor(mobility): remove 230KB duplicate code

- Remove mobility/ directory (~150KB)
- Remove .bak files (~80KB)
- Consolidate handlers
- Refs: MOBILITY_WEBHOOK_PRODUCTION_READINESS_PLAN.md"

# Deploy
supabase functions deploy wa-webhook-mobility
```

---

## 🎯 Success Criteria

- [ ] No duplicate code (0KB duplication)
- [ ] 80%+ test coverage
- [ ] Complete trip lifecycle
- [ ] Payment integration working
- [ ] 90%+ trip completion rate
- [ ] 95%+ payment success rate
- [ ] <30s average match time

---

**Last Updated**: 2025-11-25  
**Next Review**: End of Week 1  
**Status**: ✅ Ready for Phase 1 execution
