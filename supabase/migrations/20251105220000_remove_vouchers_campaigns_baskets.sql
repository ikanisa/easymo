-- Migration: Remove Vouchers, Campaigns, and Baskets Infrastructure
-- Date: 2025-11-05
-- Reason: Moving to AI-agent-first WhatsApp flow, these features are deprecated

BEGIN;

-- Drop Baskets Infrastructure
DROP TABLE IF EXISTS "public"."baskets_reminder_events" CASCADE;
DROP TABLE IF EXISTS "public"."baskets_reminders" CASCADE;
DROP TABLE IF EXISTS "public"."basket_contributions" CASCADE;
DROP TABLE IF EXISTS "public"."basket_invites" CASCADE;
DROP TABLE IF EXISTS "public"."basket_members" CASCADE;
DROP TABLE IF EXISTS "public"."baskets" CASCADE;

-- Drop Campaigns Infrastructure
DROP TABLE IF EXISTS "public"."campaign_recipients" CASCADE;
DROP TABLE IF EXISTS "public"."campaign_targets" CASCADE;
DROP TABLE IF EXISTS "public"."campaigns" CASCADE;

-- Drop Vouchers Infrastructure
DROP TABLE IF EXISTS "public"."voucher_events" CASCADE;
DROP TABLE IF EXISTS "public"."voucher_redemptions" CASCADE;
DROP TABLE IF EXISTS "public"."vouchers" CASCADE;

-- Drop related functions if they exist
DROP FUNCTION IF EXISTS "public"."get_basket_summary"(uuid) CASCADE;
DROP FUNCTION IF EXISTS "public"."check_voucher_validity"(uuid) CASCADE;
DROP FUNCTION IF EXISTS "public"."redeem_voucher"(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS "public"."create_campaign"(text, jsonb) CASCADE;

COMMIT;
