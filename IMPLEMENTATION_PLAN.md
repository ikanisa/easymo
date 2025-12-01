# easyMO Platform Cleanup - Implementation Plan
**Started:** December 1, 2025
**Status:** 🚀 IN PROGRESS

## Phase 1: Documentation Cleanup (Week 1) - 🔴 P0

### Task 1.1: Consolidate client-pwa Documentation
- [x] Audit completed - 99 markdown files found
- [ ] Create single GETTING_STARTED.md
- [ ] Archive duplicate deployment guides
- [ ] Keep only: README.md, CONTRIBUTING.md, DEPLOYMENT.md

### Task 1.2: Clean Up Root Directory Documentation
- [ ] Consolidate deployment status files
- [ ] Archive old implementation summaries
- [ ] Update main README.md

## Phase 2: App Consolidation (Week 1) - 🔴 P0

### Task 2.1: Identify Production Apps
- [ ] Determine which admin-app is production (admin-app vs admin-app-v2)
- [ ] Determine which bar-manager is production
- [ ] Document in main README.md

### Task 2.2: Archive Non-Production Apps
- [ ] Create .archive/deprecated-apps/
- [ ] Move deprecated versions
- [ ] Update workspace configuration

## Phase 3: Backend Consolidation (Week 2) - ⚠️ P1

### Task 3.1: Standardize Message Deduplication
- [ ] Create MessageDeduplicator service
- [ ] Update all webhooks to use it
- [ ] Add tests

### Task 3.2: Consolidate Session Management
- [ ] Audit session tables (agent_chat_sessions, whatsapp_conversations, user_sessions)
- [ ] Create migration to consolidate
- [ ] Update all services

### Task 3.3: Consolidate Core Webhooks
- [ ] Merge wa-webhook, wa-webhook-core, wa-webhook-unified
- [ ] Keep domain-specific webhooks separate
- [ ] Update routing

## Phase 4: Database Review (Week 3) - ⚠️ P1

### Task 4.1: RLS Policies Audit
- [ ] Review skipped migration: 20251125080100_add_user_rls_policies_insurance.sql.skip
- [ ] Test agent operations with RLS
- [ ] Apply or document skip reason

### Task 4.2: Country Support Cleanup
- [ ] Review skipped migration: 20251122170000_cleanup_unsupported_countries.sql.skip
- [ ] Remove unsupported country references
- [ ] Update validation

## Current Progress: Phase 1 Starting...
