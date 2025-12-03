# Functions Deletion List - Complete Inventory

## ✅ Phase 1: COMPLETED (Archived Locally)

### Agent Duplicates (13) - `.archive/agent-duplicates-20251203/`
**Status**: Moved to archive, ready for Supabase deletion

1. agent-chat
2. agent-config-invalidator
3. agent-monitor
4. agent-negotiation
5. agent-property-rental
6. agent-quincaillerie
7. agent-runner
8. agent-schedule-trip
9. agent-shops
10. agent-tools-general-broker
11. agents
12. job-board-ai-agent
13. waiter-ai-agent

**Delete Command**:
```bash
for func in agent-chat agent-config-invalidator agent-monitor agent-negotiation \
            agent-property-rental agent-quincaillerie agent-runner agent-schedule-trip \
            agent-shops agent-tools-general-broker agents job-board-ai-agent waiter-ai-agent; do
  supabase functions delete $func --project-ref $SUPABASE_PROJECT_REF
done
```

---

### Inactive Functions (9) - `.archive/inactive-functions-20251203/`
**Status**: Moved to archive, ready for Supabase deletion

1. admin-subscriptions
2. campaign-dispatch
3. cart-reminder
4. flow-exchange
5. flow-exchange-mock
6. housekeeping
7. order-pending-reminder
8. simulator
9. wa-webhook-diag

**Delete Command**:
```bash
for func in admin-subscriptions campaign-dispatch cart-reminder flow-exchange \
            flow-exchange-mock housekeeping order-pending-reminder simulator wa-webhook-diag; do
  supabase functions delete $func --project-ref $SUPABASE_PROJECT_REF
done
```

---

## 🔄 Phase 2: TO DELETE (Week 8 - After Traffic Migration)

### WA-Webhook Consolidation (4)
**Status**: Active, will be consolidated into wa-webhook-unified

1. **wa-webhook-jobs** (614 lines, 20KB)
   - Current version: 477
   - Last deploy: Dec 2, 2025
   - Target: Merge into wa-webhook-unified
   - Delete after: Week 7 (100% traffic migrated)

2. **wa-webhook-marketplace** (715 lines, 23KB)
   - Current version: 314
   - Last deploy: Dec 2, 2025
   - Target: Merge into wa-webhook-unified
   - Delete after: Week 7 (100% traffic migrated)

3. **wa-webhook-property** (525 lines, 16KB)
   - Current version: 429
   - Last deploy: Dec 1, 2025
   - Target: Merge into wa-webhook-unified
   - Delete after: Week 7 (100% traffic migrated)

4. **wa-webhook-ai-agents** (241 lines, 7.8KB)
   - Current version: 530
   - Last deploy: Dec 2, 2025
   - Target: Merge into wa-webhook-unified
   - Delete after: Week 7 (100% traffic migrated)

**Week 7 Archive Command**:
```bash
# Archive locally first
mkdir -p .archive/wa-webhook-deprecated-$(date +%Y%m%d)
mv supabase/functions/wa-webhook-jobs .archive/wa-webhook-deprecated-$(date +%Y%m%d)/
mv supabase/functions/wa-webhook-marketplace .archive/wa-webhook-deprecated-$(date +%Y%m%d)/
mv supabase/functions/wa-webhook-property .archive/wa-webhook-deprecated-$(date +%Y%m%d)/
mv supabase/functions/wa-webhook-ai-agents .archive/wa-webhook-deprecated-$(date +%Y%m%d)/
```

**Week 8 Delete Command** (after 7-day validation):
```bash
for func in wa-webhook-jobs wa-webhook-marketplace wa-webhook-property wa-webhook-ai-agents; do
  supabase functions delete $func --project-ref $SUPABASE_PROJECT_REF
done
```

---

## ⚠️ DO NOT DELETE (Protected)

### Production-Critical Functions
**Status**: LIVE with real traffic, additive changes only

1. **wa-webhook-mobility** (585 lines, 23KB)
   - Version: 492
   - Protection: Production traffic
   - Notes: Active mobility booking system

2. **wa-webhook-profile** (1142 lines, 47KB)
   - Version: 294
   - Protection: Production traffic
   - Notes: User profile management

3. **wa-webhook-insurance** (398 lines, 13KB)
   - Version: 342
   - Protection: Production traffic
   - Notes: Insurance workflow handler

### Core Infrastructure
**Status**: Essential for operations

4. **wa-webhook-core** (248 lines, 9.1KB)
   - Version: 598
   - Role: Base webhook handler
   - Protection: Core infrastructure

5. **wa-webhook-unified** (364 lines, 12KB)
   - Version: 209
   - Role: Consolidation target
   - Protection: Phase 2 destination

6. **wa-webhook** (120 lines, 5KB)
   - Version: 264
   - Role: Legacy router
   - Protection: Fallback handler

7. **wa-webhook-wallet** (195 lines)
   - Version: 195
   - Role: Wallet operations
   - Protection: Active financial transactions

---

## Summary Statistics

| Category | Count | Status |
|----------|-------|--------|
| **Agent Duplicates** | 13 | ✅ Archived, to delete |
| **Inactive Functions** | 9 | ✅ Archived, to delete |
| **WA-Webhook Consolidation** | 4 | 🔄 Week 8 after migration |
| **Protected (Production)** | 3 | 🚨 NEVER DELETE |
| **Protected (Infrastructure)** | 4 | ✅ Keep |
| **TOTAL TO DELETE** | **26** | Phased approach |

---

## Deletion Timeline

- **Week 4 (Dec 4-10)**: Delete 22 archived functions (13 agents + 9 inactive)
- **Week 5 (Dec 11-17)**: 10% traffic migration (no deletions)
- **Week 6 (Dec 18-24)**: 50% traffic migration (no deletions)
- **Week 7 (Dec 25-31)**: 100% migration, archive 4 webhooks
- **Week 8 (Jan 1-7)**: Delete 4 consolidated webhooks

**Total Reduction**: 78 → 64 functions (-18%)

---

## Verification Commands

### Check function exists
```bash
supabase functions list | grep function-name
```

### Check for code references
```bash
grep -r "function-name" --include="*.ts" --include="*.tsx" --include="*.sql" .
```

### Verify deployment
```bash
supabase functions list --project-ref $SUPABASE_PROJECT_REF
```

### Rollback deletion (restore from archive)
```bash
cp -r .archive/function-name supabase/functions/
supabase functions deploy function-name --no-verify-jwt
```

---

**Last Updated**: December 3, 2025
**Consolidation Plan**: See `SUPABASE_FUNCTIONS_CONSOLIDATION_PLAN_FINAL.md`
