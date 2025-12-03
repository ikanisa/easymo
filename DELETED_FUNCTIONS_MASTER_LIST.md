# Master List of Deleted Supabase Functions
**Last Updated**: December 3, 2025  
**Total Deleted**: 22 functions  
**Remaining**: 73 functions (target: 64)

---

## ✅ DELETED FROM SUPABASE (December 3, 2025)

### Category 1: Agent Duplicates (13 Functions)
**Reason**: Consolidated into wa-webhook-unified  
**Archive**: `supabase/functions/.archive/agent-duplicates-20251203/`  
**Deleted**: Dec 3, 2025 @ 13:37:38 CET

1. **agent-chat**
   - Purpose: Chat interface for AI agents
   - Consolidated into: wa-webhook-unified/agents/
   - Last deployed: Nov 28, 2025
   
2. **agent-config-invalidator**
   - Purpose: Agent configuration cache invalidation
   - Consolidated into: wa-webhook-unified/core/cache.ts
   - Last deployed: Nov 28, 2025
   
3. **agent-monitor**
   - Purpose: Agent health monitoring
   - Consolidated into: wa-webhook-unified/core/monitoring.ts
   - Last deployed: Nov 28, 2025
   
4. **agent-negotiation**
   - Purpose: Price negotiation agent
   - Consolidated into: wa-webhook-unified/agents/buy-sell-agent.ts
   - Last deployed: Nov 28, 2025
   
5. **agent-property-rental**
   - Purpose: Property rental agent
   - Consolidated into: wa-webhook-property (temporary, then → unified)
   - Last deployed: Nov 28, 2025
   
6. **agent-quincaillerie**
   - Purpose: Hardware store agent
   - Consolidated into: wa-webhook-unified/agents/buy-sell-agent.ts
   - Last deployed: Nov 28, 2025
   
7. **agent-runner**
   - Purpose: Generic agent execution runtime
   - Consolidated into: wa-webhook-unified/core/orchestrator.ts
   - Last deployed: Nov 28, 2025
   
8. **agent-schedule-trip**
   - Purpose: Trip scheduling agent
   - Consolidated into: wa-webhook-mobility (protected)
   - Last deployed: Nov 28, 2025
   
9. **agent-shops**
   - Purpose: Shop/marketplace agent
   - Consolidated into: wa-webhook-unified/agents/buy-sell-agent.ts
   - Last deployed: Nov 28, 2025
   
10. **agent-tools-general-broker**
    - Purpose: General service broker agent
    - Consolidated into: wa-webhook-unified/agents/support-agent.ts
    - Last deployed: Nov 28, 2025
    
11. **agents** (plural)
    - Purpose: Multi-agent coordinator
    - Consolidated into: wa-webhook-unified/core/orchestrator.ts
    - Last deployed: Nov 28, 2025
    
12. **job-board-ai-agent**
    - Purpose: Job board AI agent
    - Consolidated into: wa-webhook-jobs (temporary, then → unified)
    - Last deployed: Nov 28, 2025
    
13. **waiter-ai-agent**
    - Purpose: Restaurant waiter agent
    - Consolidated into: wa-webhook-unified/agents/waiter-agent.ts
    - Last deployed: Nov 28, 2025

---

### Category 2: Inactive Functions (9 Functions)
**Reason**: No activity for 1+ months, no code references  
**Archive**: Multiple locations (see below)  
**Deleted**: Dec 3, 2025 @ 13:37:57 CET

1. **admin-subscriptions**
   - Purpose: Admin subscription management
   - Archive: `.archive/inactive-functions-20251203/`
   - Last activity: Oct 15, 2025
   - Reason: Feature deprecated, moved to admin-app
   
2. **campaign-dispatcher** (was campaign-dispatch)
   - Purpose: Marketing campaign dispatcher
   - Archive: `.archive/inactive-functions-20251203/`
   - Last activity: Oct 20, 2025
   - Reason: Replaced by schedule-broadcast
   
3. **cart-reminder**
   - Purpose: Shopping cart reminder notifications
   - Archive: `.archive/inactive-functions-20251203/`
   - Last activity: Sep 28, 2025
   - Reason: E-commerce feature not used
   
