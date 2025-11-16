BEGIN;

-- =====================================================================
-- BASELINE MIGRATION - Production Schema Snapshot
-- =====================================================================
-- Created: 2025-11-14
-- Purpose: Single source of truth representing current production state
-- 
-- This migration marks the starting point after migration cleanup.
-- All subsequent migrations build on this foundation.
--
-- Tables already exist in production. This migration documents them
-- and syncs the migration history.
-- =====================================================================

-- Core Business Tables
-- --------------------
-- business: Main business directory
-- business_owners: Ownership tracking (supports multiple owners)
-- business_whatsapp_numbers: Multiple WhatsApp contacts per business
-- profile_assets: User asset tracking (vehicles, businesses, properties)

-- Core User Tables
-- ----------------
-- profiles: User profiles
-- contacts: Contact information
-- conversations: WhatsApp conversation tracking
-- messages: Message history

-- Mobility Tables
-- ---------------
-- trips: Trip records
-- drivers: Driver information
-- passengers: Passenger information
-- vehicles: Vehicle registrations

-- Insurance Tables
-- ----------------
-- insurance_policies: Policy tracking
-- insurance_claims: Claims management
-- insurance_media_queue: Document processing

-- Wallet & Transactions
-- ---------------------
-- wallet_ledger: Transaction ledger
-- wallet_balance: User balances
-- referrals: Referral tracking

-- Agent System
-- ------------
-- agent_sessions: AI agent sessions
-- agent_registry: Agent configurations
-- agent_logs: Agent activity logs

-- NOTE: All tables listed above already exist in production.
-- This migration serves as documentation and baseline marker.

SELECT 'Baseline migration - production schema documented' as status;

COMMIT;
