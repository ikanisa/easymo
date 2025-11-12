# Failed Migrations Report - Detailed Analysis

**Date:** 2025-11-12  
**Total Failed:** 18 migrations  
**Status:** Ready for fixes

---

## Summary by Root Cause

### Category 1: Missing Columns (10 migrations)

These fail because they reference columns that don't exist on their target tables.

#### 1. **20251004100000_insurance_pipeline.sql** (48 errors)
- **Issue:** Missing `assigned_agent_id` column in insurance tables
- **Impact:** Insurance agent assignment features
- **Fix Required:** Add missing column before applying migration

#### 2. **20251005130000_master_schema_additions.sql** (32 errors)
- **Issue:** References `public.baskets` table (deprecated/removed)
- **Impact:** Basket-related features
- **Fix Required:** Remove basket references from migration

#### 3. **20251006153000_schema_alignment_v2.sql** (10 errors)
- **Issue:** Missing columns in alignment operations
- **Impact:** Schema synchronization
- **Fix Required:** Check column dependencies

#### 4. **20251020200000_wallet_rework.sql** (3 errors)
- **Issue:** Missing wallet table columns
- **Impact:** Wallet enhancements
- **Fix Required:** Add missing wallet columns

#### 5. **20251020223000_vendor_wallet_extensions.sql** (5 errors)
- **Issue:** Missing vendor-specific wallet columns
- **Impact:** Vendor wallet features
- **Fix Required:** Add vendor columns to wallet tables

#### 6. **20251031136000_whatsapp_loans_intents.sql** (3 errors)
- **Issue:** Missing loan intent tracking columns
- **Impact:** Loan tracking
- **Fix Required:** Create loan intent tables first

#### 7. **20251112090000_phase2_mobility_core.sql** (31 errors)
- **Issue:** Missing mobility v2 columns
- **Impact:** Advanced mobility features
- **Fix Required:** Add missing mobility columns

#### 8. **20260320121500_agent_admin_views.sql** (27 errors)
- **Issue:** Missing `dp.updated_at` and other view columns
- **Impact:** Admin dashboard views
- **Fix Required:** Add missing columns to source tables

#### 9. **20260321090000_performance_indexes.sql** (26 errors)
- **Issue:** References `transactions` table that doesn't exist
- **Impact:** Performance optimization
- **Fix Required:** Use correct table name (likely `wallet_transactions`)

#### 10. **20260323100100_agent_registry_seed_configs.sql** (15 errors)
- **Issue:** Missing `name` column in `agent_registry`
- **Impact:** Agent configuration seeding
- **Fix Required:** Add `name` column to agent_registry

---

### Category 2: Complex RLS Policies (4 migrations)

These fail due to complex Row Level Security policy dependencies.

#### 11. **20251031152000_admin_alert_prefs_rls.sql** (4 errors)
- **Issue:** RLS policy dependencies not met
- **Impact:** Admin alert security
- **Fix Required:** Apply in correct order with dependencies

#### 12. **20251031152500_wallet_rls_policies.sql** (33 errors)
- **Issue:** Complex wallet RLS policies with missing references
- **Impact:** Wallet security policies
- **Fix Required:** Simplify or split into smaller migrations

#### 13. **20251112100000_phase2_init.sql** (10 errors)
- **Issue:** Initialization dependencies not met
- **Impact:** Phase 2 feature initialization
- **Fix Required:** Apply prerequisite migrations first

#### 14. **20260214100000_agent_orchestration_system.sql** (62 errors)
- **Issue:** Massive orchestration system with many dependencies
- **Impact:** Advanced agent features
- **Fix Required:** Break into smaller migrations

---

### Category 3: Advanced Features (4 migrations)

These fail because they depend on optional/advanced features not yet implemented.

#### 15. **20251105131954_agent_orchestration_foundation.sql** (37 errors)
- **Issue:** Advanced agent orchestration dependencies
- **Impact:** AI agent orchestration
- **Fix Required:** Implement foundation tables first

#### 16. **20251207090000_brokerai_insurance_mobility.sql** (18 errors)
- **Issue:** BrokerAI integration dependencies
- **Impact:** AI-powered insurance/mobility
- **Fix Required:** Implement BrokerAI tables first

#### 17. **20251207094500_agent_management.sql** (13 errors)
- **Issue:** Advanced agent management features
- **Impact:** Agent lifecycle management
- **Fix Required:** Add missing agent management tables