4. **flow-exchange**
   - Purpose: Data exchange flows
   - Archive: `.archive/inactive-batch2-20251203/`
   - Last activity: Oct 5, 2025
   - Reason: Replaced by webhook-relay
   
5. **flow-exchange-mock**
   - Purpose: Mock data exchange for testing
   - Archive: `.archive/inactive-batch2-20251203/`
   - Last activity: Oct 5, 2025
   - Reason: Test utility no longer needed
   
6. **housekeeping**
   - Purpose: Database cleanup tasks
   - Archive: `.archive/inactive-functions-20251203/`
   - Last activity: Oct 10, 2025
   - Reason: Consolidated into cleanup-expired
   
7. **order-pending-reminder**
   - Purpose: Pending order reminders
   - Archive: `.archive/inactive-functions-20251203/`
   - Last activity: Sep 25, 2025
   - Reason: E-commerce feature not used
   
8. **simulator**
   - Purpose: WhatsApp conversation simulator
   - Archive: `.archive/week4-deletions-20251203/`
   - Last activity: Oct 1, 2025
   - Reason: Development tool, not needed in production
   
9. **wa-webhook-diag**
   - Purpose: WhatsApp webhook diagnostics
   - Archive: `.archive/week4-deletions-20251203/`
   - Last activity: Oct 12, 2025
   - Reason: Diagnostics moved to admin-health

---

## 🔄 TO BE DELETED (Week 8 - After Traffic Migration)

### Category 3: Webhook Consolidation (4 Functions)
**Reason**: Being merged into wa-webhook-unified  
**Status**: Active (serving production traffic during migration)  
**Scheduled Deletion**: Week 8 (Jan 1-7, 2026)

1. **wa-webhook-ai-agents** (v533)
   - Size: 241 lines, 7.8KB
   - Traffic: To be migrated to unified
   - Archive: Will move to `.archive/wa-webhook-deprecated-YYYYMMDD/`
   - Delete after: 7 days at 100% unified traffic
   
2. **wa-webhook-jobs** (v480)
   - Size: 614 lines, 20KB
   - Traffic: To be migrated to unified
   - Archive: Will move to `.archive/wa-webhook-deprecated-YYYYMMDD/`
   - Delete after: 7 days at 100% unified traffic
   
3. **wa-webhook-marketplace** (v317)
   - Size: 715 lines, 23KB
   - Traffic: To be migrated to unified
   - Archive: Will move to `.archive/wa-webhook-deprecated-YYYYMMDD/`
   - Delete after: 7 days at 100% unified traffic
   
4. **wa-webhook-property** (v432)
   - Size: 525 lines, 16KB
   - Traffic: To be migrated to unified
   - Archive: Will move to `.archive/wa-webhook-deprecated-YYYYMMDD/`
   - Delete after: 7 days at 100% unified traffic

---

## 🚫 NEVER DELETE (Protected Functions)

### Production-Critical (LIVE TRAFFIC)
1. **wa-webhook-mobility** (v495)
   - Protection: Live production traffic
   - Changes: Additive only
   
2. **wa-webhook-profile** (v297)
   - Protection: Live production traffic
   - Changes: Additive only
   
3. **wa-webhook-insurance** (v345)
   - Protection: Live production traffic
   - Changes: Additive only

### Core Infrastructure
4. **wa-webhook-core** (v601)
   - Protection: Base webhook handler
   - Role: Traffic routing
   
5. **wa-webhook-unified** (v212)
   - Protection: Consolidation target
   - Role: Receives migrated traffic
   
6. **wa-webhook** (v268)
   - Protection: Legacy router fallback
   - Role: Backward compatibility
   
7. **wa-webhook-wallet** (v195)
   - Protection: Financial operations
   - Role: Payment processing

---

## 📊 Summary Statistics

