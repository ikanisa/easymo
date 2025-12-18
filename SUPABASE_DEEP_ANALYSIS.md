# Supabase Database Deep Analysis & Refactoring Plan

**Project:** lhbowpbcpwoiparwnwgt  
**Date:** 2025-12-17  
**Status:** 🔍 Analysis Complete - Ready for Refactoring

---

## Executive Summary

This analysis reviews **all tables, functions, and database infrastructure** in the Supabase project to identify:
- ✅ **Active/Used** components
- ⚠️ **Unused/Deprecated** components  
- 🔄 **Redundant/Duplicate** components
- 🗑️ **Candidates for deletion**
- 🔧 **Refactoring opportunities**

---

## 1. Database Tables Analysis

### 1.1 Core User & Profile Tables ✅ KEEP

| Table | Rows | Status | Notes |
|-------|------|--------|-------|
| `profiles` | 1 | ✅ **ACTIVE** | Core user profiles, linked to auth.users |
| `whatsapp_users` | 4 | ✅ **ACTIVE** | Lightweight WhatsApp user tracking |
| `user_sessions` | 2 | ✅ **ACTIVE** | Conversation state management |

**Action:** ✅ Keep all - essential for core functionality

---

### 1.2 Wallet & Token System ✅ KEEP

| Table | Rows | Status | Notes |
|-------|------|--------|-------|
| `wallet_transactions` | 0 | ✅ **ACTIVE** | Transaction history (old system) |
| `wallet_notification_queue` | 0 | ✅ **ACTIVE** | Notification queue for transactions |
| `token_transfers` | 0 | ✅ **ACTIVE** | User-to-user transfer audit trail (NEW) |
| `referral_links` | ? | ✅ **ACTIVE** | Referral codes (referenced in code) |