#### 18. **20260318100000_video_agent_content_system.sql** (42 errors)
- **Issue:** Video content system dependencies
- **Impact:** Video agent features
- **Fix Required:** Implement video infrastructure first

---

## Fix Priority Recommendations

### 🔴 **High Priority (Core Features)**

These should be fixed first as they impact core functionality:

1. **20251020200000_wallet_rework.sql** (3 errors)
   - Core wallet improvements
   - Relatively easy fix

2. **20251020223000_vendor_wallet_extensions.sql** (5 errors)
   - Vendor features
   - Easy fix

3. **20251004100000_insurance_pipeline.sql** (48 errors)
   - Core insurance features
   - Medium complexity

4. **20260321090000_performance_indexes.sql** (26 errors)
   - Performance improvements
   - Easy fix (table name issue)

### 🟡 **Medium Priority (Enhanced Features)**

These add enhanced functionality:

5. **20251006153000_schema_alignment_v2.sql** (10 errors)
6. **20251031136000_whatsapp_loans_intents.sql** (3 errors)
7. **20251112090000_phase2_mobility_core.sql** (31 errors)
8. **20260320121500_agent_admin_views.sql** (27 errors)
9. **20260323100100_agent_registry_seed_configs.sql** (15 errors)

### 🟢 **Low Priority (Advanced/Optional)**

These are advanced features that can wait:

10. **20251005130000_master_schema_additions.sql** (32 errors) - Has basket refs
11. **20251031152000_admin_alert_prefs_rls.sql** (4 errors)
12. **20251031152500_wallet_rls_policies.sql** (33 errors)
13. **20251105131954_agent_orchestration_foundation.sql** (37 errors)
14. **20251112100000_phase2_init.sql** (10 errors)
15. **20251207090000_brokerai_insurance_mobility.sql** (18 errors)
16. **20251207094500_agent_management.sql** (13 errors)
17. **20260214100000_agent_orchestration_system.sql** (62 errors)
18. **20260318100000_video_agent_content_system.sql** (42 errors)

---

## Quick Fixes Available

### Fix #1: Performance Indexes (Easy)
```sql
-- File: 20260321090000_performance_indexes.sql
-- Change: Use wallet_transactions instead of transactions
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_timestamp 
  ON public.wallet_transactions(created_at DESC);
```

### Fix #2: Agent Registry Name Column (Easy)
```sql
-- File: 20260323100100_agent_registry_seed_configs.sql
-- Add before using:
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS name TEXT;
```

### Fix #3: Wallet Rework (Easy)
Check which columns are missing in wallet tables and add them with ALTER TABLE.

### Fix #4: Remove Basket References (Medium)
```sql
-- File: 20251005130000_master_schema_additions.sql
-- Remove all references to public.baskets
-- Or skip this migration entirely
```

---

## Recommended Action Plan

### Phase 1: Quick Wins (1-2 hours)
1. Fix performance_indexes (table name)
2. Add agent_registry.name column
3. Fix wallet rework issues
4. Fix vendor wallet extensions

**Expected:** 4 migrations fixed, ~40 errors resolved

### Phase 2: Core Improvements (2-3 hours)
5. Fix insurance_pipeline
6. Fix schema_alignment_v2
7. Fix mobility_core
8. Fix agent_admin_views

**Expected:** 4 more migrations fixed, ~95 errors resolved

### Phase 3: Advanced Features (4+ hours)
9. Complex RLS policies
10. Agent orchestration
11. Video content system
12. BrokerAI integration

**Expected:** Remaining 10 migrations, advanced features enabled

---

## Summary

| Category | Count | Errors | Priority | Est. Time |
|----------|-------|--------|----------|-----------|
| Missing Columns | 10 | 195 | High-Med | 3-4 hours |
| RLS Policies | 4 | 109 | Medium | 2-3 hours |
| Advanced Features | 4 | 110 | Low | 4+ hours |
| **TOTAL** | **18** | **414** | - | **9-11 hours** |

---

## Current Status

✅ **100/118 migrations working (85%)**  
❌ **18 migrations failing (15%)**  
🎯 **With fixes: 118/118 migrations working (100%)**

---

## Next Steps

1. Review this report
2. Decide which priority level to tackle
3. I can create fix scripts for each migration
4. Apply fixes systematically
5. Achieve 100% migration coverage!

**Would you like me to start with the high-priority fixes?**