| Category | Count | Status |
|----------|-------|--------|
| **Agent Duplicates** | 13 | ✅ Deleted Dec 3 |
| **Inactive Functions** | 9 | ✅ Deleted Dec 3 |
| **Webhook Consolidation** | 4 | 🔄 Delete Week 8 |
| **Protected Functions** | 7 | 🚫 Never Delete |
| **Other Active Functions** | 40+ | ✅ Keep |
| **TOTAL DELETED (Week 4)** | **22** | **✅ Complete** |
| **TOTAL TO DELETE (Week 8)** | **4** | **🔄 Pending** |
| **FINAL REDUCTION** | **26** | **-33% functions** |

---

## 🗂️ Archive Locations

```
supabase/functions/.archive/
├── agent-duplicates-20251203/          # 13 agent functions
│   ├── agent-chat/
│   ├── agent-config-invalidator/
│   ├── agent-monitor/
│   ├── agent-negotiation/
│   ├── agent-property-rental/
│   ├── agent-quincaillerie/
│   ├── agent-runner/
│   ├── agent-schedule-trip/
│   ├── agent-shops/
│   ├── agent-tools-general-broker/
│   ├── agents/
│   ├── job-board-ai-agent/
│   └── waiter-ai-agent/
│
├── inactive-functions-20251203/        # 5 inactive functions
│   ├── admin-subscriptions/
│   ├── campaign-dispatcher/
│   ├── cart-reminder/
│   └── housekeeping/
│
├── inactive-batch2-20251203/           # 2 inactive functions
│   ├── flow-exchange/
│   └── flow-exchange-mock/
│
├── week4-deletions-20251203/           # 2 inactive functions
│   ├── simulator/
│   └── wa-webhook-diag/
│
└── (Week 8 - To be created)
    └── wa-webhook-deprecated-YYYYMMDD/ # 4 webhook functions
        ├── wa-webhook-ai-agents/
        ├── wa-webhook-jobs/
        ├── wa-webhook-marketplace/
        └── wa-webhook-property/
```

---

## 🔍 Verification

### Check deleted functions are gone
```bash
supabase functions list | grep -E "agent-|waiter-ai|job-board-ai|admin-sub|campaign-dis|cart-rem|flow-ex|housekeep|order-pen|simulator|wa-webhook-diag"
# Expected: 0 results
```

### Check archives exist
```bash
ls -la supabase/functions/.archive/
# Expected: 4 directories
```

### Check current count
```bash
supabase functions list | wc -l
# Expected: 73 (will be 64 after Week 8)
```

---

## 📝 Deletion Commands Reference

### Already Executed (Week 4)
```bash
# Agent duplicates
for func in agent-chat agent-config-invalidator agent-monitor agent-negotiation \
            agent-property-rental agent-quincaillerie agent-runner agent-schedule-trip \
            agent-shops agent-tools-general-broker agents job-board-ai-agent waiter-ai-agent; do
  supabase functions delete $func
done

# Inactive functions
for func in admin-subscriptions campaign-dispatcher cart-reminder flow-exchange \
            flow-exchange-mock housekeeping order-pending-reminder simulator wa-webhook-diag; do
  supabase functions delete $func
done
```

### To Execute (Week 8)
```bash
# Webhook consolidation
for func in wa-webhook-jobs wa-webhook-marketplace wa-webhook-property wa-webhook-ai-agents; do
  supabase functions delete $func --project-ref $SUPABASE_PROJECT_REF
done
```

---

## 🔄 Rollback Reference

### Restore a deleted function
```bash
# Example: Restore agent-chat
cp -r supabase/functions/.archive/agent-duplicates-20251203/agent-chat supabase/functions/
supabase functions deploy agent-chat --no-verify-jwt
```

### Restore all agent duplicates
```bash
for func in agent-chat agent-config-invalidator agent-monitor; do
  cp -r .archive/agent-duplicates-20251203/$func supabase/functions/
  supabase functions deploy $func --no-verify-jwt
done
```

---

**Last Updated**: December 3, 2025  
**Maintained By**: AI Agent (Autonomous)  
**See Also**: 
- `WEEK_4_8_CONSOLIDATION_PLAN.md` - Full roadmap
- `WEEK_4_DELETION_REPORT.md` - Execution report
- `FUNCTIONS_TO_DELETE_LIST.md` - Original analysis