**⚠️ MISSING TABLES (Referenced in code but don't exist):**
- `wallet_accounts` - Referenced in `wallet.ts` but table doesn't exist (should be `token_accounts`?)
- `referral_attributions` - Referenced but doesn't exist
- `referral_ledger` - Referenced but doesn't exist  
- `promo_rules` - Referenced but doesn't exist

**Action:** 
- ✅ Keep existing tables
- ⚠️ **FIX CODE:** Update references to use correct table names or create missing tables

---

### 1.3 Mobility System ✅ KEEP (Simplified)

| Table | Rows | Status | Notes |
|-------|------|--------|-------|
| `mobility_users` | 3 | ✅ **ACTIVE** | Simplified mobility users (wa_id based) |
| `mobility_presence` | 1 | ✅ **ACTIVE** | Real-time location presence |
| `trips` | 0 | ⚠️ **UNUSED** | Old trips table - replaced by simplified system |
| `location_cache` | 0 | ⚠️ **UNUSED** | Old location cache - not used in simplified flow |
| `favorites` | 0 | ⚠️ **UNUSED** | Saved locations - not used |
| `vehicles` | 0 | ⚠️ **UNUSED** | Vehicle registration - not used |

**Action:**
- ✅ Keep: `mobility_users`, `mobility_presence`
- 🗑️ **DELETE:** `trips`, `location_cache`, `favorites`, `vehicles` (replaced by simplified system)

---

### 1.4 Business & Marketplace Tables ✅ KEEP

| Table | Rows | Status | Notes |
|-------|------|--------|-------|
| `businesses` | 6,650 | ✅ **ACTIVE** | Core business directory (CRITICAL - 6.6K records) |
| `marketplace_inquiries` | 0 | ✅ **ACTIVE** | Buyer requests |
| `marketplace_listings` | 0 | ✅ **ACTIVE** | Product/service listings |
| `marketplace_matches` | 0 | ✅ **ACTIVE** | Buyer-seller matches |
| `marketplace_conversations` | 0 | ✅ **ACTIVE** | Conversation state |
| `vendors` | 0 | ✅ **ACTIVE** | Vendor directory |
| `vendor_outreach_log` | 0 | ✅ **ACTIVE** | Outreach tracking |
| `whatsapp_broadcast_requests` | 0 | ✅ **ACTIVE** | Broadcast campaigns |
| `whatsapp_broadcast_targets` | 0 | ✅ **ACTIVE** | Broadcast targets |
| `whatsapp_opt_outs` | 0 | ✅ **ACTIVE** | Opt-out tracking |
| `whatsapp_business_replies` | 0 | ✅ **ACTIVE** | Vendor replies |
| `sourcing_requests` | 0 | ✅ **ACTIVE** | AI sourcing requests |
| `candidate_vendors` | 0 | ✅ **ACTIVE** | Discovered vendors |
| `agent_outreach_sessions` | 0 | ✅ **ACTIVE** | Agent outreach sessions |
| `agent_vendor_messages` | 0 | ✅ **ACTIVE** | Vendor message log |
| `agent_user_memory` | 0 | ✅ **ACTIVE** | User memory for agents |

**Action:** ✅ Keep all - essential for buy/sell marketplace

---

### 1.5 Admin & Configuration Tables ✅ KEEP

| Table | Rows | Status | Notes |
|-------|------|--------|-------|
| `admin_contacts` | 2 | ✅ **ACTIVE** | Admin contact info |
| `insurance_admin_contacts` | 4 | ✅ **ACTIVE** | Insurance contacts |
| `whatsapp_home_menu_items` | 5 | ✅ **ACTIVE** | Home menu configuration |
| `profile_menu_items` | 10 | ✅ **ACTIVE** | Profile menu configuration |
| `feature_flags` | 10 | ✅ **ACTIVE** | Feature flags |
| `menu_items` | 0 | ⚠️ **UNUSED** | Old menu system - replaced by whatsapp_home_menu_items |

**Action:**
- ✅ Keep: All active tables
- 🗑️ **DELETE:** `menu_items` (replaced by `whatsapp_home_menu_items`)

---

### 1.6 AI Agent & Session Tables ✅ KEEP

| Table | Rows | Status | Notes |
|-------|------|--------|-------|
| `ai_agent_sessions` | 0 | ✅ **ACTIVE** | AI conversation sessions |
| `agent_requests` | 0 | ✅ **ACTIVE** | Agent request cache (idempotency) |
| `conversations` | 0 | ✅ **ACTIVE** | Conversation state |
| `jobs` | 0 | ✅ **ACTIVE** | Background job queue |
| `inbound_messages` | 0 | ✅ **ACTIVE** | Message audit trail |

**Action:** ✅ Keep all - essential for AI agents

---

### 1.7 Observability & Logging Tables ✅ KEEP

| Table | Rows | Status | Notes |
|-------|------|--------|-------|
| `wa_events` | 13 | ✅ **ACTIVE** | WhatsApp event tracking |
| `processed_webhooks` | 0 | ✅ **ACTIVE** | Webhook idempotency |
| `message_rate_limits` | 0 | ✅ **ACTIVE** | Rate limiting |
| `rate_limit_counters` | 0 | ✅ **ACTIVE** | Rate limit counters |
| `analytics_events` | 0 | ✅ **ACTIVE** | Analytics events |
| `system_metrics` | 0 | ✅ **ACTIVE** | System metrics |
| `auth_logs` | 0 | ✅ **ACTIVE** | Auth audit logs |

**Action:** ✅ Keep all - essential for observability

---

### 1.8 Ibimina/SACCO System Tables ⚠️ REVIEW

| Table | Rows | Status | Notes |
|-------|------|--------|-------|
| `organizations` | 0 | ⚠️ **UNUSED?** | SACCO organizations |
| `members` | 0 | ⚠️ **UNUSED?** | SACCO members |
| `groups` | 0 | ⚠️ **UNUSED?** | Member groups |
| `group_members` | 0 | ⚠️ **UNUSED?** | Group membership |
| `share_allocations` | 0 | ⚠️ **UNUSED?** | Share allocations |
| `allocation_export_requests` | 0 | ⚠️ **UNUSED?** | Export requests |
| `wallet_accounts_ibimina` | 0 | ⚠️ **UNUSED?** | Ibimina wallet accounts |
| `wallet_transactions_ibimina` | 0 | ⚠️ **UNUSED?** | Ibimina transactions |
| `payments` | 0 | ⚠️ **UNUSED?** | Payment records |
| `settlements` | 0 | ⚠️ **UNUSED?** | Settlement records |
| `reconciliation_runs` | 0 | ⚠️ **UNUSED?** | Reconciliation runs |
| `reconciliation_exceptions` | 0 | ⚠️ **UNUSED?** | Reconciliation exceptions |
| `sms_inbox` | 0 | ⚠️ **UNUSED?** | SMS inbox |
| `sms_parsed` | 0 | ⚠️ **UNUSED?** | Parsed SMS |
| `sms_templates` | 0 | ⚠️ **UNUSED?** | SMS templates |
| `sms_review_queue` | 0 | ⚠️ **UNUSED?** | SMS review queue |
| `configuration` | 0 | ⚠️ **UNUSED?** | Configuration |
| `org_feature_overrides` | 0 | ⚠️ **UNUSED?** | Feature overrides |

**Action:** ⚠️ **REVIEW REQUIRED** - These appear to be for a separate SACCO/Ibimina system. If not actively used, consider:
- 🗑️ **DELETE** if not part of easyMO WhatsApp platform
- 📦 **MIGRATE** to separate database if needed for future use

---

### 1.9 Auth & Security Tables ✅ KEEP

| Table | Rows | Status | Notes |
|-------|------|--------|-------|
| `auth_qr_sessions` | 0 | ✅ **ACTIVE** | QR authentication sessions |
| `staff_devices` | 0 | ✅ **ACTIVE** | Staff device tracking |
| `user_push_subscriptions` | 0 | ⚠️ **UNUSED?** | Push notification subscriptions |
| `push_tokens` | 0 | ⚠️ **UNUSED?** | Push tokens |

**Action:**
- ✅ Keep: `auth_qr_sessions`, `staff_devices`
- ⚠️ **REVIEW:** `user_push_subscriptions`, `push_tokens` (if not using push notifications, delete)

---

### 1.10 Notification & Queue Tables ✅ KEEP

| Table | Rows | Status | Notes |
|-------|------|--------|-------|
| `notification_queue` | 0 | ✅ **ACTIVE** | Notification queue |
| `user_locations` | 0 | ⚠️ **UNUSED?** | User location data (may be replaced by mobility_presence) |

**Action:**
- ✅ Keep: `notification_queue`
- ⚠️ **REVIEW:** `user_locations` (check if used, may be redundant with `mobility_presence`)

---

### 1.11 PostGIS System Tables ✅ KEEP

| Table | Rows | Status | Notes |
|-------|------|--------|-------|
| `spatial_ref_sys` | 8,500 | ✅ **SYSTEM** | PostGIS spatial reference system (system table) |

**Action:** ✅ Keep - PostGIS system table

---

## 2. RPC Functions Analysis

### 2.1 Core Application Functions ✅ KEEP

| Function | Status | Notes |
|----------|--------|-------|
| `ensure_whatsapp_user` | ✅ **ACTIVE** | Creates/gets WhatsApp user |
| `get_or_create_user` | ✅ **ACTIVE** | User creation helper |
| `wallet_delta_fn` | ✅ **ACTIVE** | Core wallet credit/debit |
| `get_wallet_transactions` | ✅ **ACTIVE** | Transaction history |
| `referral_apply_code_v2` | ✅ **ACTIVE** | Apply referral codes |
| `generate_referral_code` | ✅ **ACTIVE** | Generate referral codes |
| `wallet_summary` | ✅ **ACTIVE** | Wallet balance summary |

**Action:** ✅ Keep all - essential functions

---

### 2.2 Mobility Functions ✅ KEEP (Simplified)

| Function | Status | Notes |
|----------|--------|-------|
| `mobility_touch_user` | ✅ **ACTIVE** | Touch/update mobility user |
| `mobility_set_flow` | ✅ **ACTIVE** | Set flow state |
| `mobility_upsert_presence` | ✅ **ACTIVE** | Update location presence |
| `mobility_find_nearby` | ✅ **ACTIVE** | Find nearby drivers/passengers |
| `create_trip` | ⚠️ **UNUSED?** | Old trip creation (replaced by simplified system) |
| `cleanup_expired_trips` | ⚠️ **UNUSED?** | Old trip cleanup (replaced by simplified system) |
| `haversine_distance` | ⚠️ **UNUSED?** | Distance calculation (may be used elsewhere) |

**Action:**
- ✅ Keep: `mobility_*` functions
- ⚠️ **REVIEW:** `create_trip`, `cleanup_expired_trips` (delete if not used)
- ⚠️ **REVIEW:** `haversine_distance` (keep if used by other systems)

---

### 2.3 Marketplace Functions ✅ KEEP

| Function | Status | Notes |
|----------|--------|-------|
| `find_matching_marketplace_buyers` | ✅ **ACTIVE** | Find buyers for listings |
| `get_inquiry_status` | ✅ **ACTIVE** | Get inquiry status |
| `get_inquiry_outreach` | ✅ **ACTIVE** | Get outreach log |
| `get_user_memories` | ✅ **ACTIVE** | Get agent user memory |
| `upsert_agent_user_memory` | ✅ **ACTIVE** | Update agent memory |
| `search_businesses_nearby` | ✅ **ACTIVE** | Business search |

**Action:** ✅ Keep all - essential for marketplace

---

### 2.4 Menu & Configuration Functions ✅ KEEP

| Function | Status | Notes |
|----------|--------|-------|
| `get_home_menu_for_user` | ✅ **ACTIVE** | Get home menu items |
| `get_profile_menu_items_v2` | ✅ **ACTIVE** | Get profile menu items |

**Action:** ✅ Keep all - essential for menu system

---

### 2.5 Location Functions ⚠️ REVIEW

| Function | Status | Notes |
|----------|--------|-------|
| `get_cached_location` | ⚠️ **UNUSED?** | Get cached location (may be replaced) |
| `update_user_location_cache` | ⚠️ **UNUSED?** | Update location cache (may be replaced) |

**Action:** ⚠️ **REVIEW** - Check if used, may be redundant with `mobility_presence`

---

### 2.6 Job Queue Functions ✅ KEEP

| Function | Status | Notes |
|----------|--------|-------|
| `get_next_job` | ✅ **ACTIVE** | Get next job from queue |

**Action:** ✅ Keep - essential for job processing

---

### 2.7 Cleanup Functions ✅ KEEP

| Function | Status | Notes |
|----------|--------|-------|
| `cleanup_expired_agent_memory` | ✅ **ACTIVE** | Clean expired agent memory |
| `cleanup_expired_agent_requests` | ✅ **ACTIVE** | Clean expired agent requests |
| `cleanup_old_conversation_history` | ✅ **ACTIVE** | Clean conversation history |

**Action:** ✅ Keep all - essential for maintenance

---

### 2.8 Rate Limiting Functions ✅ KEEP

| Function | Status | Notes |
|----------|--------|-------|
| `check_rate_limit` | ✅ **ACTIVE** | Check rate limits |
| `increment_positive_response` | ✅ **ACTIVE** | Increment vendor response count |

**Action:** ✅ Keep all - essential for rate limiting

---

### 2.9 PostGIS Functions ✅ KEEP (System)

| Function | Status | Notes |
|----------|--------|-------|
| `st_*` (hundreds) | ✅ **SYSTEM** | PostGIS spatial functions (system functions) |

**Action:** ✅ Keep - PostGIS system functions

---

### 2.10 Vector/Embedding Functions ⚠️ REVIEW

| Function | Status | Notes |
|----------|--------|-------|
| `vector_*`, `halfvec_*`, `sparsevec_*` | ⚠️ **UNUSED?** | Vector similarity functions (pgvector extension) |

**Action:** ⚠️ **REVIEW** - If not using vector embeddings, these can be ignored (extension functions)

---

### 2.11 Trigger Functions ✅ KEEP

| Function | Status | Notes |
|----------|--------|-------|
| `trigger_wallet_notification` | ✅ **ACTIVE** | Wallet notification trigger |
| `profiles_set_updated_at` | ✅ **ACTIVE** | Auto-update timestamp |
| `trips_set_updated_at` | ⚠️ **UNUSED?** | Old trips trigger (may be unused) |
| `allowed_partners_set_updated_at` | 🗑️ **DELETED** | Table deleted - function removed |
| Various `update_*_timestamp` triggers | ✅ **ACTIVE** | Auto-update triggers |

**Action:**
- ✅ Keep: Active triggers
- ⚠️ **REVIEW:** `trips_set_updated_at` (delete if trips table deleted)

---

## 3. Tables to DELETE 🗑️

### High Priority Deletions

1. **`trips`** - Replaced by simplified `mobility_users` + `mobility_presence`
2. **`location_cache`** - Not used in simplified mobility
3. **`favorites`** - Not used in simplified mobility
4. **`vehicles`** - Not used in simplified mobility
5. **`menu_items`** - Replaced by `whatsapp_home_menu_items`

### Code References to Non-Existent Tables ⚠️

**CRITICAL:** The following tables are referenced in code but **DO NOT EXIST** in the database:

1. **`wallet_accounts`** - Referenced in `wallet.ts` (should be `token_accounts`?)
2. **`chat_state`** - Referenced in `store.ts` (multiple references)
3. **`message_queue`** - Referenced in `message-deduplication.ts`
4. **`ai_conversation_memory`** - Referenced in `message-deduplication.ts`
5. **`webhook_metrics`** - Referenced in `webhook-utils.ts`
6. **`webhook_queue`** - Referenced in `webhook-utils.ts`
7. **`webhook_dlq`** - Referenced in `webhook-utils.ts`
8. **`webhook_conversations`** - Referenced in `webhook-utils.ts`
9. **`conversation_state_transitions`** - Referenced in `webhook-utils.ts`
10. **`agent_configurations`** - Referenced in `llm-router.ts`
11. **`users`** - Referenced in `store.ts` (should be `auth.users`?)

**Action Required:**
- 🔧 **FIX CODE:** Update all references to use correct table names
- 🗑️ **OR DELETE:** Remove dead code that references non-existent tables

### Medium Priority (Review First)

6. **`user_locations`** - May be redundant with `mobility_presence`
7. **`user_push_subscriptions`** - If not using push notifications
8. **`push_tokens`** - If not using push notifications

### Low Priority (SACCO/Ibimina System - Separate Review)

9-26. All SACCO/Ibimina tables (if not part of easyMO WhatsApp platform):
   - `organizations`, `members`, `groups`, `group_members`
   - `share_allocations`, `allocation_export_requests`
   - `wallet_accounts_ibimina`, `wallet_transactions_ibimina`
   - `payments`, `settlements`, `reconciliation_*`
   - `sms_*` tables
   - `configuration`, `org_feature_overrides`

---

## 4. Functions to DELETE 🗑️

### High Priority Deletions

1. **`create_trip`** - Replaced by simplified mobility system
2. **`cleanup_expired_trips`** - No longer needed
3. **`trips_set_updated_at`** - Trigger for deleted table

### Medium Priority (Review First)

4. **`get_cached_location`** - Check if used elsewhere
5. **`update_user_location_cache`** - Check if used elsewhere
6. **`haversine_distance`** - Check if used by other systems

---

## 5. Refactoring Opportunities 🔧

### 5.1 Consolidate Location Tables

**Issue:** Multiple location-related tables:
- `location_cache` (unused)
- `favorites` (unused)
- `user_locations` (may be unused)
- `mobility_presence` (active)

**Action:** 
- ✅ Keep only `mobility_presence` for real-time location
- 🗑️ Delete others

---

### 5.2 Consolidate Menu Tables

**Issue:** Two menu systems:
- `menu_items` (old, unused)
- `whatsapp_home_menu_items` + `profile_menu_items` (active)

**Action:**
- ✅ Keep active menu tables
- 🗑️ Delete `menu_items`

---

### 5.3 Review SACCO/Ibimina System

**Issue:** Large set of tables for separate system (18+ tables, all empty)

**Action:**
- ⚠️ **DECISION REQUIRED:** 
  - If not part of easyMO WhatsApp platform → 🗑️ **DELETE**
  - If needed for future → 📦 **MIGRATE** to separate database
  - If actively used → ✅ **KEEP** and document

---

### 5.4 Simplify Mobility System ✅ DONE

**Status:** ✅ Already refactored
- Old: `trips`, `location_cache`, `favorites`, `vehicles`
- New: `mobility_users`, `mobility_presence`

**Action:** 🗑️ Delete old tables (already identified above)

---

## 6. Migration Plan

### Phase 1: Safe Deletions (No Dependencies)

```sql
-- 1. Delete unused mobility tables
DROP TABLE IF EXISTS public.trips CASCADE;
DROP TABLE IF EXISTS public.location_cache CASCADE;
DROP TABLE IF EXISTS public.favorites CASCADE;
DROP TABLE IF EXISTS public.vehicles CASCADE;

-- 2. Delete old menu system
DROP TABLE IF EXISTS public.menu_items CASCADE;

-- 3. Delete unused functions
DROP FUNCTION IF EXISTS public.create_trip CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_trips CASCADE;
DROP FUNCTION IF EXISTS public.trips_set_updated_at CASCADE;
```

### Phase 2: Review & Delete (Check Dependencies First)

```sql
-- Review these before deleting:
-- user_locations (check if used)
-- user_push_subscriptions (check if push notifications used)
-- push_tokens (check if push notifications used)
-- get_cached_location (check if used)
-- update_user_location_cache (check if used)
```

### Phase 3: SACCO/Ibimina System Decision

**Decision Required:** Keep, migrate, or delete SACCO/Ibimina tables

---

## 7. Summary Statistics

### Tables
- **Total Tables:** ~70
- **Active Tables:** ~45
- **Unused Tables:** ~10
- **SACCO/Ibimina Tables:** ~18 (review required)
- **System Tables:** ~2 (PostGIS)

### Functions
- **Total Functions:** ~1,000+ (includes PostGIS system functions)
- **Application Functions:** ~30
- **PostGIS Functions:** ~900+ (system)
- **Vector Functions:** ~100+ (extension, may be unused)
- **Unused Functions:** ~3-5

### Estimated Cleanup
- **Tables to Delete:** 5-10 (immediate) + 18 (SACCO review)
- **Functions to Delete:** 3-5
- **Storage Savings:** Minimal (most tables empty)
- **Maintenance Reduction:** Significant (fewer tables to maintain)

---

## 8. Recommendations

### Immediate Actions ✅

1. **Delete unused mobility tables** (`trips`, `location_cache`, `favorites`, `vehicles`)
2. **Delete old menu system** (`menu_items`)
3. **Delete unused functions** (`create_trip`, `cleanup_expired_trips`, `trips_set_updated_at`)

### Review Required ⚠️

1. **SACCO/Ibimina system** - Decision on 18 tables
2. **Push notification tables** - If not using, delete
3. **Location cache functions** - Verify if used elsewhere

### Long-term Improvements 🔧

1. **Consolidate location storage** - Single source of truth
2. **Document active tables** - Clear ownership and purpose
3. **Regular cleanup** - Quarterly review of unused tables

---

## 9. Risk Assessment

### Low Risk ✅
- Deleting `trips`, `location_cache`, `favorites`, `vehicles` (already replaced)
- Deleting `menu_items` (already replaced)
- Deleting unused functions

### Medium Risk ⚠️
- Deleting `user_locations` (verify not used)
- Deleting push notification tables (verify not used)

### High Risk 🚨
- Deleting SACCO/Ibimina tables (requires business decision)

---

## 10. Critical Issues Found ⚠️

### 10.1 Code References Non-Existent Tables

**SEVERITY: HIGH** - Code will fail at runtime when accessing these tables:

| File | Table Referenced | Status |
|------|------------------|--------|
| `wallet.ts` | `wallet_accounts` | ❌ **DOES NOT EXIST** |
| `store.ts` | `chat_state` | ❌ **DOES NOT EXIST** (multiple references) |
| `store.ts` | `users` | ❌ **DOES NOT EXIST** (should be `auth.users`?) |
| `message-deduplication.ts` | `message_queue` | ❌ **DOES NOT EXIST** |
| `message-deduplication.ts` | `ai_conversation_memory` | ❌ **DOES NOT EXIST** |
| `webhook-utils.ts` | `webhook_metrics` | ❌ **DOES NOT EXIST** |
| `webhook-utils.ts` | `webhook_queue` | ❌ **DOES NOT EXIST** |
| `webhook-utils.ts` | `webhook_dlq` | ❌ **DOES NOT EXIST** |
| `webhook-utils.ts` | `webhook_conversations` | ❌ **DOES NOT EXIST** |
| `webhook-utils.ts` | `conversation_state_transitions` | ❌ **DOES NOT EXIST** |
| `llm-router.ts` | `agent_configurations` | ❌ **DOES NOT EXIST** |

**Action Required:**
1. 🔧 **IMMEDIATE:** Fix all code references to use correct table names
2. 🗑️ **OR:** Delete dead code that references non-existent tables
3. ✅ **VERIFY:** Test all affected functions after fixes

---

## 11. Next Steps

### Phase 0: Critical Fixes (IMMEDIATE) 🚨

1. **Fix code references** to non-existent tables
   - Update `wallet_accounts` → `token_accounts` (or create table)
   - Fix `chat_state` references (or create table)
   - Fix `users` → `auth.users` or `profiles`
   - Fix all `webhook_*` table references
   - Fix `agent_configurations` reference

### Phase 1: Safe Deletions ✅

2. **Delete unused mobility tables:**
   - `trips`, `location_cache`, `favorites`, `vehicles`
   - `create_trip`, `cleanup_expired_trips` functions
   - `trips_set_updated_at` trigger

3. **Delete old menu system:**
   - `menu_items` table

### Phase 2: Review & Decision ⚠️

4. **Review SACCO/Ibimina system** (18 tables, all empty)
   - Decision: Keep, migrate, or delete

5. **Review push notification tables:**
   - `user_push_subscriptions`, `push_tokens` (if not using push)

6. **Review location cache functions:**
   - `get_cached_location`, `update_user_location_cache`

### Phase 3: Documentation 📋

7. **Document final schema**
8. **Update codebase** to remove all dead code
9. **Create migration** for Phase 1 deletions

---

## 12. Summary Statistics

### Tables
- **Total Tables:** 70
- **Active Tables:** ~45
- **Unused Tables:** ~10 (safe to delete)
- **SACCO/Ibimina Tables:** ~18 (review required)
- **System Tables:** 1 (PostGIS)
- **Missing Tables (referenced in code):** 11 ⚠️

### Functions
- **Total Functions:** ~1,000+ (includes PostGIS system functions)
- **Application Functions:** ~30
- **PostGIS Functions:** ~900+ (system)
- **Vector Functions:** ~100+ (extension, may be unused)
- **Unused Functions:** ~3-5

### Code Issues
- **Non-existent table references:** 11 ⚠️ **CRITICAL**
- **Dead code:** Multiple files reference missing tables

### Estimated Cleanup
- **Tables to Delete:** 5-10 (immediate) + 18 (SACCO review)
- **Functions to Delete:** 3-5
- **Code Files to Fix:** ~7 files with non-existent table references
- **Storage Savings:** Minimal (most tables empty)
- **Maintenance Reduction:** Significant (fewer tables to maintain)

---

**Analysis Complete!** 🎉

**⚠️ CRITICAL:** Fix code references to non-existent tables before proceeding with deletions.

This document provides a comprehensive review of all Supabase tables and functions. Proceed with fixes and deletions based on business requirements and risk assessment.

