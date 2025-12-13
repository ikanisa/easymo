-- ============================================================================
-- EASYMO FINAL DATABASE CLEANUP
-- Generated: 2025-12-13T07:30:00Z
-- Purpose: Delete ALL tables EXCEPT `public.businesses`
-- Status: ✅ EXECUTED (2025-12-13)
-- ============================================================================

-- NOTE: This migration has already been applied directly to the database
-- This file serves as documentation of the cleanup performed.

-- BEFORE STATE:
-- - 319 total tables (public + app schemas)
-- - Multiple services: video, agents, marketplace, wallet, insurance, mobility

-- AFTER STATE:
-- - 1 application table: public.businesses (6,650 records, 25 MB)
-- - System tables preserved (auth, storage, migrations)

-- TABLES PROTECTED:
-- ✅ public.businesses (6,650 records) - STRICTLY PROTECTED

-- TABLES DELETED (281 total):
-- 1. Video/Media: BrandGuide, VideoJob, VideoTemplate, VideoScript, etc.
-- 2. AI Agents: agent_*, ai_agent_* (all agent tables)
-- 3. Marketplace: products, quotes, purchases, intents
-- 4. Wallet: accounts, transactions, entries, cashouts
-- 5. Insurance: policies, claims, renewals, certificates
-- 6. Mobility: trips, drivers, vehicles, schedules, stations
-- 7. WhatsApp: conversations, messages, events, threads
-- 8. Webhooks: queue, logs, routing, signatures
-- 9. Analytics: events, metrics, campaigns
-- 10. App schema: All app.* tables deleted

-- EXECUTION SUMMARY:
-- Date: 2025-12-13T07:00:00Z
-- Duration: ~2 minutes
-- Tables dropped: 281
-- Tables kept: 1 (businesses)
-- Cascading constraints: ~50+ automatically removed
-- Database size reduced: Significant reduction

-- VERIFICATION:
-- SELECT COUNT(*) FROM public.businesses; -- Result: 6,650 ✓
-- SELECT pg_size_pretty(pg_total_relation_size('public.businesses')); -- 25 MB ✓

-- This migration file is for documentation only.
-- The actual cleanup was performed via direct SQL execution.
-- No further action required - changes are already committed to database.
