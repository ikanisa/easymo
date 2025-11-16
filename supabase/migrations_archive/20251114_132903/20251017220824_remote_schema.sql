BEGIN;

create extension if not exists "fuzzystrmatch" with schema "public" version '1.2';

create type "public"."basket_status" as enum ('draft', 'pending_review', 'approved', 'rejected', 'suspended', 'closed');

create type "public"."basket_type" as enum ('public', 'private');

create sequence "public"."campaign_recipients_id_seq";

create sequence "public"."campaigns_id_seq";

create sequence "public"."contacts_id_seq";

create sequence "public"."marketplace_categories_id_seq";

create sequence "public"."segments_id_seq";

create sequence "public"."send_logs_id_seq";

create sequence "public"."send_queue_id_seq";

create sequence "public"."templates_id_seq";

create sequence "public"."wa_inbox_id_seq";

create sequence "public"."wallet_ledger_id_seq";

drop trigger if exists "audit_log_sync_admin_columns" on "public"."audit_log";

drop trigger if exists "bar_numbers_set_digits" on "public"."bar_numbers";

drop trigger if exists "trg_baskets_reminders_touch" on "public"."baskets_reminders";

drop trigger if exists "set_business_categories_updated_at" on "public"."business_categories";

drop trigger if exists "trg_contacts_profile_sync" on "public"."contacts";

drop trigger if exists "notifications_sync_admin_columns" on "public"."notifications";

drop trigger if exists "order_events_sync_admin_columns" on "public"."order_events";

drop trigger if exists "orders_sync_admin_columns" on "public"."orders";

drop trigger if exists "trg_sacco_collateral_refresh" on "public"."sacco_collateral";

drop trigger if exists "trg_sacco_loan_endorsements_touch" on "public"."sacco_loan_endorsements";

drop trigger if exists "trg_sacco_loan_events" on "public"."sacco_loans";

drop trigger if exists "trg_sacco_loans_enforce_ltv" on "public"."sacco_loans";

drop trigger if exists "trg_sacco_loans_touch" on "public"."sacco_loans";

drop trigger if exists "vouchers_sync_admin_columns" on "public"."vouchers";

drop trigger if exists "trg_whatsapp_intents_updated" on "public"."whatsapp_intents";

drop trigger if exists "trg_whatsapp_menu_items_updated" on "public"."whatsapp_menu_items";

drop policy "admin_alert_prefs_owner_delete" on "public"."admin_alert_prefs";

drop policy "admin_alert_prefs_owner_insert" on "public"."admin_alert_prefs";

drop policy "admin_alert_prefs_owner_modify" on "public"."admin_alert_prefs";

drop policy "admin_alert_prefs_owner_select" on "public"."admin_alert_prefs";

drop policy "admin_alert_prefs_service_role" on "public"."admin_alert_prefs";

drop policy "no_public_config" on "public"."app_config";

drop policy "audit_log_delete" on "public"."audit_log";

drop policy "audit_log_insert" on "public"."audit_log";

drop policy "audit_log_select" on "public"."audit_log";

drop policy "no_public_audit" on "public"."audit_logs";

drop policy "basket_invites_admin_staff_rw" on "public"."basket_invites";

drop policy "baskets_reminder_events_admin_staff_rw" on "public"."baskets_reminder_events";

drop policy "baskets_reminders_admin_staff_rw" on "public"."baskets_reminders";

drop policy "campaign_targets_delete" on "public"."campaign_targets";

drop policy "campaign_targets_insert" on "public"."campaign_targets";

drop policy "campaign_targets_select" on "public"."campaign_targets";

drop policy "campaign_targets_update" on "public"."campaign_targets";

drop policy "campaigns_delete" on "public"."campaigns";

drop policy "campaigns_insert" on "public"."campaigns";

drop policy "campaigns_select" on "public"."campaigns";

drop policy "campaigns_update" on "public"."campaigns";

drop policy "no_public_chatstate" on "public"."chat_state";

drop policy "contribution_cycles_admin_staff_rw" on "public"."contribution_cycles";

drop policy "contributions_admin_staff_rw" on "public"."contributions_ledger";

drop policy "contributions_committee_member_select" on "public"."contributions_ledger";

drop policy "no_public_credit_events" on "public"."credit_events";

drop policy "no_public_driver_status" on "public"."driver_status";

drop policy "feature_gate_audit_platform_full" on "public"."feature_gate_audit";

drop policy "ibimina_admin_staff_rw" on "public"."ibimina";

drop policy "ibimina_committee_select" on "public"."ibimina";

drop policy "ibimina_accounts_admin_staff_rw" on "public"."ibimina_accounts";

drop policy "ibimina_committee_admin_staff_rw" on "public"."ibimina_committee";

drop policy "ibimina_members_admin_staff_rw" on "public"."ibimina_members";

drop policy "ibimina_members_committee_select" on "public"."ibimina_members";

drop policy "ibimina_members_member_self_select" on "public"."ibimina_members";

drop policy "ibimina_settings_admin_staff_rw" on "public"."ibimina_settings";

drop policy "idempotency_keys_rw" on "public"."idempotency_keys";

drop policy "insurance_quotes_delete" on "public"."insurance_quotes";

drop policy "insurance_quotes_insert" on "public"."insurance_quotes";

drop policy "insurance_quotes_select" on "public"."insurance_quotes";

drop policy "insurance_quotes_update" on "public"."insurance_quotes";

drop policy "kyc_documents_admin_staff_rw" on "public"."kyc_documents";

drop policy "momo_parsed_admin_staff_rw" on "public"."momo_parsed_txns";

drop policy "momo_sms_admin_staff_rw" on "public"."momo_sms_inbox";

drop policy "momo_unmatched_admin_staff_rw" on "public"."momo_unmatched";

drop policy "notifications_delete" on "public"."notifications";

drop policy "notifications_select" on "public"."notifications";

drop policy "notifications_update" on "public"."notifications";

drop policy "no_public_profiles" on "public"."profiles";

drop policy "qr_tokens_delete" on "public"."qr_tokens";

drop policy "qr_tokens_insert" on "public"."qr_tokens";

drop policy "qr_tokens_select" on "public"."qr_tokens";

drop policy "qr_tokens_update" on "public"."qr_tokens";

drop policy "sacco_collateral_admin_staff_rw" on "public"."sacco_collateral";

drop policy "sacco_loan_endorsements_admin_staff_rw" on "public"."sacco_loan_endorsements";

drop policy "sacco_loan_events_admin_staff_insert" on "public"."sacco_loan_events";

drop policy "sacco_loan_events_admin_staff_select" on "public"."sacco_loan_events";

drop policy "sacco_loan_events_admin_staff_update" on "public"."sacco_loan_events";

drop policy "sacco_loans_admin_staff_rw" on "public"."sacco_loans";

drop policy "sacco_officers_admin_staff_rw" on "public"."sacco_officers";

drop policy "saccos_admin_staff_rw" on "public"."saccos";

drop policy "saccos_committee_select" on "public"."saccos";

drop policy "settings_delete" on "public"."settings";

drop policy "settings_modify" on "public"."settings";

drop policy "settings_select" on "public"."settings";

drop policy "settings_update" on "public"."settings";

drop policy "stations_delete" on "public"."stations";

drop policy "stations_insert" on "public"."stations";

drop policy "stations_select" on "public"."stations";

drop policy "stations_update" on "public"."stations";

drop policy "no_public_subs" on "public"."subscriptions";

drop policy "no_public_trips" on "public"."trips";

drop policy "voucher_events_delete" on "public"."voucher_events";

drop policy "voucher_events_insert" on "public"."voucher_events";

drop policy "voucher_events_select" on "public"."voucher_events";

drop policy "vouchers_delete" on "public"."vouchers";

drop policy "vouchers_insert" on "public"."vouchers";

drop policy "vouchers_select" on "public"."vouchers";

drop policy "vouchers_update" on "public"."vouchers";

drop policy "no_public_waevents" on "public"."wa_events";

drop policy "wallet_accounts_self_select" on "public"."wallet_accounts";

drop policy "wallet_accounts_service_all" on "public"."wallet_accounts";

drop policy "wallet_earn_actions_read" on "public"."wallet_earn_actions";

drop policy "wallet_ledger_self_select" on "public"."wallet_ledger";

drop policy "wallet_ledger_service_all" on "public"."wallet_ledger";

drop policy "wallet_promoters_read" on "public"."wallet_promoters";

drop policy "wallet_redeem_options_read" on "public"."wallet_redeem_options";

drop policy "wallet_transactions_self_select" on "public"."wallet_transactions";

drop policy "wallet_transactions_service_all" on "public"."wallet_transactions";

drop policy "wallet_self_select" on "public"."wallets";

drop policy "wallet_service_all" on "public"."wallets";

drop policy "whatsapp_intents_service_rw" on "public"."whatsapp_intents";

drop policy "whatsapp_menu_items_service_rw" on "public"."whatsapp_menu_items";

drop policy "orders_customer_select" on "public"."orders";

drop policy "sessions_role_rw" on "public"."sessions";

revoke delete on table "public"."admin_alert_prefs" from "anon";

revoke insert on table "public"."admin_alert_prefs" from "anon";

revoke references on table "public"."admin_alert_prefs" from "anon";

revoke select on table "public"."admin_alert_prefs" from "anon";

revoke trigger on table "public"."admin_alert_prefs" from "anon";

revoke truncate on table "public"."admin_alert_prefs" from "anon";

revoke update on table "public"."admin_alert_prefs" from "anon";

revoke delete on table "public"."admin_alert_prefs" from "authenticated";

revoke insert on table "public"."admin_alert_prefs" from "authenticated";

revoke references on table "public"."admin_alert_prefs" from "authenticated";

revoke select on table "public"."admin_alert_prefs" from "authenticated";

revoke trigger on table "public"."admin_alert_prefs" from "authenticated";

revoke truncate on table "public"."admin_alert_prefs" from "authenticated";

revoke update on table "public"."admin_alert_prefs" from "authenticated";

revoke delete on table "public"."admin_alert_prefs" from "service_role";

revoke insert on table "public"."admin_alert_prefs" from "service_role";

revoke references on table "public"."admin_alert_prefs" from "service_role";

revoke select on table "public"."admin_alert_prefs" from "service_role";

revoke trigger on table "public"."admin_alert_prefs" from "service_role";

revoke truncate on table "public"."admin_alert_prefs" from "service_role";

revoke update on table "public"."admin_alert_prefs" from "service_role";

revoke delete on table "public"."admin_audit_log" from "anon";

revoke insert on table "public"."admin_audit_log" from "anon";

revoke references on table "public"."admin_audit_log" from "anon";

revoke select on table "public"."admin_audit_log" from "anon";

revoke trigger on table "public"."admin_audit_log" from "anon";

revoke truncate on table "public"."admin_audit_log" from "anon";

revoke update on table "public"."admin_audit_log" from "anon";

revoke delete on table "public"."admin_audit_log" from "authenticated";

revoke insert on table "public"."admin_audit_log" from "authenticated";

revoke references on table "public"."admin_audit_log" from "authenticated";

revoke select on table "public"."admin_audit_log" from "authenticated";

revoke trigger on table "public"."admin_audit_log" from "authenticated";

revoke truncate on table "public"."admin_audit_log" from "authenticated";

revoke update on table "public"."admin_audit_log" from "authenticated";

revoke delete on table "public"."admin_audit_log" from "service_role";

revoke insert on table "public"."admin_audit_log" from "service_role";

revoke references on table "public"."admin_audit_log" from "service_role";

revoke select on table "public"."admin_audit_log" from "service_role";

revoke trigger on table "public"."admin_audit_log" from "service_role";

revoke truncate on table "public"."admin_audit_log" from "service_role";

revoke update on table "public"."admin_audit_log" from "service_role";

revoke delete on table "public"."admin_pin_sessions" from "anon";

revoke insert on table "public"."admin_pin_sessions" from "anon";

revoke references on table "public"."admin_pin_sessions" from "anon";

revoke select on table "public"."admin_pin_sessions" from "anon";

revoke trigger on table "public"."admin_pin_sessions" from "anon";

revoke truncate on table "public"."admin_pin_sessions" from "anon";

revoke update on table "public"."admin_pin_sessions" from "anon";

revoke delete on table "public"."admin_pin_sessions" from "authenticated";

revoke insert on table "public"."admin_pin_sessions" from "authenticated";

revoke references on table "public"."admin_pin_sessions" from "authenticated";

revoke select on table "public"."admin_pin_sessions" from "authenticated";

revoke trigger on table "public"."admin_pin_sessions" from "authenticated";

revoke truncate on table "public"."admin_pin_sessions" from "authenticated";

revoke update on table "public"."admin_pin_sessions" from "authenticated";

revoke delete on table "public"."admin_pin_sessions" from "service_role";

revoke insert on table "public"."admin_pin_sessions" from "service_role";

revoke references on table "public"."admin_pin_sessions" from "service_role";

revoke select on table "public"."admin_pin_sessions" from "service_role";

revoke trigger on table "public"."admin_pin_sessions" from "service_role";

revoke truncate on table "public"."admin_pin_sessions" from "service_role";

revoke update on table "public"."admin_pin_sessions" from "service_role";

revoke delete on table "public"."admin_sessions" from "anon";

revoke insert on table "public"."admin_sessions" from "anon";

revoke references on table "public"."admin_sessions" from "anon";

revoke select on table "public"."admin_sessions" from "anon";

revoke trigger on table "public"."admin_sessions" from "anon";

revoke truncate on table "public"."admin_sessions" from "anon";

revoke update on table "public"."admin_sessions" from "anon";

revoke delete on table "public"."admin_sessions" from "authenticated";

revoke insert on table "public"."admin_sessions" from "authenticated";

revoke references on table "public"."admin_sessions" from "authenticated";

revoke select on table "public"."admin_sessions" from "authenticated";

revoke trigger on table "public"."admin_sessions" from "authenticated";

revoke truncate on table "public"."admin_sessions" from "authenticated";

revoke update on table "public"."admin_sessions" from "authenticated";

revoke delete on table "public"."admin_sessions" from "service_role";

revoke insert on table "public"."admin_sessions" from "service_role";

revoke references on table "public"."admin_sessions" from "service_role";

revoke select on table "public"."admin_sessions" from "service_role";

revoke trigger on table "public"."admin_sessions" from "service_role";

revoke truncate on table "public"."admin_sessions" from "service_role";

revoke update on table "public"."admin_sessions" from "service_role";

revoke delete on table "public"."admin_submissions" from "anon";

revoke insert on table "public"."admin_submissions" from "anon";

revoke references on table "public"."admin_submissions" from "anon";

revoke select on table "public"."admin_submissions" from "anon";

revoke trigger on table "public"."admin_submissions" from "anon";

revoke truncate on table "public"."admin_submissions" from "anon";

revoke update on table "public"."admin_submissions" from "anon";

revoke delete on table "public"."admin_submissions" from "authenticated";

revoke insert on table "public"."admin_submissions" from "authenticated";

revoke references on table "public"."admin_submissions" from "authenticated";

revoke select on table "public"."admin_submissions" from "authenticated";

revoke trigger on table "public"."admin_submissions" from "authenticated";

revoke truncate on table "public"."admin_submissions" from "authenticated";

revoke update on table "public"."admin_submissions" from "authenticated";

revoke delete on table "public"."admin_submissions" from "service_role";

revoke insert on table "public"."admin_submissions" from "service_role";

revoke references on table "public"."admin_submissions" from "service_role";

revoke select on table "public"."admin_submissions" from "service_role";

revoke trigger on table "public"."admin_submissions" from "service_role";

revoke truncate on table "public"."admin_submissions" from "service_role";

revoke update on table "public"."admin_submissions" from "service_role";

revoke delete on table "public"."app_config" from "anon";

revoke insert on table "public"."app_config" from "anon";

revoke references on table "public"."app_config" from "anon";

revoke select on table "public"."app_config" from "anon";

revoke trigger on table "public"."app_config" from "anon";

revoke truncate on table "public"."app_config" from "anon";

revoke update on table "public"."app_config" from "anon";

revoke delete on table "public"."app_config" from "authenticated";

revoke insert on table "public"."app_config" from "authenticated";

revoke references on table "public"."app_config" from "authenticated";

revoke select on table "public"."app_config" from "authenticated";

revoke trigger on table "public"."app_config" from "authenticated";

revoke truncate on table "public"."app_config" from "authenticated";

revoke update on table "public"."app_config" from "authenticated";

revoke delete on table "public"."app_config" from "service_role";

revoke insert on table "public"."app_config" from "service_role";

revoke references on table "public"."app_config" from "service_role";

revoke select on table "public"."app_config" from "service_role";

revoke trigger on table "public"."app_config" from "service_role";

revoke truncate on table "public"."app_config" from "service_role";

revoke update on table "public"."app_config" from "service_role";

revoke delete on table "public"."audit_log" from "anon";

revoke insert on table "public"."audit_log" from "anon";

revoke references on table "public"."audit_log" from "anon";

revoke select on table "public"."audit_log" from "anon";

revoke trigger on table "public"."audit_log" from "anon";

revoke truncate on table "public"."audit_log" from "anon";

revoke update on table "public"."audit_log" from "anon";

revoke delete on table "public"."audit_log" from "authenticated";

revoke insert on table "public"."audit_log" from "authenticated";

revoke references on table "public"."audit_log" from "authenticated";

revoke select on table "public"."audit_log" from "authenticated";

revoke trigger on table "public"."audit_log" from "authenticated";

revoke truncate on table "public"."audit_log" from "authenticated";

revoke update on table "public"."audit_log" from "authenticated";

revoke delete on table "public"."audit_log" from "service_role";

revoke insert on table "public"."audit_log" from "service_role";

revoke references on table "public"."audit_log" from "service_role";

revoke select on table "public"."audit_log" from "service_role";

revoke trigger on table "public"."audit_log" from "service_role";

revoke truncate on table "public"."audit_log" from "service_role";

revoke update on table "public"."audit_log" from "service_role";

revoke delete on table "public"."audit_logs" from "anon";

revoke insert on table "public"."audit_logs" from "anon";

revoke references on table "public"."audit_logs" from "anon";

revoke select on table "public"."audit_logs" from "anon";

revoke trigger on table "public"."audit_logs" from "anon";

revoke truncate on table "public"."audit_logs" from "anon";

revoke update on table "public"."audit_logs" from "anon";

revoke delete on table "public"."audit_logs" from "authenticated";

revoke insert on table "public"."audit_logs" from "authenticated";

revoke references on table "public"."audit_logs" from "authenticated";

revoke select on table "public"."audit_logs" from "authenticated";

revoke trigger on table "public"."audit_logs" from "authenticated";

revoke truncate on table "public"."audit_logs" from "authenticated";

revoke update on table "public"."audit_logs" from "authenticated";

revoke delete on table "public"."audit_logs" from "service_role";

revoke insert on table "public"."audit_logs" from "service_role";

revoke references on table "public"."audit_logs" from "service_role";

revoke select on table "public"."audit_logs" from "service_role";

revoke trigger on table "public"."audit_logs" from "service_role";

revoke truncate on table "public"."audit_logs" from "service_role";

revoke update on table "public"."audit_logs" from "service_role";

revoke delete on table "public"."bar_number_canonicalization_conflicts" from "anon";

revoke insert on table "public"."bar_number_canonicalization_conflicts" from "anon";

revoke references on table "public"."bar_number_canonicalization_conflicts" from "anon";

revoke select on table "public"."bar_number_canonicalization_conflicts" from "anon";

revoke trigger on table "public"."bar_number_canonicalization_conflicts" from "anon";

revoke truncate on table "public"."bar_number_canonicalization_conflicts" from "anon";

revoke update on table "public"."bar_number_canonicalization_conflicts" from "anon";

revoke delete on table "public"."bar_number_canonicalization_conflicts" from "authenticated";

revoke insert on table "public"."bar_number_canonicalization_conflicts" from "authenticated";

revoke references on table "public"."bar_number_canonicalization_conflicts" from "authenticated";

revoke select on table "public"."bar_number_canonicalization_conflicts" from "authenticated";

revoke trigger on table "public"."bar_number_canonicalization_conflicts" from "authenticated";

revoke truncate on table "public"."bar_number_canonicalization_conflicts" from "authenticated";

revoke update on table "public"."bar_number_canonicalization_conflicts" from "authenticated";

revoke delete on table "public"."bar_number_canonicalization_conflicts" from "service_role";

revoke insert on table "public"."bar_number_canonicalization_conflicts" from "service_role";

revoke references on table "public"."bar_number_canonicalization_conflicts" from "service_role";

revoke select on table "public"."bar_number_canonicalization_conflicts" from "service_role";

revoke trigger on table "public"."bar_number_canonicalization_conflicts" from "service_role";

revoke truncate on table "public"."bar_number_canonicalization_conflicts" from "service_role";

revoke update on table "public"."bar_number_canonicalization_conflicts" from "service_role";

revoke delete on table "public"."bar_numbers" from "anon";

revoke insert on table "public"."bar_numbers" from "anon";

revoke references on table "public"."bar_numbers" from "anon";

revoke select on table "public"."bar_numbers" from "anon";

revoke trigger on table "public"."bar_numbers" from "anon";

revoke truncate on table "public"."bar_numbers" from "anon";

revoke update on table "public"."bar_numbers" from "anon";

revoke delete on table "public"."bar_numbers" from "authenticated";

revoke insert on table "public"."bar_numbers" from "authenticated";

revoke references on table "public"."bar_numbers" from "authenticated";

revoke select on table "public"."bar_numbers" from "authenticated";

revoke trigger on table "public"."bar_numbers" from "authenticated";

revoke truncate on table "public"."bar_numbers" from "authenticated";

revoke update on table "public"."bar_numbers" from "authenticated";

revoke delete on table "public"."bar_numbers" from "service_role";

revoke insert on table "public"."bar_numbers" from "service_role";

revoke references on table "public"."bar_numbers" from "service_role";

revoke select on table "public"."bar_numbers" from "service_role";

revoke trigger on table "public"."bar_numbers" from "service_role";

revoke truncate on table "public"."bar_numbers" from "service_role";

revoke update on table "public"."bar_numbers" from "service_role";

revoke delete on table "public"."bar_settings" from "anon";

revoke insert on table "public"."bar_settings" from "anon";

revoke references on table "public"."bar_settings" from "anon";

revoke select on table "public"."bar_settings" from "anon";

revoke trigger on table "public"."bar_settings" from "anon";

revoke truncate on table "public"."bar_settings" from "anon";

revoke update on table "public"."bar_settings" from "anon";

revoke delete on table "public"."bar_settings" from "authenticated";

revoke insert on table "public"."bar_settings" from "authenticated";

revoke references on table "public"."bar_settings" from "authenticated";

revoke select on table "public"."bar_settings" from "authenticated";

revoke trigger on table "public"."bar_settings" from "authenticated";

revoke truncate on table "public"."bar_settings" from "authenticated";

revoke update on table "public"."bar_settings" from "authenticated";

revoke delete on table "public"."bar_settings" from "service_role";

revoke insert on table "public"."bar_settings" from "service_role";

revoke references on table "public"."bar_settings" from "service_role";

revoke select on table "public"."bar_settings" from "service_role";

revoke trigger on table "public"."bar_settings" from "service_role";

revoke truncate on table "public"."bar_settings" from "service_role";

revoke update on table "public"."bar_settings" from "service_role";

revoke delete on table "public"."bar_tables" from "anon";

revoke insert on table "public"."bar_tables" from "anon";

revoke references on table "public"."bar_tables" from "anon";

revoke select on table "public"."bar_tables" from "anon";

revoke trigger on table "public"."bar_tables" from "anon";

revoke truncate on table "public"."bar_tables" from "anon";

revoke update on table "public"."bar_tables" from "anon";

revoke delete on table "public"."bar_tables" from "authenticated";

revoke insert on table "public"."bar_tables" from "authenticated";

revoke references on table "public"."bar_tables" from "authenticated";

revoke select on table "public"."bar_tables" from "authenticated";

revoke trigger on table "public"."bar_tables" from "authenticated";

revoke truncate on table "public"."bar_tables" from "authenticated";

revoke update on table "public"."bar_tables" from "authenticated";

revoke delete on table "public"."bar_tables" from "service_role";

revoke insert on table "public"."bar_tables" from "service_role";

revoke references on table "public"."bar_tables" from "service_role";

revoke select on table "public"."bar_tables" from "service_role";

revoke trigger on table "public"."bar_tables" from "service_role";

revoke truncate on table "public"."bar_tables" from "service_role";

revoke update on table "public"."bar_tables" from "service_role";

revoke delete on table "public"."bars" from "anon";

revoke insert on table "public"."bars" from "anon";

revoke references on table "public"."bars" from "anon";

revoke select on table "public"."bars" from "anon";

revoke trigger on table "public"."bars" from "anon";

revoke truncate on table "public"."bars" from "anon";

revoke update on table "public"."bars" from "anon";

revoke delete on table "public"."bars" from "authenticated";

revoke insert on table "public"."bars" from "authenticated";

revoke references on table "public"."bars" from "authenticated";

revoke select on table "public"."bars" from "authenticated";

revoke trigger on table "public"."bars" from "authenticated";

revoke truncate on table "public"."bars" from "authenticated";

revoke update on table "public"."bars" from "authenticated";

revoke delete on table "public"."bars" from "service_role";

revoke insert on table "public"."bars" from "service_role";

revoke references on table "public"."bars" from "service_role";

revoke select on table "public"."bars" from "service_role";

revoke trigger on table "public"."bars" from "service_role";

revoke truncate on table "public"."bars" from "service_role";

revoke update on table "public"."bars" from "service_role";

revoke delete on table "public"."basket_contributions" from "anon";

revoke insert on table "public"."basket_contributions" from "anon";

revoke references on table "public"."basket_contributions" from "anon";

revoke select on table "public"."basket_contributions" from "anon";

revoke trigger on table "public"."basket_contributions" from "anon";

revoke truncate on table "public"."basket_contributions" from "anon";

revoke update on table "public"."basket_contributions" from "anon";

revoke delete on table "public"."basket_contributions" from "authenticated";

revoke insert on table "public"."basket_contributions" from "authenticated";

revoke references on table "public"."basket_contributions" from "authenticated";

revoke select on table "public"."basket_contributions" from "authenticated";

revoke trigger on table "public"."basket_contributions" from "authenticated";

revoke truncate on table "public"."basket_contributions" from "authenticated";

revoke update on table "public"."basket_contributions" from "authenticated";

revoke delete on table "public"."basket_contributions" from "service_role";

revoke insert on table "public"."basket_contributions" from "service_role";

revoke references on table "public"."basket_contributions" from "service_role";

revoke select on table "public"."basket_contributions" from "service_role";

revoke trigger on table "public"."basket_contributions" from "service_role";

revoke truncate on table "public"."basket_contributions" from "service_role";

revoke update on table "public"."basket_contributions" from "service_role";

revoke delete on table "public"."basket_invites" from "anon";

revoke insert on table "public"."basket_invites" from "anon";

revoke references on table "public"."basket_invites" from "anon";

revoke select on table "public"."basket_invites" from "anon";

revoke trigger on table "public"."basket_invites" from "anon";

revoke truncate on table "public"."basket_invites" from "anon";

revoke update on table "public"."basket_invites" from "anon";

revoke delete on table "public"."basket_invites" from "authenticated";

revoke insert on table "public"."basket_invites" from "authenticated";

revoke references on table "public"."basket_invites" from "authenticated";

revoke select on table "public"."basket_invites" from "authenticated";

revoke trigger on table "public"."basket_invites" from "authenticated";

revoke truncate on table "public"."basket_invites" from "authenticated";

revoke update on table "public"."basket_invites" from "authenticated";

revoke delete on table "public"."basket_invites" from "service_role";

revoke insert on table "public"."basket_invites" from "service_role";

revoke references on table "public"."basket_invites" from "service_role";

revoke select on table "public"."basket_invites" from "service_role";

revoke trigger on table "public"."basket_invites" from "service_role";

revoke truncate on table "public"."basket_invites" from "service_role";

revoke update on table "public"."basket_invites" from "service_role";

revoke delete on table "public"."basket_members" from "anon";

revoke insert on table "public"."basket_members" from "anon";

revoke references on table "public"."basket_members" from "anon";

revoke select on table "public"."basket_members" from "anon";

revoke trigger on table "public"."basket_members" from "anon";

revoke truncate on table "public"."basket_members" from "anon";

revoke update on table "public"."basket_members" from "anon";

revoke delete on table "public"."basket_members" from "authenticated";

revoke insert on table "public"."basket_members" from "authenticated";

revoke references on table "public"."basket_members" from "authenticated";

revoke select on table "public"."basket_members" from "authenticated";

revoke trigger on table "public"."basket_members" from "authenticated";

revoke truncate on table "public"."basket_members" from "authenticated";

revoke update on table "public"."basket_members" from "authenticated";

revoke delete on table "public"."basket_members" from "service_role";

revoke insert on table "public"."basket_members" from "service_role";

revoke references on table "public"."basket_members" from "service_role";

revoke select on table "public"."basket_members" from "service_role";

revoke trigger on table "public"."basket_members" from "service_role";

revoke truncate on table "public"."basket_members" from "service_role";

revoke update on table "public"."basket_members" from "service_role";

revoke delete on table "public"."baskets" from "anon";

revoke insert on table "public"."baskets" from "anon";

revoke references on table "public"."baskets" from "anon";

revoke select on table "public"."baskets" from "anon";

revoke trigger on table "public"."baskets" from "anon";

revoke truncate on table "public"."baskets" from "anon";

revoke update on table "public"."baskets" from "anon";

revoke delete on table "public"."baskets" from "authenticated";

revoke insert on table "public"."baskets" from "authenticated";

revoke references on table "public"."baskets" from "authenticated";

revoke select on table "public"."baskets" from "authenticated";

revoke trigger on table "public"."baskets" from "authenticated";

revoke truncate on table "public"."baskets" from "authenticated";

revoke update on table "public"."baskets" from "authenticated";

revoke delete on table "public"."baskets" from "service_role";

revoke insert on table "public"."baskets" from "service_role";

revoke references on table "public"."baskets" from "service_role";

revoke select on table "public"."baskets" from "service_role";

revoke trigger on table "public"."baskets" from "service_role";

revoke truncate on table "public"."baskets" from "service_role";

revoke update on table "public"."baskets" from "service_role";

revoke delete on table "public"."baskets_reminder_events" from "anon";

revoke insert on table "public"."baskets_reminder_events" from "anon";

revoke references on table "public"."baskets_reminder_events" from "anon";

revoke select on table "public"."baskets_reminder_events" from "anon";

revoke trigger on table "public"."baskets_reminder_events" from "anon";

revoke truncate on table "public"."baskets_reminder_events" from "anon";

revoke update on table "public"."baskets_reminder_events" from "anon";

revoke delete on table "public"."baskets_reminder_events" from "authenticated";

revoke insert on table "public"."baskets_reminder_events" from "authenticated";

revoke references on table "public"."baskets_reminder_events" from "authenticated";

revoke select on table "public"."baskets_reminder_events" from "authenticated";

revoke trigger on table "public"."baskets_reminder_events" from "authenticated";

revoke truncate on table "public"."baskets_reminder_events" from "authenticated";

revoke update on table "public"."baskets_reminder_events" from "authenticated";

revoke delete on table "public"."baskets_reminder_events" from "service_role";

revoke insert on table "public"."baskets_reminder_events" from "service_role";

revoke references on table "public"."baskets_reminder_events" from "service_role";

revoke select on table "public"."baskets_reminder_events" from "service_role";

revoke trigger on table "public"."baskets_reminder_events" from "service_role";

revoke truncate on table "public"."baskets_reminder_events" from "service_role";

revoke update on table "public"."baskets_reminder_events" from "service_role";

revoke delete on table "public"."baskets_reminders" from "anon";

revoke insert on table "public"."baskets_reminders" from "anon";

revoke references on table "public"."baskets_reminders" from "anon";

revoke select on table "public"."baskets_reminders" from "anon";

revoke trigger on table "public"."baskets_reminders" from "anon";

revoke truncate on table "public"."baskets_reminders" from "anon";

revoke update on table "public"."baskets_reminders" from "anon";

revoke delete on table "public"."baskets_reminders" from "authenticated";

revoke insert on table "public"."baskets_reminders" from "authenticated";

revoke references on table "public"."baskets_reminders" from "authenticated";

revoke select on table "public"."baskets_reminders" from "authenticated";

revoke trigger on table "public"."baskets_reminders" from "authenticated";

revoke truncate on table "public"."baskets_reminders" from "authenticated";

revoke update on table "public"."baskets_reminders" from "authenticated";

revoke delete on table "public"."baskets_reminders" from "service_role";

revoke insert on table "public"."baskets_reminders" from "service_role";

revoke references on table "public"."baskets_reminders" from "service_role";

revoke select on table "public"."baskets_reminders" from "service_role";

revoke trigger on table "public"."baskets_reminders" from "service_role";

revoke truncate on table "public"."baskets_reminders" from "service_role";

revoke update on table "public"."baskets_reminders" from "service_role";

revoke delete on table "public"."business_categories" from "anon";

revoke insert on table "public"."business_categories" from "anon";

revoke references on table "public"."business_categories" from "anon";

revoke select on table "public"."business_categories" from "anon";

revoke trigger on table "public"."business_categories" from "anon";

revoke truncate on table "public"."business_categories" from "anon";

revoke update on table "public"."business_categories" from "anon";

revoke delete on table "public"."business_categories" from "authenticated";

revoke insert on table "public"."business_categories" from "authenticated";

revoke references on table "public"."business_categories" from "authenticated";

revoke select on table "public"."business_categories" from "authenticated";

revoke trigger on table "public"."business_categories" from "authenticated";

revoke truncate on table "public"."business_categories" from "authenticated";

revoke update on table "public"."business_categories" from "authenticated";

revoke delete on table "public"."business_categories" from "service_role";

revoke insert on table "public"."business_categories" from "service_role";

revoke references on table "public"."business_categories" from "service_role";

revoke select on table "public"."business_categories" from "service_role";

revoke trigger on table "public"."business_categories" from "service_role";

revoke truncate on table "public"."business_categories" from "service_role";

revoke update on table "public"."business_categories" from "service_role";

revoke delete on table "public"."businesses" from "anon";

revoke insert on table "public"."businesses" from "anon";

revoke references on table "public"."businesses" from "anon";

revoke select on table "public"."businesses" from "anon";

revoke trigger on table "public"."businesses" from "anon";

revoke truncate on table "public"."businesses" from "anon";

revoke update on table "public"."businesses" from "anon";

revoke delete on table "public"."businesses" from "authenticated";

revoke insert on table "public"."businesses" from "authenticated";

revoke references on table "public"."businesses" from "authenticated";

revoke select on table "public"."businesses" from "authenticated";

revoke trigger on table "public"."businesses" from "authenticated";

revoke truncate on table "public"."businesses" from "authenticated";

revoke update on table "public"."businesses" from "authenticated";

revoke delete on table "public"."businesses" from "service_role";

revoke insert on table "public"."businesses" from "service_role";

revoke references on table "public"."businesses" from "service_role";

revoke select on table "public"."businesses" from "service_role";

revoke trigger on table "public"."businesses" from "service_role";

revoke truncate on table "public"."businesses" from "service_role";

revoke update on table "public"."businesses" from "service_role";

revoke delete on table "public"."campaign_targets" from "anon";

revoke insert on table "public"."campaign_targets" from "anon";

revoke references on table "public"."campaign_targets" from "anon";

revoke select on table "public"."campaign_targets" from "anon";

revoke trigger on table "public"."campaign_targets" from "anon";

revoke truncate on table "public"."campaign_targets" from "anon";

revoke update on table "public"."campaign_targets" from "anon";

revoke delete on table "public"."campaign_targets" from "authenticated";

revoke insert on table "public"."campaign_targets" from "authenticated";

revoke references on table "public"."campaign_targets" from "authenticated";

revoke select on table "public"."campaign_targets" from "authenticated";

revoke trigger on table "public"."campaign_targets" from "authenticated";

revoke truncate on table "public"."campaign_targets" from "authenticated";

revoke update on table "public"."campaign_targets" from "authenticated";

revoke delete on table "public"."campaign_targets" from "service_role";

revoke insert on table "public"."campaign_targets" from "service_role";

revoke references on table "public"."campaign_targets" from "service_role";

revoke select on table "public"."campaign_targets" from "service_role";

revoke trigger on table "public"."campaign_targets" from "service_role";

revoke truncate on table "public"."campaign_targets" from "service_role";

revoke update on table "public"."campaign_targets" from "service_role";

revoke delete on table "public"."campaigns" from "anon";

revoke insert on table "public"."campaigns" from "anon";

revoke references on table "public"."campaigns" from "anon";

revoke select on table "public"."campaigns" from "anon";

revoke trigger on table "public"."campaigns" from "anon";

revoke truncate on table "public"."campaigns" from "anon";

revoke update on table "public"."campaigns" from "anon";

revoke delete on table "public"."campaigns" from "authenticated";

revoke insert on table "public"."campaigns" from "authenticated";

revoke references on table "public"."campaigns" from "authenticated";

revoke select on table "public"."campaigns" from "authenticated";

revoke trigger on table "public"."campaigns" from "authenticated";

revoke truncate on table "public"."campaigns" from "authenticated";

revoke update on table "public"."campaigns" from "authenticated";

revoke delete on table "public"."campaigns" from "service_role";

revoke insert on table "public"."campaigns" from "service_role";

revoke references on table "public"."campaigns" from "service_role";

revoke select on table "public"."campaigns" from "service_role";

revoke trigger on table "public"."campaigns" from "service_role";

revoke truncate on table "public"."campaigns" from "service_role";

revoke update on table "public"."campaigns" from "service_role";

revoke delete on table "public"."cart_items" from "anon";

revoke insert on table "public"."cart_items" from "anon";

revoke references on table "public"."cart_items" from "anon";

revoke select on table "public"."cart_items" from "anon";

revoke trigger on table "public"."cart_items" from "anon";

revoke truncate on table "public"."cart_items" from "anon";

revoke update on table "public"."cart_items" from "anon";

revoke delete on table "public"."cart_items" from "authenticated";

revoke insert on table "public"."cart_items" from "authenticated";

revoke references on table "public"."cart_items" from "authenticated";

revoke select on table "public"."cart_items" from "authenticated";

revoke trigger on table "public"."cart_items" from "authenticated";

revoke truncate on table "public"."cart_items" from "authenticated";

revoke update on table "public"."cart_items" from "authenticated";

revoke delete on table "public"."cart_items" from "service_role";

revoke insert on table "public"."cart_items" from "service_role";

revoke references on table "public"."cart_items" from "service_role";

revoke select on table "public"."cart_items" from "service_role";

revoke trigger on table "public"."cart_items" from "service_role";

revoke truncate on table "public"."cart_items" from "service_role";

revoke update on table "public"."cart_items" from "service_role";

revoke delete on table "public"."carts" from "anon";

revoke insert on table "public"."carts" from "anon";

revoke references on table "public"."carts" from "anon";

revoke select on table "public"."carts" from "anon";

revoke trigger on table "public"."carts" from "anon";

revoke truncate on table "public"."carts" from "anon";

revoke update on table "public"."carts" from "anon";

revoke delete on table "public"."carts" from "authenticated";

revoke insert on table "public"."carts" from "authenticated";

revoke references on table "public"."carts" from "authenticated";

revoke select on table "public"."carts" from "authenticated";

revoke trigger on table "public"."carts" from "authenticated";

revoke truncate on table "public"."carts" from "authenticated";

revoke update on table "public"."carts" from "authenticated";

revoke delete on table "public"."carts" from "service_role";

revoke insert on table "public"."carts" from "service_role";

revoke references on table "public"."carts" from "service_role";

revoke select on table "public"."carts" from "service_role";

revoke trigger on table "public"."carts" from "service_role";

revoke truncate on table "public"."carts" from "service_role";

revoke update on table "public"."carts" from "service_role";

revoke delete on table "public"."categories" from "anon";

revoke insert on table "public"."categories" from "anon";

revoke references on table "public"."categories" from "anon";

revoke select on table "public"."categories" from "anon";

revoke trigger on table "public"."categories" from "anon";

revoke truncate on table "public"."categories" from "anon";

revoke update on table "public"."categories" from "anon";

revoke delete on table "public"."categories" from "authenticated";

revoke insert on table "public"."categories" from "authenticated";

revoke references on table "public"."categories" from "authenticated";

revoke select on table "public"."categories" from "authenticated";

revoke trigger on table "public"."categories" from "authenticated";

revoke truncate on table "public"."categories" from "authenticated";

revoke update on table "public"."categories" from "authenticated";

revoke delete on table "public"."categories" from "service_role";

revoke insert on table "public"."categories" from "service_role";

revoke references on table "public"."categories" from "service_role";

revoke select on table "public"."categories" from "service_role";

revoke trigger on table "public"."categories" from "service_role";

revoke truncate on table "public"."categories" from "service_role";

revoke update on table "public"."categories" from "service_role";

revoke delete on table "public"."chat_state" from "anon";

revoke insert on table "public"."chat_state" from "anon";

revoke references on table "public"."chat_state" from "anon";

revoke select on table "public"."chat_state" from "anon";

revoke trigger on table "public"."chat_state" from "anon";

revoke truncate on table "public"."chat_state" from "anon";

revoke update on table "public"."chat_state" from "anon";

revoke delete on table "public"."chat_state" from "authenticated";

revoke insert on table "public"."chat_state" from "authenticated";

revoke references on table "public"."chat_state" from "authenticated";

revoke select on table "public"."chat_state" from "authenticated";

revoke trigger on table "public"."chat_state" from "authenticated";

revoke truncate on table "public"."chat_state" from "authenticated";

revoke update on table "public"."chat_state" from "authenticated";

revoke delete on table "public"."chat_state" from "service_role";

revoke insert on table "public"."chat_state" from "service_role";

revoke references on table "public"."chat_state" from "service_role";

revoke select on table "public"."chat_state" from "service_role";

revoke trigger on table "public"."chat_state" from "service_role";

revoke truncate on table "public"."chat_state" from "service_role";

revoke update on table "public"."chat_state" from "service_role";

revoke delete on table "public"."contacts" from "anon";

revoke insert on table "public"."contacts" from "anon";

revoke references on table "public"."contacts" from "anon";

revoke select on table "public"."contacts" from "anon";

revoke trigger on table "public"."contacts" from "anon";

revoke truncate on table "public"."contacts" from "anon";

revoke update on table "public"."contacts" from "anon";

revoke delete on table "public"."contacts" from "authenticated";

revoke insert on table "public"."contacts" from "authenticated";

revoke references on table "public"."contacts" from "authenticated";

revoke select on table "public"."contacts" from "authenticated";

revoke trigger on table "public"."contacts" from "authenticated";

revoke truncate on table "public"."contacts" from "authenticated";

revoke update on table "public"."contacts" from "authenticated";

revoke delete on table "public"."contacts" from "service_role";

revoke insert on table "public"."contacts" from "service_role";

revoke references on table "public"."contacts" from "service_role";

revoke select on table "public"."contacts" from "service_role";

revoke trigger on table "public"."contacts" from "service_role";

revoke truncate on table "public"."contacts" from "service_role";

revoke update on table "public"."contacts" from "service_role";

revoke delete on table "public"."contribution_cycles" from "anon";

revoke insert on table "public"."contribution_cycles" from "anon";

revoke references on table "public"."contribution_cycles" from "anon";

revoke select on table "public"."contribution_cycles" from "anon";

revoke trigger on table "public"."contribution_cycles" from "anon";

revoke truncate on table "public"."contribution_cycles" from "anon";

revoke update on table "public"."contribution_cycles" from "anon";

revoke delete on table "public"."contribution_cycles" from "authenticated";

revoke insert on table "public"."contribution_cycles" from "authenticated";

revoke references on table "public"."contribution_cycles" from "authenticated";

revoke select on table "public"."contribution_cycles" from "authenticated";

revoke trigger on table "public"."contribution_cycles" from "authenticated";

revoke truncate on table "public"."contribution_cycles" from "authenticated";

revoke update on table "public"."contribution_cycles" from "authenticated";

revoke delete on table "public"."contribution_cycles" from "service_role";

revoke insert on table "public"."contribution_cycles" from "service_role";

revoke references on table "public"."contribution_cycles" from "service_role";

revoke select on table "public"."contribution_cycles" from "service_role";

revoke trigger on table "public"."contribution_cycles" from "service_role";

revoke truncate on table "public"."contribution_cycles" from "service_role";

revoke update on table "public"."contribution_cycles" from "service_role";

revoke delete on table "public"."contributions_ledger" from "anon";

revoke insert on table "public"."contributions_ledger" from "anon";

revoke references on table "public"."contributions_ledger" from "anon";

revoke select on table "public"."contributions_ledger" from "anon";

revoke trigger on table "public"."contributions_ledger" from "anon";

revoke truncate on table "public"."contributions_ledger" from "anon";

revoke update on table "public"."contributions_ledger" from "anon";

revoke delete on table "public"."contributions_ledger" from "authenticated";

revoke insert on table "public"."contributions_ledger" from "authenticated";

revoke references on table "public"."contributions_ledger" from "authenticated";

revoke select on table "public"."contributions_ledger" from "authenticated";

revoke trigger on table "public"."contributions_ledger" from "authenticated";

revoke truncate on table "public"."contributions_ledger" from "authenticated";

revoke update on table "public"."contributions_ledger" from "authenticated";

revoke delete on table "public"."contributions_ledger" from "service_role";

revoke insert on table "public"."contributions_ledger" from "service_role";

revoke references on table "public"."contributions_ledger" from "service_role";

revoke select on table "public"."contributions_ledger" from "service_role";

revoke trigger on table "public"."contributions_ledger" from "service_role";

revoke truncate on table "public"."contributions_ledger" from "service_role";

revoke update on table "public"."contributions_ledger" from "service_role";

revoke delete on table "public"."credit_events" from "anon";

revoke insert on table "public"."credit_events" from "anon";

revoke references on table "public"."credit_events" from "anon";

revoke select on table "public"."credit_events" from "anon";

revoke trigger on table "public"."credit_events" from "anon";

revoke truncate on table "public"."credit_events" from "anon";

revoke update on table "public"."credit_events" from "anon";

revoke delete on table "public"."credit_events" from "authenticated";

revoke insert on table "public"."credit_events" from "authenticated";

revoke references on table "public"."credit_events" from "authenticated";

revoke select on table "public"."credit_events" from "authenticated";

revoke trigger on table "public"."credit_events" from "authenticated";

revoke truncate on table "public"."credit_events" from "authenticated";

revoke update on table "public"."credit_events" from "authenticated";

revoke delete on table "public"."credit_events" from "service_role";

revoke insert on table "public"."credit_events" from "service_role";

revoke references on table "public"."credit_events" from "service_role";

revoke select on table "public"."credit_events" from "service_role";

revoke trigger on table "public"."credit_events" from "service_role";

revoke truncate on table "public"."credit_events" from "service_role";

revoke update on table "public"."credit_events" from "service_role";

revoke delete on table "public"."deeplink_events" from "anon";

revoke insert on table "public"."deeplink_events" from "anon";

revoke references on table "public"."deeplink_events" from "anon";

revoke select on table "public"."deeplink_events" from "anon";

revoke trigger on table "public"."deeplink_events" from "anon";

revoke truncate on table "public"."deeplink_events" from "anon";

revoke update on table "public"."deeplink_events" from "anon";

revoke delete on table "public"."deeplink_events" from "authenticated";

revoke insert on table "public"."deeplink_events" from "authenticated";

revoke references on table "public"."deeplink_events" from "authenticated";

revoke select on table "public"."deeplink_events" from "authenticated";

revoke trigger on table "public"."deeplink_events" from "authenticated";

revoke truncate on table "public"."deeplink_events" from "authenticated";

revoke update on table "public"."deeplink_events" from "authenticated";

revoke delete on table "public"."deeplink_events" from "service_role";

revoke insert on table "public"."deeplink_events" from "service_role";

revoke references on table "public"."deeplink_events" from "service_role";

revoke select on table "public"."deeplink_events" from "service_role";

revoke trigger on table "public"."deeplink_events" from "service_role";

revoke truncate on table "public"."deeplink_events" from "service_role";

revoke update on table "public"."deeplink_events" from "service_role";

revoke delete on table "public"."deeplink_tokens" from "anon";

revoke insert on table "public"."deeplink_tokens" from "anon";

revoke references on table "public"."deeplink_tokens" from "anon";

revoke select on table "public"."deeplink_tokens" from "anon";

revoke trigger on table "public"."deeplink_tokens" from "anon";

revoke truncate on table "public"."deeplink_tokens" from "anon";

revoke update on table "public"."deeplink_tokens" from "anon";

revoke delete on table "public"."deeplink_tokens" from "authenticated";

revoke insert on table "public"."deeplink_tokens" from "authenticated";

revoke references on table "public"."deeplink_tokens" from "authenticated";

revoke select on table "public"."deeplink_tokens" from "authenticated";

revoke trigger on table "public"."deeplink_tokens" from "authenticated";

revoke truncate on table "public"."deeplink_tokens" from "authenticated";

revoke update on table "public"."deeplink_tokens" from "authenticated";

revoke delete on table "public"."deeplink_tokens" from "service_role";

revoke insert on table "public"."deeplink_tokens" from "service_role";

revoke references on table "public"."deeplink_tokens" from "service_role";

revoke select on table "public"."deeplink_tokens" from "service_role";

revoke trigger on table "public"."deeplink_tokens" from "service_role";

revoke truncate on table "public"."deeplink_tokens" from "service_role";

revoke update on table "public"."deeplink_tokens" from "service_role";

revoke delete on table "public"."driver_status" from "anon";

revoke insert on table "public"."driver_status" from "anon";

revoke references on table "public"."driver_status" from "anon";

revoke select on table "public"."driver_status" from "anon";

revoke trigger on table "public"."driver_status" from "anon";

revoke truncate on table "public"."driver_status" from "anon";

revoke update on table "public"."driver_status" from "anon";

revoke delete on table "public"."driver_status" from "authenticated";

revoke insert on table "public"."driver_status" from "authenticated";

revoke references on table "public"."driver_status" from "authenticated";

revoke select on table "public"."driver_status" from "authenticated";

revoke trigger on table "public"."driver_status" from "authenticated";

revoke truncate on table "public"."driver_status" from "authenticated";

revoke update on table "public"."driver_status" from "authenticated";

revoke delete on table "public"."driver_status" from "service_role";

revoke insert on table "public"."driver_status" from "service_role";

revoke references on table "public"."driver_status" from "service_role";

revoke select on table "public"."driver_status" from "service_role";

revoke trigger on table "public"."driver_status" from "service_role";

revoke truncate on table "public"."driver_status" from "service_role";

revoke update on table "public"."driver_status" from "service_role";

revoke delete on table "public"."feature_gate_audit" from "anon";

revoke insert on table "public"."feature_gate_audit" from "anon";

revoke references on table "public"."feature_gate_audit" from "anon";

revoke select on table "public"."feature_gate_audit" from "anon";

revoke trigger on table "public"."feature_gate_audit" from "anon";

revoke truncate on table "public"."feature_gate_audit" from "anon";

revoke update on table "public"."feature_gate_audit" from "anon";

revoke delete on table "public"."feature_gate_audit" from "authenticated";

revoke insert on table "public"."feature_gate_audit" from "authenticated";

revoke references on table "public"."feature_gate_audit" from "authenticated";

revoke select on table "public"."feature_gate_audit" from "authenticated";

revoke trigger on table "public"."feature_gate_audit" from "authenticated";

revoke truncate on table "public"."feature_gate_audit" from "authenticated";

revoke update on table "public"."feature_gate_audit" from "authenticated";

revoke delete on table "public"."feature_gate_audit" from "service_role";

revoke insert on table "public"."feature_gate_audit" from "service_role";

revoke references on table "public"."feature_gate_audit" from "service_role";

revoke select on table "public"."feature_gate_audit" from "service_role";

revoke trigger on table "public"."feature_gate_audit" from "service_role";

revoke truncate on table "public"."feature_gate_audit" from "service_role";

revoke update on table "public"."feature_gate_audit" from "service_role";

revoke delete on table "public"."flow_submissions" from "anon";

revoke insert on table "public"."flow_submissions" from "anon";

revoke references on table "public"."flow_submissions" from "anon";

revoke select on table "public"."flow_submissions" from "anon";

revoke trigger on table "public"."flow_submissions" from "anon";

revoke truncate on table "public"."flow_submissions" from "anon";

revoke update on table "public"."flow_submissions" from "anon";

revoke delete on table "public"."flow_submissions" from "authenticated";

revoke insert on table "public"."flow_submissions" from "authenticated";

revoke references on table "public"."flow_submissions" from "authenticated";

revoke select on table "public"."flow_submissions" from "authenticated";

revoke trigger on table "public"."flow_submissions" from "authenticated";

revoke truncate on table "public"."flow_submissions" from "authenticated";

revoke update on table "public"."flow_submissions" from "authenticated";

revoke delete on table "public"."flow_submissions" from "service_role";

revoke insert on table "public"."flow_submissions" from "service_role";

revoke references on table "public"."flow_submissions" from "service_role";

revoke select on table "public"."flow_submissions" from "service_role";

revoke trigger on table "public"."flow_submissions" from "service_role";

revoke truncate on table "public"."flow_submissions" from "service_role";

revoke update on table "public"."flow_submissions" from "service_role";

revoke delete on table "public"."ibimina" from "anon";

revoke insert on table "public"."ibimina" from "anon";

revoke references on table "public"."ibimina" from "anon";

revoke select on table "public"."ibimina" from "anon";

revoke trigger on table "public"."ibimina" from "anon";

revoke truncate on table "public"."ibimina" from "anon";

revoke update on table "public"."ibimina" from "anon";

revoke delete on table "public"."ibimina" from "authenticated";

revoke insert on table "public"."ibimina" from "authenticated";

revoke references on table "public"."ibimina" from "authenticated";

revoke select on table "public"."ibimina" from "authenticated";

revoke trigger on table "public"."ibimina" from "authenticated";

revoke truncate on table "public"."ibimina" from "authenticated";

revoke update on table "public"."ibimina" from "authenticated";

revoke delete on table "public"."ibimina" from "service_role";

revoke insert on table "public"."ibimina" from "service_role";

revoke references on table "public"."ibimina" from "service_role";

revoke select on table "public"."ibimina" from "service_role";

revoke trigger on table "public"."ibimina" from "service_role";

revoke truncate on table "public"."ibimina" from "service_role";

revoke update on table "public"."ibimina" from "service_role";

revoke delete on table "public"."ibimina_accounts" from "anon";

revoke insert on table "public"."ibimina_accounts" from "anon";

revoke references on table "public"."ibimina_accounts" from "anon";

revoke select on table "public"."ibimina_accounts" from "anon";

revoke trigger on table "public"."ibimina_accounts" from "anon";

revoke truncate on table "public"."ibimina_accounts" from "anon";

revoke update on table "public"."ibimina_accounts" from "anon";

revoke delete on table "public"."ibimina_accounts" from "authenticated";

revoke insert on table "public"."ibimina_accounts" from "authenticated";

revoke references on table "public"."ibimina_accounts" from "authenticated";

revoke select on table "public"."ibimina_accounts" from "authenticated";

revoke trigger on table "public"."ibimina_accounts" from "authenticated";

revoke truncate on table "public"."ibimina_accounts" from "authenticated";

revoke update on table "public"."ibimina_accounts" from "authenticated";

revoke delete on table "public"."ibimina_accounts" from "service_role";

revoke insert on table "public"."ibimina_accounts" from "service_role";

revoke references on table "public"."ibimina_accounts" from "service_role";

revoke select on table "public"."ibimina_accounts" from "service_role";

revoke trigger on table "public"."ibimina_accounts" from "service_role";

revoke truncate on table "public"."ibimina_accounts" from "service_role";

revoke update on table "public"."ibimina_accounts" from "service_role";

revoke delete on table "public"."ibimina_committee" from "anon";

revoke insert on table "public"."ibimina_committee" from "anon";

revoke references on table "public"."ibimina_committee" from "anon";

revoke select on table "public"."ibimina_committee" from "anon";

revoke trigger on table "public"."ibimina_committee" from "anon";

revoke truncate on table "public"."ibimina_committee" from "anon";

revoke update on table "public"."ibimina_committee" from "anon";

revoke delete on table "public"."ibimina_committee" from "authenticated";

revoke insert on table "public"."ibimina_committee" from "authenticated";

revoke references on table "public"."ibimina_committee" from "authenticated";

revoke select on table "public"."ibimina_committee" from "authenticated";

revoke trigger on table "public"."ibimina_committee" from "authenticated";

revoke truncate on table "public"."ibimina_committee" from "authenticated";

revoke update on table "public"."ibimina_committee" from "authenticated";

revoke delete on table "public"."ibimina_committee" from "service_role";

revoke insert on table "public"."ibimina_committee" from "service_role";

revoke references on table "public"."ibimina_committee" from "service_role";

revoke select on table "public"."ibimina_committee" from "service_role";

revoke trigger on table "public"."ibimina_committee" from "service_role";

revoke truncate on table "public"."ibimina_committee" from "service_role";

revoke update on table "public"."ibimina_committee" from "service_role";

revoke delete on table "public"."ibimina_members" from "anon";

revoke insert on table "public"."ibimina_members" from "anon";

revoke references on table "public"."ibimina_members" from "anon";

revoke select on table "public"."ibimina_members" from "anon";

revoke trigger on table "public"."ibimina_members" from "anon";

revoke truncate on table "public"."ibimina_members" from "anon";

revoke update on table "public"."ibimina_members" from "anon";

revoke delete on table "public"."ibimina_members" from "authenticated";

revoke insert on table "public"."ibimina_members" from "authenticated";

revoke references on table "public"."ibimina_members" from "authenticated";

revoke select on table "public"."ibimina_members" from "authenticated";

revoke trigger on table "public"."ibimina_members" from "authenticated";

revoke truncate on table "public"."ibimina_members" from "authenticated";

revoke update on table "public"."ibimina_members" from "authenticated";

revoke delete on table "public"."ibimina_members" from "service_role";

revoke insert on table "public"."ibimina_members" from "service_role";

revoke references on table "public"."ibimina_members" from "service_role";

revoke select on table "public"."ibimina_members" from "service_role";

revoke trigger on table "public"."ibimina_members" from "service_role";

revoke truncate on table "public"."ibimina_members" from "service_role";

revoke update on table "public"."ibimina_members" from "service_role";

revoke delete on table "public"."ibimina_settings" from "anon";

revoke insert on table "public"."ibimina_settings" from "anon";

revoke references on table "public"."ibimina_settings" from "anon";

revoke select on table "public"."ibimina_settings" from "anon";

revoke trigger on table "public"."ibimina_settings" from "anon";

revoke truncate on table "public"."ibimina_settings" from "anon";

revoke update on table "public"."ibimina_settings" from "anon";

revoke delete on table "public"."ibimina_settings" from "authenticated";

revoke insert on table "public"."ibimina_settings" from "authenticated";

revoke references on table "public"."ibimina_settings" from "authenticated";

revoke select on table "public"."ibimina_settings" from "authenticated";

revoke trigger on table "public"."ibimina_settings" from "authenticated";

revoke truncate on table "public"."ibimina_settings" from "authenticated";

revoke update on table "public"."ibimina_settings" from "authenticated";

revoke delete on table "public"."ibimina_settings" from "service_role";

revoke insert on table "public"."ibimina_settings" from "service_role";

revoke references on table "public"."ibimina_settings" from "service_role";

revoke select on table "public"."ibimina_settings" from "service_role";

revoke trigger on table "public"."ibimina_settings" from "service_role";

revoke truncate on table "public"."ibimina_settings" from "service_role";

revoke update on table "public"."ibimina_settings" from "service_role";

revoke delete on table "public"."idempotency_keys" from "anon";

revoke insert on table "public"."idempotency_keys" from "anon";

revoke references on table "public"."idempotency_keys" from "anon";

revoke select on table "public"."idempotency_keys" from "anon";

revoke trigger on table "public"."idempotency_keys" from "anon";

revoke truncate on table "public"."idempotency_keys" from "anon";

revoke update on table "public"."idempotency_keys" from "anon";

revoke delete on table "public"."idempotency_keys" from "authenticated";

revoke insert on table "public"."idempotency_keys" from "authenticated";

revoke references on table "public"."idempotency_keys" from "authenticated";

revoke select on table "public"."idempotency_keys" from "authenticated";

revoke trigger on table "public"."idempotency_keys" from "authenticated";

revoke truncate on table "public"."idempotency_keys" from "authenticated";

revoke update on table "public"."idempotency_keys" from "authenticated";

revoke delete on table "public"."idempotency_keys" from "service_role";

revoke insert on table "public"."idempotency_keys" from "service_role";

revoke references on table "public"."idempotency_keys" from "service_role";

revoke select on table "public"."idempotency_keys" from "service_role";

revoke trigger on table "public"."idempotency_keys" from "service_role";

revoke truncate on table "public"."idempotency_keys" from "service_role";

revoke update on table "public"."idempotency_keys" from "service_role";

revoke delete on table "public"."insurance_leads" from "anon";

revoke insert on table "public"."insurance_leads" from "anon";

revoke references on table "public"."insurance_leads" from "anon";

revoke select on table "public"."insurance_leads" from "anon";

revoke trigger on table "public"."insurance_leads" from "anon";

revoke truncate on table "public"."insurance_leads" from "anon";

revoke update on table "public"."insurance_leads" from "anon";

revoke delete on table "public"."insurance_leads" from "authenticated";

revoke insert on table "public"."insurance_leads" from "authenticated";

revoke references on table "public"."insurance_leads" from "authenticated";

revoke select on table "public"."insurance_leads" from "authenticated";

revoke trigger on table "public"."insurance_leads" from "authenticated";

revoke truncate on table "public"."insurance_leads" from "authenticated";

revoke update on table "public"."insurance_leads" from "authenticated";

revoke delete on table "public"."insurance_leads" from "service_role";

revoke insert on table "public"."insurance_leads" from "service_role";

revoke references on table "public"."insurance_leads" from "service_role";

revoke select on table "public"."insurance_leads" from "service_role";

revoke trigger on table "public"."insurance_leads" from "service_role";

revoke truncate on table "public"."insurance_leads" from "service_role";

revoke update on table "public"."insurance_leads" from "service_role";

revoke delete on table "public"."insurance_media_queue" from "anon";

revoke insert on table "public"."insurance_media_queue" from "anon";

revoke references on table "public"."insurance_media_queue" from "anon";

revoke select on table "public"."insurance_media_queue" from "anon";

revoke trigger on table "public"."insurance_media_queue" from "anon";

revoke truncate on table "public"."insurance_media_queue" from "anon";

revoke update on table "public"."insurance_media_queue" from "anon";

revoke delete on table "public"."insurance_media_queue" from "authenticated";

revoke insert on table "public"."insurance_media_queue" from "authenticated";

revoke references on table "public"."insurance_media_queue" from "authenticated";

revoke select on table "public"."insurance_media_queue" from "authenticated";

revoke trigger on table "public"."insurance_media_queue" from "authenticated";

revoke truncate on table "public"."insurance_media_queue" from "authenticated";

revoke update on table "public"."insurance_media_queue" from "authenticated";

revoke delete on table "public"."insurance_media_queue" from "service_role";

revoke insert on table "public"."insurance_media_queue" from "service_role";

revoke references on table "public"."insurance_media_queue" from "service_role";

revoke select on table "public"."insurance_media_queue" from "service_role";

revoke trigger on table "public"."insurance_media_queue" from "service_role";

revoke truncate on table "public"."insurance_media_queue" from "service_role";

revoke update on table "public"."insurance_media_queue" from "service_role";

revoke delete on table "public"."insurance_quotes" from "anon";

revoke insert on table "public"."insurance_quotes" from "anon";

revoke references on table "public"."insurance_quotes" from "anon";

revoke select on table "public"."insurance_quotes" from "anon";

revoke trigger on table "public"."insurance_quotes" from "anon";

revoke truncate on table "public"."insurance_quotes" from "anon";

revoke update on table "public"."insurance_quotes" from "anon";

revoke delete on table "public"."insurance_quotes" from "authenticated";

revoke insert on table "public"."insurance_quotes" from "authenticated";

revoke references on table "public"."insurance_quotes" from "authenticated";

revoke select on table "public"."insurance_quotes" from "authenticated";

revoke trigger on table "public"."insurance_quotes" from "authenticated";

revoke truncate on table "public"."insurance_quotes" from "authenticated";

revoke update on table "public"."insurance_quotes" from "authenticated";

revoke delete on table "public"."insurance_quotes" from "service_role";

revoke insert on table "public"."insurance_quotes" from "service_role";

revoke references on table "public"."insurance_quotes" from "service_role";

revoke select on table "public"."insurance_quotes" from "service_role";

revoke trigger on table "public"."insurance_quotes" from "service_role";

revoke truncate on table "public"."insurance_quotes" from "service_role";

revoke update on table "public"."insurance_quotes" from "service_role";

revoke delete on table "public"."item_modifiers" from "anon";

revoke insert on table "public"."item_modifiers" from "anon";

revoke references on table "public"."item_modifiers" from "anon";

revoke select on table "public"."item_modifiers" from "anon";

revoke trigger on table "public"."item_modifiers" from "anon";

revoke truncate on table "public"."item_modifiers" from "anon";

revoke update on table "public"."item_modifiers" from "anon";

revoke delete on table "public"."item_modifiers" from "authenticated";

revoke insert on table "public"."item_modifiers" from "authenticated";

revoke references on table "public"."item_modifiers" from "authenticated";

revoke select on table "public"."item_modifiers" from "authenticated";

revoke trigger on table "public"."item_modifiers" from "authenticated";

revoke truncate on table "public"."item_modifiers" from "authenticated";

revoke update on table "public"."item_modifiers" from "authenticated";

revoke delete on table "public"."item_modifiers" from "service_role";

revoke insert on table "public"."item_modifiers" from "service_role";

revoke references on table "public"."item_modifiers" from "service_role";

revoke select on table "public"."item_modifiers" from "service_role";

revoke trigger on table "public"."item_modifiers" from "service_role";

revoke truncate on table "public"."item_modifiers" from "service_role";

revoke update on table "public"."item_modifiers" from "service_role";

revoke delete on table "public"."items" from "anon";

revoke insert on table "public"."items" from "anon";

revoke references on table "public"."items" from "anon";

revoke select on table "public"."items" from "anon";

revoke trigger on table "public"."items" from "anon";

revoke truncate on table "public"."items" from "anon";

revoke update on table "public"."items" from "anon";

revoke delete on table "public"."items" from "authenticated";

revoke insert on table "public"."items" from "authenticated";

revoke references on table "public"."items" from "authenticated";

revoke select on table "public"."items" from "authenticated";

revoke trigger on table "public"."items" from "authenticated";

revoke truncate on table "public"."items" from "authenticated";

revoke update on table "public"."items" from "authenticated";

revoke delete on table "public"."items" from "service_role";

revoke insert on table "public"."items" from "service_role";

revoke references on table "public"."items" from "service_role";

revoke select on table "public"."items" from "service_role";

revoke trigger on table "public"."items" from "service_role";

revoke truncate on table "public"."items" from "service_role";

revoke update on table "public"."items" from "service_role";

revoke delete on table "public"."kyc_documents" from "anon";

revoke insert on table "public"."kyc_documents" from "anon";

revoke references on table "public"."kyc_documents" from "anon";

revoke select on table "public"."kyc_documents" from "anon";

revoke trigger on table "public"."kyc_documents" from "anon";

revoke truncate on table "public"."kyc_documents" from "anon";

revoke update on table "public"."kyc_documents" from "anon";

revoke delete on table "public"."kyc_documents" from "authenticated";

revoke insert on table "public"."kyc_documents" from "authenticated";

revoke references on table "public"."kyc_documents" from "authenticated";

revoke select on table "public"."kyc_documents" from "authenticated";

revoke trigger on table "public"."kyc_documents" from "authenticated";

revoke truncate on table "public"."kyc_documents" from "authenticated";

revoke update on table "public"."kyc_documents" from "authenticated";

revoke delete on table "public"."kyc_documents" from "service_role";

revoke insert on table "public"."kyc_documents" from "service_role";

revoke references on table "public"."kyc_documents" from "service_role";

revoke select on table "public"."kyc_documents" from "service_role";

revoke trigger on table "public"."kyc_documents" from "service_role";

revoke truncate on table "public"."kyc_documents" from "service_role";

revoke update on table "public"."kyc_documents" from "service_role";

revoke delete on table "public"."leaderboard_snapshots" from "anon";

revoke insert on table "public"."leaderboard_snapshots" from "anon";

revoke references on table "public"."leaderboard_snapshots" from "anon";

revoke select on table "public"."leaderboard_snapshots" from "anon";

revoke trigger on table "public"."leaderboard_snapshots" from "anon";

revoke truncate on table "public"."leaderboard_snapshots" from "anon";

revoke update on table "public"."leaderboard_snapshots" from "anon";

revoke delete on table "public"."leaderboard_snapshots" from "authenticated";

revoke insert on table "public"."leaderboard_snapshots" from "authenticated";

revoke references on table "public"."leaderboard_snapshots" from "authenticated";

revoke select on table "public"."leaderboard_snapshots" from "authenticated";

revoke trigger on table "public"."leaderboard_snapshots" from "authenticated";

revoke truncate on table "public"."leaderboard_snapshots" from "authenticated";

revoke update on table "public"."leaderboard_snapshots" from "authenticated";

revoke delete on table "public"."leaderboard_snapshots" from "service_role";

revoke insert on table "public"."leaderboard_snapshots" from "service_role";

revoke references on table "public"."leaderboard_snapshots" from "service_role";

revoke select on table "public"."leaderboard_snapshots" from "service_role";

revoke trigger on table "public"."leaderboard_snapshots" from "service_role";

revoke truncate on table "public"."leaderboard_snapshots" from "service_role";

revoke update on table "public"."leaderboard_snapshots" from "service_role";

revoke delete on table "public"."marketplace_categories" from "anon";

revoke insert on table "public"."marketplace_categories" from "anon";

revoke references on table "public"."marketplace_categories" from "anon";

revoke select on table "public"."marketplace_categories" from "anon";

revoke trigger on table "public"."marketplace_categories" from "anon";

revoke truncate on table "public"."marketplace_categories" from "anon";

revoke update on table "public"."marketplace_categories" from "anon";

revoke delete on table "public"."marketplace_categories" from "authenticated";

revoke insert on table "public"."marketplace_categories" from "authenticated";

revoke references on table "public"."marketplace_categories" from "authenticated";

revoke select on table "public"."marketplace_categories" from "authenticated";

revoke trigger on table "public"."marketplace_categories" from "authenticated";

revoke truncate on table "public"."marketplace_categories" from "authenticated";

revoke update on table "public"."marketplace_categories" from "authenticated";

revoke delete on table "public"."marketplace_categories" from "service_role";

revoke insert on table "public"."marketplace_categories" from "service_role";

revoke references on table "public"."marketplace_categories" from "service_role";

revoke select on table "public"."marketplace_categories" from "service_role";

revoke trigger on table "public"."marketplace_categories" from "service_role";

revoke truncate on table "public"."marketplace_categories" from "service_role";

revoke update on table "public"."marketplace_categories" from "service_role";

revoke delete on table "public"."menus" from "anon";

revoke insert on table "public"."menus" from "anon";

revoke references on table "public"."menus" from "anon";

revoke select on table "public"."menus" from "anon";

revoke trigger on table "public"."menus" from "anon";

revoke truncate on table "public"."menus" from "anon";

revoke update on table "public"."menus" from "anon";

revoke delete on table "public"."menus" from "authenticated";

revoke insert on table "public"."menus" from "authenticated";

revoke references on table "public"."menus" from "authenticated";

revoke select on table "public"."menus" from "authenticated";

revoke trigger on table "public"."menus" from "authenticated";

revoke truncate on table "public"."menus" from "authenticated";

revoke update on table "public"."menus" from "authenticated";

revoke delete on table "public"."menus" from "service_role";

revoke insert on table "public"."menus" from "service_role";

revoke references on table "public"."menus" from "service_role";

revoke select on table "public"."menus" from "service_role";

revoke trigger on table "public"."menus" from "service_role";

revoke truncate on table "public"."menus" from "service_role";

revoke update on table "public"."menus" from "service_role";

revoke delete on table "public"."mobility_pro_access" from "anon";

revoke insert on table "public"."mobility_pro_access" from "anon";

revoke references on table "public"."mobility_pro_access" from "anon";

revoke select on table "public"."mobility_pro_access" from "anon";

revoke trigger on table "public"."mobility_pro_access" from "anon";

revoke truncate on table "public"."mobility_pro_access" from "anon";

revoke update on table "public"."mobility_pro_access" from "anon";

revoke delete on table "public"."mobility_pro_access" from "authenticated";

revoke insert on table "public"."mobility_pro_access" from "authenticated";

revoke references on table "public"."mobility_pro_access" from "authenticated";

revoke select on table "public"."mobility_pro_access" from "authenticated";

revoke trigger on table "public"."mobility_pro_access" from "authenticated";

revoke truncate on table "public"."mobility_pro_access" from "authenticated";

revoke update on table "public"."mobility_pro_access" from "authenticated";

revoke delete on table "public"."mobility_pro_access" from "service_role";

revoke insert on table "public"."mobility_pro_access" from "service_role";

revoke references on table "public"."mobility_pro_access" from "service_role";

revoke select on table "public"."mobility_pro_access" from "service_role";

revoke trigger on table "public"."mobility_pro_access" from "service_role";

revoke truncate on table "public"."mobility_pro_access" from "service_role";

revoke update on table "public"."mobility_pro_access" from "service_role";

revoke delete on table "public"."momo_parsed_txns" from "anon";

revoke insert on table "public"."momo_parsed_txns" from "anon";

revoke references on table "public"."momo_parsed_txns" from "anon";

revoke select on table "public"."momo_parsed_txns" from "anon";

revoke trigger on table "public"."momo_parsed_txns" from "anon";

revoke truncate on table "public"."momo_parsed_txns" from "anon";

revoke update on table "public"."momo_parsed_txns" from "anon";

revoke delete on table "public"."momo_parsed_txns" from "authenticated";

revoke insert on table "public"."momo_parsed_txns" from "authenticated";

revoke references on table "public"."momo_parsed_txns" from "authenticated";

revoke select on table "public"."momo_parsed_txns" from "authenticated";

revoke trigger on table "public"."momo_parsed_txns" from "authenticated";

revoke truncate on table "public"."momo_parsed_txns" from "authenticated";

revoke update on table "public"."momo_parsed_txns" from "authenticated";

revoke delete on table "public"."momo_parsed_txns" from "service_role";

revoke insert on table "public"."momo_parsed_txns" from "service_role";

revoke references on table "public"."momo_parsed_txns" from "service_role";

revoke select on table "public"."momo_parsed_txns" from "service_role";

revoke trigger on table "public"."momo_parsed_txns" from "service_role";

revoke truncate on table "public"."momo_parsed_txns" from "service_role";

revoke update on table "public"."momo_parsed_txns" from "service_role";

revoke delete on table "public"."momo_qr_requests" from "anon";

revoke insert on table "public"."momo_qr_requests" from "anon";

revoke references on table "public"."momo_qr_requests" from "anon";

revoke select on table "public"."momo_qr_requests" from "anon";

revoke trigger on table "public"."momo_qr_requests" from "anon";

revoke truncate on table "public"."momo_qr_requests" from "anon";

revoke update on table "public"."momo_qr_requests" from "anon";

revoke delete on table "public"."momo_qr_requests" from "authenticated";

revoke insert on table "public"."momo_qr_requests" from "authenticated";

revoke references on table "public"."momo_qr_requests" from "authenticated";

revoke select on table "public"."momo_qr_requests" from "authenticated";

revoke trigger on table "public"."momo_qr_requests" from "authenticated";

revoke truncate on table "public"."momo_qr_requests" from "authenticated";

revoke update on table "public"."momo_qr_requests" from "authenticated";

revoke delete on table "public"."momo_qr_requests" from "service_role";

revoke insert on table "public"."momo_qr_requests" from "service_role";

revoke references on table "public"."momo_qr_requests" from "service_role";

revoke select on table "public"."momo_qr_requests" from "service_role";

revoke trigger on table "public"."momo_qr_requests" from "service_role";

revoke truncate on table "public"."momo_qr_requests" from "service_role";

revoke update on table "public"."momo_qr_requests" from "service_role";

revoke delete on table "public"."momo_sms_inbox" from "anon";

revoke insert on table "public"."momo_sms_inbox" from "anon";

revoke references on table "public"."momo_sms_inbox" from "anon";

revoke select on table "public"."momo_sms_inbox" from "anon";

revoke trigger on table "public"."momo_sms_inbox" from "anon";

revoke truncate on table "public"."momo_sms_inbox" from "anon";

revoke update on table "public"."momo_sms_inbox" from "anon";

revoke delete on table "public"."momo_sms_inbox" from "authenticated";

revoke insert on table "public"."momo_sms_inbox" from "authenticated";

revoke references on table "public"."momo_sms_inbox" from "authenticated";

revoke select on table "public"."momo_sms_inbox" from "authenticated";

revoke trigger on table "public"."momo_sms_inbox" from "authenticated";

revoke truncate on table "public"."momo_sms_inbox" from "authenticated";

revoke update on table "public"."momo_sms_inbox" from "authenticated";

revoke delete on table "public"."momo_sms_inbox" from "service_role";

revoke insert on table "public"."momo_sms_inbox" from "service_role";

revoke references on table "public"."momo_sms_inbox" from "service_role";

revoke select on table "public"."momo_sms_inbox" from "service_role";

revoke trigger on table "public"."momo_sms_inbox" from "service_role";

revoke truncate on table "public"."momo_sms_inbox" from "service_role";

revoke update on table "public"."momo_sms_inbox" from "service_role";

revoke delete on table "public"."momo_unmatched" from "anon";

revoke insert on table "public"."momo_unmatched" from "anon";

revoke references on table "public"."momo_unmatched" from "anon";

revoke select on table "public"."momo_unmatched" from "anon";

revoke trigger on table "public"."momo_unmatched" from "anon";

revoke truncate on table "public"."momo_unmatched" from "anon";

revoke update on table "public"."momo_unmatched" from "anon";

revoke delete on table "public"."momo_unmatched" from "authenticated";

revoke insert on table "public"."momo_unmatched" from "authenticated";

revoke references on table "public"."momo_unmatched" from "authenticated";

revoke select on table "public"."momo_unmatched" from "authenticated";

revoke trigger on table "public"."momo_unmatched" from "authenticated";

revoke truncate on table "public"."momo_unmatched" from "authenticated";

revoke update on table "public"."momo_unmatched" from "authenticated";

revoke delete on table "public"."momo_unmatched" from "service_role";

revoke insert on table "public"."momo_unmatched" from "service_role";

revoke references on table "public"."momo_unmatched" from "service_role";

revoke select on table "public"."momo_unmatched" from "service_role";

revoke trigger on table "public"."momo_unmatched" from "service_role";

revoke truncate on table "public"."momo_unmatched" from "service_role";

revoke update on table "public"."momo_unmatched" from "service_role";

revoke delete on table "public"."notifications" from "anon";

revoke insert on table "public"."notifications" from "anon";

revoke references on table "public"."notifications" from "anon";

revoke select on table "public"."notifications" from "anon";

revoke trigger on table "public"."notifications" from "anon";

revoke truncate on table "public"."notifications" from "anon";

revoke update on table "public"."notifications" from "anon";

revoke delete on table "public"."notifications" from "authenticated";

revoke insert on table "public"."notifications" from "authenticated";

revoke references on table "public"."notifications" from "authenticated";

revoke select on table "public"."notifications" from "authenticated";

revoke trigger on table "public"."notifications" from "authenticated";

revoke truncate on table "public"."notifications" from "authenticated";

revoke update on table "public"."notifications" from "authenticated";

revoke delete on table "public"."notifications" from "service_role";

revoke insert on table "public"."notifications" from "service_role";

revoke references on table "public"."notifications" from "service_role";

revoke select on table "public"."notifications" from "service_role";

revoke trigger on table "public"."notifications" from "service_role";

revoke truncate on table "public"."notifications" from "service_role";

revoke update on table "public"."notifications" from "service_role";

revoke delete on table "public"."ocr_jobs" from "anon";

revoke insert on table "public"."ocr_jobs" from "anon";

revoke references on table "public"."ocr_jobs" from "anon";

revoke select on table "public"."ocr_jobs" from "anon";

revoke trigger on table "public"."ocr_jobs" from "anon";

revoke truncate on table "public"."ocr_jobs" from "anon";

revoke update on table "public"."ocr_jobs" from "anon";

revoke delete on table "public"."ocr_jobs" from "authenticated";

revoke insert on table "public"."ocr_jobs" from "authenticated";

revoke references on table "public"."ocr_jobs" from "authenticated";

revoke select on table "public"."ocr_jobs" from "authenticated";

revoke trigger on table "public"."ocr_jobs" from "authenticated";

revoke truncate on table "public"."ocr_jobs" from "authenticated";

revoke update on table "public"."ocr_jobs" from "authenticated";

revoke delete on table "public"."ocr_jobs" from "service_role";

revoke insert on table "public"."ocr_jobs" from "service_role";

revoke references on table "public"."ocr_jobs" from "service_role";

revoke select on table "public"."ocr_jobs" from "service_role";

revoke trigger on table "public"."ocr_jobs" from "service_role";

revoke truncate on table "public"."ocr_jobs" from "service_role";

revoke update on table "public"."ocr_jobs" from "service_role";

revoke delete on table "public"."order_events" from "anon";

revoke insert on table "public"."order_events" from "anon";

revoke references on table "public"."order_events" from "anon";

revoke select on table "public"."order_events" from "anon";

revoke trigger on table "public"."order_events" from "anon";

revoke truncate on table "public"."order_events" from "anon";

revoke update on table "public"."order_events" from "anon";

revoke delete on table "public"."order_events" from "authenticated";

revoke insert on table "public"."order_events" from "authenticated";

revoke references on table "public"."order_events" from "authenticated";

revoke select on table "public"."order_events" from "authenticated";

revoke trigger on table "public"."order_events" from "authenticated";

revoke truncate on table "public"."order_events" from "authenticated";

revoke update on table "public"."order_events" from "authenticated";

revoke delete on table "public"."order_events" from "service_role";

revoke insert on table "public"."order_events" from "service_role";

revoke references on table "public"."order_events" from "service_role";

revoke select on table "public"."order_events" from "service_role";

revoke trigger on table "public"."order_events" from "service_role";

revoke truncate on table "public"."order_events" from "service_role";

revoke update on table "public"."order_events" from "service_role";

revoke delete on table "public"."order_items" from "anon";

revoke insert on table "public"."order_items" from "anon";

revoke references on table "public"."order_items" from "anon";

revoke select on table "public"."order_items" from "anon";

revoke trigger on table "public"."order_items" from "anon";

revoke truncate on table "public"."order_items" from "anon";

revoke update on table "public"."order_items" from "anon";

revoke delete on table "public"."order_items" from "authenticated";

revoke insert on table "public"."order_items" from "authenticated";

revoke references on table "public"."order_items" from "authenticated";

revoke select on table "public"."order_items" from "authenticated";

revoke trigger on table "public"."order_items" from "authenticated";

revoke truncate on table "public"."order_items" from "authenticated";

revoke update on table "public"."order_items" from "authenticated";

revoke delete on table "public"."order_items" from "service_role";

revoke insert on table "public"."order_items" from "service_role";

revoke references on table "public"."order_items" from "service_role";

revoke select on table "public"."order_items" from "service_role";

revoke trigger on table "public"."order_items" from "service_role";

revoke truncate on table "public"."order_items" from "service_role";

revoke update on table "public"."order_items" from "service_role";

revoke delete on table "public"."orders" from "anon";

revoke insert on table "public"."orders" from "anon";

revoke references on table "public"."orders" from "anon";

revoke select on table "public"."orders" from "anon";

revoke trigger on table "public"."orders" from "anon";

revoke truncate on table "public"."orders" from "anon";

revoke update on table "public"."orders" from "anon";

revoke delete on table "public"."orders" from "authenticated";

revoke insert on table "public"."orders" from "authenticated";

revoke references on table "public"."orders" from "authenticated";

revoke select on table "public"."orders" from "authenticated";

revoke trigger on table "public"."orders" from "authenticated";

revoke truncate on table "public"."orders" from "authenticated";

revoke update on table "public"."orders" from "authenticated";

revoke delete on table "public"."orders" from "service_role";

revoke insert on table "public"."orders" from "service_role";

revoke references on table "public"."orders" from "service_role";

revoke select on table "public"."orders" from "service_role";

revoke trigger on table "public"."orders" from "service_role";

revoke truncate on table "public"."orders" from "service_role";

revoke update on table "public"."orders" from "service_role";

revoke delete on table "public"."petrol_stations" from "anon";

revoke insert on table "public"."petrol_stations" from "anon";

revoke references on table "public"."petrol_stations" from "anon";

revoke select on table "public"."petrol_stations" from "anon";

revoke trigger on table "public"."petrol_stations" from "anon";

revoke truncate on table "public"."petrol_stations" from "anon";

revoke update on table "public"."petrol_stations" from "anon";

revoke delete on table "public"."petrol_stations" from "authenticated";

revoke insert on table "public"."petrol_stations" from "authenticated";

revoke references on table "public"."petrol_stations" from "authenticated";

revoke select on table "public"."petrol_stations" from "authenticated";

revoke trigger on table "public"."petrol_stations" from "authenticated";

revoke truncate on table "public"."petrol_stations" from "authenticated";

revoke update on table "public"."petrol_stations" from "authenticated";

revoke delete on table "public"."petrol_stations" from "service_role";

revoke insert on table "public"."petrol_stations" from "service_role";

revoke references on table "public"."petrol_stations" from "service_role";

revoke select on table "public"."petrol_stations" from "service_role";

revoke trigger on table "public"."petrol_stations" from "service_role";

revoke truncate on table "public"."petrol_stations" from "service_role";

revoke update on table "public"."petrol_stations" from "service_role";

revoke delete on table "public"."profiles" from "anon";

revoke insert on table "public"."profiles" from "anon";

revoke references on table "public"."profiles" from "anon";

revoke select on table "public"."profiles" from "anon";

revoke trigger on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "anon";

revoke update on table "public"."profiles" from "anon";

revoke delete on table "public"."profiles" from "authenticated";

revoke insert on table "public"."profiles" from "authenticated";

revoke references on table "public"."profiles" from "authenticated";

revoke select on table "public"."profiles" from "authenticated";

revoke trigger on table "public"."profiles" from "authenticated";

revoke truncate on table "public"."profiles" from "authenticated";

revoke update on table "public"."profiles" from "authenticated";

revoke delete on table "public"."profiles" from "service_role";

revoke insert on table "public"."profiles" from "service_role";

revoke references on table "public"."profiles" from "service_role";

revoke select on table "public"."profiles" from "service_role";

revoke trigger on table "public"."profiles" from "service_role";

revoke truncate on table "public"."profiles" from "service_role";

revoke update on table "public"."profiles" from "service_role";

revoke delete on table "public"."promo_rules" from "anon";

revoke insert on table "public"."promo_rules" from "anon";

revoke references on table "public"."promo_rules" from "anon";

revoke select on table "public"."promo_rules" from "anon";

revoke trigger on table "public"."promo_rules" from "anon";

revoke truncate on table "public"."promo_rules" from "anon";

revoke update on table "public"."promo_rules" from "anon";

revoke delete on table "public"."promo_rules" from "authenticated";

revoke insert on table "public"."promo_rules" from "authenticated";

revoke references on table "public"."promo_rules" from "authenticated";

revoke select on table "public"."promo_rules" from "authenticated";

revoke trigger on table "public"."promo_rules" from "authenticated";

revoke truncate on table "public"."promo_rules" from "authenticated";

revoke update on table "public"."promo_rules" from "authenticated";

revoke delete on table "public"."promo_rules" from "service_role";

revoke insert on table "public"."promo_rules" from "service_role";

revoke references on table "public"."promo_rules" from "service_role";

revoke select on table "public"."promo_rules" from "service_role";

revoke trigger on table "public"."promo_rules" from "service_role";

revoke truncate on table "public"."promo_rules" from "service_role";

revoke update on table "public"."promo_rules" from "service_role";

revoke delete on table "public"."qr_tokens" from "anon";

revoke insert on table "public"."qr_tokens" from "anon";

revoke references on table "public"."qr_tokens" from "anon";

revoke select on table "public"."qr_tokens" from "anon";

revoke trigger on table "public"."qr_tokens" from "anon";

revoke truncate on table "public"."qr_tokens" from "anon";

revoke update on table "public"."qr_tokens" from "anon";

revoke delete on table "public"."qr_tokens" from "authenticated";

revoke insert on table "public"."qr_tokens" from "authenticated";

revoke references on table "public"."qr_tokens" from "authenticated";

revoke select on table "public"."qr_tokens" from "authenticated";

revoke trigger on table "public"."qr_tokens" from "authenticated";

revoke truncate on table "public"."qr_tokens" from "authenticated";

revoke update on table "public"."qr_tokens" from "authenticated";

revoke delete on table "public"."qr_tokens" from "service_role";

revoke insert on table "public"."qr_tokens" from "service_role";

revoke references on table "public"."qr_tokens" from "service_role";

revoke select on table "public"."qr_tokens" from "service_role";

revoke trigger on table "public"."qr_tokens" from "service_role";

revoke truncate on table "public"."qr_tokens" from "service_role";

revoke update on table "public"."qr_tokens" from "service_role";

revoke delete on table "public"."referral_attributions" from "anon";

revoke insert on table "public"."referral_attributions" from "anon";

revoke references on table "public"."referral_attributions" from "anon";

revoke select on table "public"."referral_attributions" from "anon";

revoke trigger on table "public"."referral_attributions" from "anon";

revoke truncate on table "public"."referral_attributions" from "anon";

revoke update on table "public"."referral_attributions" from "anon";

revoke delete on table "public"."referral_attributions" from "authenticated";

revoke insert on table "public"."referral_attributions" from "authenticated";

revoke references on table "public"."referral_attributions" from "authenticated";

revoke select on table "public"."referral_attributions" from "authenticated";

revoke trigger on table "public"."referral_attributions" from "authenticated";

revoke truncate on table "public"."referral_attributions" from "authenticated";

revoke update on table "public"."referral_attributions" from "authenticated";

revoke delete on table "public"."referral_attributions" from "service_role";

revoke insert on table "public"."referral_attributions" from "service_role";

revoke references on table "public"."referral_attributions" from "service_role";

revoke select on table "public"."referral_attributions" from "service_role";

revoke trigger on table "public"."referral_attributions" from "service_role";

revoke truncate on table "public"."referral_attributions" from "service_role";

revoke update on table "public"."referral_attributions" from "service_role";

revoke delete on table "public"."referral_clicks" from "anon";

revoke insert on table "public"."referral_clicks" from "anon";

revoke references on table "public"."referral_clicks" from "anon";

revoke select on table "public"."referral_clicks" from "anon";

revoke trigger on table "public"."referral_clicks" from "anon";

revoke truncate on table "public"."referral_clicks" from "anon";

revoke update on table "public"."referral_clicks" from "anon";

revoke delete on table "public"."referral_clicks" from "authenticated";

revoke insert on table "public"."referral_clicks" from "authenticated";

revoke references on table "public"."referral_clicks" from "authenticated";

revoke select on table "public"."referral_clicks" from "authenticated";

revoke trigger on table "public"."referral_clicks" from "authenticated";

revoke truncate on table "public"."referral_clicks" from "authenticated";

revoke update on table "public"."referral_clicks" from "authenticated";

revoke delete on table "public"."referral_clicks" from "service_role";

revoke insert on table "public"."referral_clicks" from "service_role";

revoke references on table "public"."referral_clicks" from "service_role";

revoke select on table "public"."referral_clicks" from "service_role";

revoke trigger on table "public"."referral_clicks" from "service_role";

revoke truncate on table "public"."referral_clicks" from "service_role";

revoke update on table "public"."referral_clicks" from "service_role";

revoke delete on table "public"."referral_links" from "anon";

revoke insert on table "public"."referral_links" from "anon";

revoke references on table "public"."referral_links" from "anon";

revoke select on table "public"."referral_links" from "anon";

revoke trigger on table "public"."referral_links" from "anon";

revoke truncate on table "public"."referral_links" from "anon";

revoke update on table "public"."referral_links" from "anon";

revoke delete on table "public"."referral_links" from "authenticated";

revoke insert on table "public"."referral_links" from "authenticated";

revoke references on table "public"."referral_links" from "authenticated";

revoke select on table "public"."referral_links" from "authenticated";

revoke trigger on table "public"."referral_links" from "authenticated";

revoke truncate on table "public"."referral_links" from "authenticated";

revoke update on table "public"."referral_links" from "authenticated";

revoke delete on table "public"."referral_links" from "service_role";

revoke insert on table "public"."referral_links" from "service_role";

revoke references on table "public"."referral_links" from "service_role";

revoke select on table "public"."referral_links" from "service_role";

revoke trigger on table "public"."referral_links" from "service_role";

revoke truncate on table "public"."referral_links" from "service_role";

revoke update on table "public"."referral_links" from "service_role";

revoke delete on table "public"."sacco_collateral" from "anon";

revoke insert on table "public"."sacco_collateral" from "anon";

revoke references on table "public"."sacco_collateral" from "anon";

revoke select on table "public"."sacco_collateral" from "anon";

revoke trigger on table "public"."sacco_collateral" from "anon";

revoke truncate on table "public"."sacco_collateral" from "anon";

revoke update on table "public"."sacco_collateral" from "anon";

revoke delete on table "public"."sacco_collateral" from "authenticated";

revoke insert on table "public"."sacco_collateral" from "authenticated";

revoke references on table "public"."sacco_collateral" from "authenticated";

revoke select on table "public"."sacco_collateral" from "authenticated";

revoke trigger on table "public"."sacco_collateral" from "authenticated";

revoke truncate on table "public"."sacco_collateral" from "authenticated";

revoke update on table "public"."sacco_collateral" from "authenticated";

revoke delete on table "public"."sacco_collateral" from "service_role";

revoke insert on table "public"."sacco_collateral" from "service_role";

revoke references on table "public"."sacco_collateral" from "service_role";

revoke select on table "public"."sacco_collateral" from "service_role";

revoke trigger on table "public"."sacco_collateral" from "service_role";

revoke truncate on table "public"."sacco_collateral" from "service_role";

revoke update on table "public"."sacco_collateral" from "service_role";

revoke delete on table "public"."sacco_loan_endorsements" from "anon";

revoke insert on table "public"."sacco_loan_endorsements" from "anon";

revoke references on table "public"."sacco_loan_endorsements" from "anon";

revoke select on table "public"."sacco_loan_endorsements" from "anon";

revoke trigger on table "public"."sacco_loan_endorsements" from "anon";

revoke truncate on table "public"."sacco_loan_endorsements" from "anon";

revoke update on table "public"."sacco_loan_endorsements" from "anon";

revoke delete on table "public"."sacco_loan_endorsements" from "authenticated";

revoke insert on table "public"."sacco_loan_endorsements" from "authenticated";

revoke references on table "public"."sacco_loan_endorsements" from "authenticated";

revoke select on table "public"."sacco_loan_endorsements" from "authenticated";

revoke trigger on table "public"."sacco_loan_endorsements" from "authenticated";

revoke truncate on table "public"."sacco_loan_endorsements" from "authenticated";

revoke update on table "public"."sacco_loan_endorsements" from "authenticated";

revoke delete on table "public"."sacco_loan_endorsements" from "service_role";

revoke insert on table "public"."sacco_loan_endorsements" from "service_role";

revoke references on table "public"."sacco_loan_endorsements" from "service_role";

revoke select on table "public"."sacco_loan_endorsements" from "service_role";

revoke trigger on table "public"."sacco_loan_endorsements" from "service_role";

revoke truncate on table "public"."sacco_loan_endorsements" from "service_role";

revoke update on table "public"."sacco_loan_endorsements" from "service_role";

revoke delete on table "public"."sacco_loan_events" from "anon";

revoke insert on table "public"."sacco_loan_events" from "anon";

revoke references on table "public"."sacco_loan_events" from "anon";

revoke select on table "public"."sacco_loan_events" from "anon";

revoke trigger on table "public"."sacco_loan_events" from "anon";

revoke truncate on table "public"."sacco_loan_events" from "anon";

revoke update on table "public"."sacco_loan_events" from "anon";

revoke delete on table "public"."sacco_loan_events" from "authenticated";

revoke insert on table "public"."sacco_loan_events" from "authenticated";

revoke references on table "public"."sacco_loan_events" from "authenticated";

revoke select on table "public"."sacco_loan_events" from "authenticated";

revoke trigger on table "public"."sacco_loan_events" from "authenticated";

revoke truncate on table "public"."sacco_loan_events" from "authenticated";

revoke update on table "public"."sacco_loan_events" from "authenticated";

revoke delete on table "public"."sacco_loan_events" from "service_role";

revoke insert on table "public"."sacco_loan_events" from "service_role";

revoke references on table "public"."sacco_loan_events" from "service_role";

revoke select on table "public"."sacco_loan_events" from "service_role";

revoke trigger on table "public"."sacco_loan_events" from "service_role";

revoke truncate on table "public"."sacco_loan_events" from "service_role";

revoke update on table "public"."sacco_loan_events" from "service_role";

revoke delete on table "public"."sacco_loans" from "anon";

revoke insert on table "public"."sacco_loans" from "anon";

revoke references on table "public"."sacco_loans" from "anon";

revoke select on table "public"."sacco_loans" from "anon";

revoke trigger on table "public"."sacco_loans" from "anon";

revoke truncate on table "public"."sacco_loans" from "anon";

revoke update on table "public"."sacco_loans" from "anon";

revoke delete on table "public"."sacco_loans" from "authenticated";

revoke insert on table "public"."sacco_loans" from "authenticated";

revoke references on table "public"."sacco_loans" from "authenticated";

revoke select on table "public"."sacco_loans" from "authenticated";

revoke trigger on table "public"."sacco_loans" from "authenticated";

revoke truncate on table "public"."sacco_loans" from "authenticated";

revoke update on table "public"."sacco_loans" from "authenticated";

revoke delete on table "public"."sacco_loans" from "service_role";

revoke insert on table "public"."sacco_loans" from "service_role";

revoke references on table "public"."sacco_loans" from "service_role";

revoke select on table "public"."sacco_loans" from "service_role";

revoke trigger on table "public"."sacco_loans" from "service_role";

revoke truncate on table "public"."sacco_loans" from "service_role";

revoke update on table "public"."sacco_loans" from "service_role";

revoke delete on table "public"."sacco_officers" from "anon";

revoke insert on table "public"."sacco_officers" from "anon";

revoke references on table "public"."sacco_officers" from "anon";

revoke select on table "public"."sacco_officers" from "anon";

revoke trigger on table "public"."sacco_officers" from "anon";

revoke truncate on table "public"."sacco_officers" from "anon";

revoke update on table "public"."sacco_officers" from "anon";

revoke delete on table "public"."sacco_officers" from "authenticated";

revoke insert on table "public"."sacco_officers" from "authenticated";

revoke references on table "public"."sacco_officers" from "authenticated";

revoke select on table "public"."sacco_officers" from "authenticated";

revoke trigger on table "public"."sacco_officers" from "authenticated";

revoke truncate on table "public"."sacco_officers" from "authenticated";

revoke update on table "public"."sacco_officers" from "authenticated";

revoke delete on table "public"."sacco_officers" from "service_role";

revoke insert on table "public"."sacco_officers" from "service_role";

revoke references on table "public"."sacco_officers" from "service_role";

revoke select on table "public"."sacco_officers" from "service_role";

revoke trigger on table "public"."sacco_officers" from "service_role";

revoke truncate on table "public"."sacco_officers" from "service_role";

revoke update on table "public"."sacco_officers" from "service_role";

revoke delete on table "public"."saccos" from "anon";

revoke insert on table "public"."saccos" from "anon";

revoke references on table "public"."saccos" from "anon";

revoke select on table "public"."saccos" from "anon";

revoke trigger on table "public"."saccos" from "anon";

revoke truncate on table "public"."saccos" from "anon";

revoke update on table "public"."saccos" from "anon";

revoke delete on table "public"."saccos" from "authenticated";

revoke insert on table "public"."saccos" from "authenticated";

revoke references on table "public"."saccos" from "authenticated";

revoke select on table "public"."saccos" from "authenticated";

revoke trigger on table "public"."saccos" from "authenticated";

revoke truncate on table "public"."saccos" from "authenticated";

revoke update on table "public"."saccos" from "authenticated";

revoke delete on table "public"."saccos" from "service_role";

revoke insert on table "public"."saccos" from "service_role";

revoke references on table "public"."saccos" from "service_role";

revoke select on table "public"."saccos" from "service_role";

revoke trigger on table "public"."saccos" from "service_role";

revoke truncate on table "public"."saccos" from "service_role";

revoke update on table "public"."saccos" from "service_role";

revoke delete on table "public"."sessions" from "anon";

revoke insert on table "public"."sessions" from "anon";

revoke references on table "public"."sessions" from "anon";

revoke select on table "public"."sessions" from "anon";

revoke trigger on table "public"."sessions" from "anon";

revoke truncate on table "public"."sessions" from "anon";

revoke update on table "public"."sessions" from "anon";

revoke delete on table "public"."sessions" from "authenticated";

revoke insert on table "public"."sessions" from "authenticated";

revoke references on table "public"."sessions" from "authenticated";

revoke select on table "public"."sessions" from "authenticated";

revoke trigger on table "public"."sessions" from "authenticated";

revoke truncate on table "public"."sessions" from "authenticated";

revoke update on table "public"."sessions" from "authenticated";

revoke delete on table "public"."sessions" from "service_role";

revoke insert on table "public"."sessions" from "service_role";

revoke references on table "public"."sessions" from "service_role";

revoke select on table "public"."sessions" from "service_role";

revoke trigger on table "public"."sessions" from "service_role";

revoke truncate on table "public"."sessions" from "service_role";

revoke update on table "public"."sessions" from "service_role";

revoke delete on table "public"."settings" from "anon";

revoke insert on table "public"."settings" from "anon";

revoke references on table "public"."settings" from "anon";

revoke select on table "public"."settings" from "anon";

revoke trigger on table "public"."settings" from "anon";

revoke truncate on table "public"."settings" from "anon";

revoke update on table "public"."settings" from "anon";

revoke delete on table "public"."settings" from "authenticated";

revoke insert on table "public"."settings" from "authenticated";

revoke references on table "public"."settings" from "authenticated";

revoke select on table "public"."settings" from "authenticated";

revoke trigger on table "public"."settings" from "authenticated";

revoke truncate on table "public"."settings" from "authenticated";

revoke update on table "public"."settings" from "authenticated";

revoke delete on table "public"."settings" from "service_role";

revoke insert on table "public"."settings" from "service_role";

revoke references on table "public"."settings" from "service_role";

revoke select on table "public"."settings" from "service_role";

revoke trigger on table "public"."settings" from "service_role";

revoke truncate on table "public"."settings" from "service_role";

revoke update on table "public"."settings" from "service_role";

revoke delete on table "public"."spatial_ref_sys" from "anon";

revoke insert on table "public"."spatial_ref_sys" from "anon";

revoke references on table "public"."spatial_ref_sys" from "anon";

revoke select on table "public"."spatial_ref_sys" from "anon";

revoke trigger on table "public"."spatial_ref_sys" from "anon";

revoke truncate on table "public"."spatial_ref_sys" from "anon";

revoke update on table "public"."spatial_ref_sys" from "anon";

revoke delete on table "public"."spatial_ref_sys" from "authenticated";

revoke insert on table "public"."spatial_ref_sys" from "authenticated";

revoke references on table "public"."spatial_ref_sys" from "authenticated";

revoke select on table "public"."spatial_ref_sys" from "authenticated";

revoke trigger on table "public"."spatial_ref_sys" from "authenticated";

revoke truncate on table "public"."spatial_ref_sys" from "authenticated";

revoke update on table "public"."spatial_ref_sys" from "authenticated";

revoke delete on table "public"."spatial_ref_sys" from "postgres";

revoke insert on table "public"."spatial_ref_sys" from "postgres";

revoke references on table "public"."spatial_ref_sys" from "postgres";

revoke select on table "public"."spatial_ref_sys" from "postgres";

revoke trigger on table "public"."spatial_ref_sys" from "postgres";

revoke truncate on table "public"."spatial_ref_sys" from "postgres";

revoke update on table "public"."spatial_ref_sys" from "postgres";

revoke delete on table "public"."spatial_ref_sys" from "service_role";

revoke insert on table "public"."spatial_ref_sys" from "service_role";

revoke references on table "public"."spatial_ref_sys" from "service_role";

revoke select on table "public"."spatial_ref_sys" from "service_role";

revoke trigger on table "public"."spatial_ref_sys" from "service_role";

revoke truncate on table "public"."spatial_ref_sys" from "service_role";

revoke update on table "public"."spatial_ref_sys" from "service_role";

revoke delete on table "public"."station_numbers" from "anon";

revoke insert on table "public"."station_numbers" from "anon";

revoke references on table "public"."station_numbers" from "anon";

revoke select on table "public"."station_numbers" from "anon";

revoke trigger on table "public"."station_numbers" from "anon";

revoke truncate on table "public"."station_numbers" from "anon";

revoke update on table "public"."station_numbers" from "anon";

revoke delete on table "public"."station_numbers" from "authenticated";

revoke insert on table "public"."station_numbers" from "authenticated";

revoke references on table "public"."station_numbers" from "authenticated";

revoke select on table "public"."station_numbers" from "authenticated";

revoke trigger on table "public"."station_numbers" from "authenticated";

revoke truncate on table "public"."station_numbers" from "authenticated";

revoke update on table "public"."station_numbers" from "authenticated";

revoke delete on table "public"."station_numbers" from "service_role";

revoke insert on table "public"."station_numbers" from "service_role";

revoke references on table "public"."station_numbers" from "service_role";

revoke select on table "public"."station_numbers" from "service_role";

revoke trigger on table "public"."station_numbers" from "service_role";

revoke truncate on table "public"."station_numbers" from "service_role";

revoke update on table "public"."station_numbers" from "service_role";

revoke delete on table "public"."stations" from "anon";

revoke insert on table "public"."stations" from "anon";

revoke references on table "public"."stations" from "anon";

revoke select on table "public"."stations" from "anon";

revoke trigger on table "public"."stations" from "anon";

revoke truncate on table "public"."stations" from "anon";

revoke update on table "public"."stations" from "anon";

revoke delete on table "public"."stations" from "authenticated";

revoke insert on table "public"."stations" from "authenticated";

revoke references on table "public"."stations" from "authenticated";

revoke select on table "public"."stations" from "authenticated";

revoke trigger on table "public"."stations" from "authenticated";

revoke truncate on table "public"."stations" from "authenticated";

revoke update on table "public"."stations" from "authenticated";

revoke delete on table "public"."stations" from "service_role";

revoke insert on table "public"."stations" from "service_role";

revoke references on table "public"."stations" from "service_role";

revoke select on table "public"."stations" from "service_role";

revoke trigger on table "public"."stations" from "service_role";

revoke truncate on table "public"."stations" from "service_role";

revoke update on table "public"."stations" from "service_role";

revoke delete on table "public"."subscriptions" from "anon";

revoke insert on table "public"."subscriptions" from "anon";

revoke references on table "public"."subscriptions" from "anon";

revoke select on table "public"."subscriptions" from "anon";

revoke trigger on table "public"."subscriptions" from "anon";

revoke truncate on table "public"."subscriptions" from "anon";

revoke update on table "public"."subscriptions" from "anon";

revoke delete on table "public"."subscriptions" from "authenticated";

revoke insert on table "public"."subscriptions" from "authenticated";

revoke references on table "public"."subscriptions" from "authenticated";

revoke select on table "public"."subscriptions" from "authenticated";

revoke trigger on table "public"."subscriptions" from "authenticated";

revoke truncate on table "public"."subscriptions" from "authenticated";

revoke update on table "public"."subscriptions" from "authenticated";

revoke delete on table "public"."subscriptions" from "service_role";

revoke insert on table "public"."subscriptions" from "service_role";

revoke references on table "public"."subscriptions" from "service_role";

revoke select on table "public"."subscriptions" from "service_role";

revoke trigger on table "public"."subscriptions" from "service_role";

revoke truncate on table "public"."subscriptions" from "service_role";

revoke update on table "public"."subscriptions" from "service_role";

revoke delete on table "public"."trips" from "anon";

revoke insert on table "public"."trips" from "anon";

revoke references on table "public"."trips" from "anon";

revoke select on table "public"."trips" from "anon";

revoke trigger on table "public"."trips" from "anon";

revoke truncate on table "public"."trips" from "anon";

revoke update on table "public"."trips" from "anon";

revoke delete on table "public"."trips" from "authenticated";

revoke insert on table "public"."trips" from "authenticated";

revoke references on table "public"."trips" from "authenticated";

revoke select on table "public"."trips" from "authenticated";

revoke trigger on table "public"."trips" from "authenticated";

revoke truncate on table "public"."trips" from "authenticated";

revoke update on table "public"."trips" from "authenticated";

revoke delete on table "public"."trips" from "service_role";

revoke insert on table "public"."trips" from "service_role";

revoke references on table "public"."trips" from "service_role";

revoke select on table "public"."trips" from "service_role";

revoke trigger on table "public"."trips" from "service_role";

revoke truncate on table "public"."trips" from "service_role";

revoke update on table "public"."trips" from "service_role";

revoke delete on table "public"."voucher_events" from "anon";

revoke insert on table "public"."voucher_events" from "anon";

revoke references on table "public"."voucher_events" from "anon";

revoke select on table "public"."voucher_events" from "anon";

revoke trigger on table "public"."voucher_events" from "anon";

revoke truncate on table "public"."voucher_events" from "anon";

revoke update on table "public"."voucher_events" from "anon";

revoke delete on table "public"."voucher_events" from "authenticated";

revoke insert on table "public"."voucher_events" from "authenticated";

revoke references on table "public"."voucher_events" from "authenticated";

revoke select on table "public"."voucher_events" from "authenticated";

revoke trigger on table "public"."voucher_events" from "authenticated";

revoke truncate on table "public"."voucher_events" from "authenticated";

revoke update on table "public"."voucher_events" from "authenticated";

revoke delete on table "public"."voucher_events" from "service_role";

revoke insert on table "public"."voucher_events" from "service_role";

revoke references on table "public"."voucher_events" from "service_role";

revoke select on table "public"."voucher_events" from "service_role";

revoke trigger on table "public"."voucher_events" from "service_role";

revoke truncate on table "public"."voucher_events" from "service_role";

revoke update on table "public"."voucher_events" from "service_role";

revoke delete on table "public"."voucher_redemptions" from "anon";

revoke insert on table "public"."voucher_redemptions" from "anon";

revoke references on table "public"."voucher_redemptions" from "anon";

revoke select on table "public"."voucher_redemptions" from "anon";

revoke trigger on table "public"."voucher_redemptions" from "anon";

revoke truncate on table "public"."voucher_redemptions" from "anon";

revoke update on table "public"."voucher_redemptions" from "anon";

revoke delete on table "public"."voucher_redemptions" from "authenticated";

revoke insert on table "public"."voucher_redemptions" from "authenticated";

revoke references on table "public"."voucher_redemptions" from "authenticated";

revoke select on table "public"."voucher_redemptions" from "authenticated";

revoke trigger on table "public"."voucher_redemptions" from "authenticated";

revoke truncate on table "public"."voucher_redemptions" from "authenticated";

revoke update on table "public"."voucher_redemptions" from "authenticated";

revoke delete on table "public"."voucher_redemptions" from "service_role";

revoke insert on table "public"."voucher_redemptions" from "service_role";

revoke references on table "public"."voucher_redemptions" from "service_role";

revoke select on table "public"."voucher_redemptions" from "service_role";

revoke trigger on table "public"."voucher_redemptions" from "service_role";

revoke truncate on table "public"."voucher_redemptions" from "service_role";

revoke update on table "public"."voucher_redemptions" from "service_role";

revoke delete on table "public"."vouchers" from "anon";

revoke insert on table "public"."vouchers" from "anon";

revoke references on table "public"."vouchers" from "anon";

revoke select on table "public"."vouchers" from "anon";

revoke trigger on table "public"."vouchers" from "anon";

revoke truncate on table "public"."vouchers" from "anon";

revoke update on table "public"."vouchers" from "anon";

revoke delete on table "public"."vouchers" from "authenticated";

revoke insert on table "public"."vouchers" from "authenticated";

revoke references on table "public"."vouchers" from "authenticated";

revoke select on table "public"."vouchers" from "authenticated";

revoke trigger on table "public"."vouchers" from "authenticated";

revoke truncate on table "public"."vouchers" from "authenticated";

revoke update on table "public"."vouchers" from "authenticated";

revoke delete on table "public"."vouchers" from "service_role";

revoke insert on table "public"."vouchers" from "service_role";

revoke references on table "public"."vouchers" from "service_role";

revoke select on table "public"."vouchers" from "service_role";

revoke trigger on table "public"."vouchers" from "service_role";

revoke truncate on table "public"."vouchers" from "service_role";

revoke update on table "public"."vouchers" from "service_role";

revoke delete on table "public"."wa_events" from "anon";

revoke insert on table "public"."wa_events" from "anon";

revoke references on table "public"."wa_events" from "anon";

revoke select on table "public"."wa_events" from "anon";

revoke trigger on table "public"."wa_events" from "anon";

revoke truncate on table "public"."wa_events" from "anon";

revoke update on table "public"."wa_events" from "anon";

revoke delete on table "public"."wa_events" from "authenticated";

revoke insert on table "public"."wa_events" from "authenticated";

revoke references on table "public"."wa_events" from "authenticated";

revoke select on table "public"."wa_events" from "authenticated";

revoke trigger on table "public"."wa_events" from "authenticated";

revoke truncate on table "public"."wa_events" from "authenticated";

revoke update on table "public"."wa_events" from "authenticated";

revoke delete on table "public"."wa_events" from "service_role";

revoke insert on table "public"."wa_events" from "service_role";

revoke references on table "public"."wa_events" from "service_role";

revoke select on table "public"."wa_events" from "service_role";

revoke trigger on table "public"."wa_events" from "service_role";

revoke truncate on table "public"."wa_events" from "service_role";

revoke update on table "public"."wa_events" from "service_role";

revoke delete on table "public"."wallet_accounts" from "anon";

revoke insert on table "public"."wallet_accounts" from "anon";

revoke references on table "public"."wallet_accounts" from "anon";

revoke select on table "public"."wallet_accounts" from "anon";

revoke trigger on table "public"."wallet_accounts" from "anon";

revoke truncate on table "public"."wallet_accounts" from "anon";

revoke update on table "public"."wallet_accounts" from "anon";

revoke delete on table "public"."wallet_accounts" from "authenticated";

revoke insert on table "public"."wallet_accounts" from "authenticated";

revoke references on table "public"."wallet_accounts" from "authenticated";

revoke select on table "public"."wallet_accounts" from "authenticated";

revoke trigger on table "public"."wallet_accounts" from "authenticated";

revoke truncate on table "public"."wallet_accounts" from "authenticated";

revoke update on table "public"."wallet_accounts" from "authenticated";

revoke delete on table "public"."wallet_accounts" from "service_role";

revoke insert on table "public"."wallet_accounts" from "service_role";

revoke references on table "public"."wallet_accounts" from "service_role";

revoke select on table "public"."wallet_accounts" from "service_role";

revoke trigger on table "public"."wallet_accounts" from "service_role";

revoke truncate on table "public"."wallet_accounts" from "service_role";

revoke update on table "public"."wallet_accounts" from "service_role";

revoke delete on table "public"."wallet_earn_actions" from "anon";

revoke insert on table "public"."wallet_earn_actions" from "anon";

revoke references on table "public"."wallet_earn_actions" from "anon";

revoke select on table "public"."wallet_earn_actions" from "anon";

revoke trigger on table "public"."wallet_earn_actions" from "anon";

revoke truncate on table "public"."wallet_earn_actions" from "anon";

revoke update on table "public"."wallet_earn_actions" from "anon";

revoke delete on table "public"."wallet_earn_actions" from "authenticated";

revoke insert on table "public"."wallet_earn_actions" from "authenticated";

revoke references on table "public"."wallet_earn_actions" from "authenticated";

revoke select on table "public"."wallet_earn_actions" from "authenticated";

revoke trigger on table "public"."wallet_earn_actions" from "authenticated";

revoke truncate on table "public"."wallet_earn_actions" from "authenticated";

revoke update on table "public"."wallet_earn_actions" from "authenticated";

revoke delete on table "public"."wallet_earn_actions" from "service_role";

revoke insert on table "public"."wallet_earn_actions" from "service_role";

revoke references on table "public"."wallet_earn_actions" from "service_role";

revoke select on table "public"."wallet_earn_actions" from "service_role";

revoke trigger on table "public"."wallet_earn_actions" from "service_role";

revoke truncate on table "public"."wallet_earn_actions" from "service_role";

revoke update on table "public"."wallet_earn_actions" from "service_role";

revoke delete on table "public"."wallet_ledger" from "anon";

revoke insert on table "public"."wallet_ledger" from "anon";

revoke references on table "public"."wallet_ledger" from "anon";

revoke select on table "public"."wallet_ledger" from "anon";

revoke trigger on table "public"."wallet_ledger" from "anon";

revoke truncate on table "public"."wallet_ledger" from "anon";

revoke update on table "public"."wallet_ledger" from "anon";

revoke delete on table "public"."wallet_ledger" from "authenticated";

revoke insert on table "public"."wallet_ledger" from "authenticated";

revoke references on table "public"."wallet_ledger" from "authenticated";

revoke select on table "public"."wallet_ledger" from "authenticated";

revoke trigger on table "public"."wallet_ledger" from "authenticated";

revoke truncate on table "public"."wallet_ledger" from "authenticated";

revoke update on table "public"."wallet_ledger" from "authenticated";

revoke delete on table "public"."wallet_ledger" from "service_role";

revoke insert on table "public"."wallet_ledger" from "service_role";

revoke references on table "public"."wallet_ledger" from "service_role";

revoke select on table "public"."wallet_ledger" from "service_role";

revoke trigger on table "public"."wallet_ledger" from "service_role";

revoke truncate on table "public"."wallet_ledger" from "service_role";

revoke update on table "public"."wallet_ledger" from "service_role";

revoke delete on table "public"."wallet_promoters" from "anon";

revoke insert on table "public"."wallet_promoters" from "anon";

revoke references on table "public"."wallet_promoters" from "anon";

revoke select on table "public"."wallet_promoters" from "anon";

revoke trigger on table "public"."wallet_promoters" from "anon";

revoke truncate on table "public"."wallet_promoters" from "anon";

revoke update on table "public"."wallet_promoters" from "anon";

revoke delete on table "public"."wallet_promoters" from "authenticated";

revoke insert on table "public"."wallet_promoters" from "authenticated";

revoke references on table "public"."wallet_promoters" from "authenticated";

revoke select on table "public"."wallet_promoters" from "authenticated";

revoke trigger on table "public"."wallet_promoters" from "authenticated";

revoke truncate on table "public"."wallet_promoters" from "authenticated";

revoke update on table "public"."wallet_promoters" from "authenticated";

revoke delete on table "public"."wallet_promoters" from "service_role";

revoke insert on table "public"."wallet_promoters" from "service_role";

revoke references on table "public"."wallet_promoters" from "service_role";

revoke select on table "public"."wallet_promoters" from "service_role";

revoke trigger on table "public"."wallet_promoters" from "service_role";

revoke truncate on table "public"."wallet_promoters" from "service_role";

revoke update on table "public"."wallet_promoters" from "service_role";

revoke delete on table "public"."wallet_redeem_options" from "anon";

revoke insert on table "public"."wallet_redeem_options" from "anon";

revoke references on table "public"."wallet_redeem_options" from "anon";

revoke select on table "public"."wallet_redeem_options" from "anon";

revoke trigger on table "public"."wallet_redeem_options" from "anon";

revoke truncate on table "public"."wallet_redeem_options" from "anon";

revoke update on table "public"."wallet_redeem_options" from "anon";

revoke delete on table "public"."wallet_redeem_options" from "authenticated";

revoke insert on table "public"."wallet_redeem_options" from "authenticated";

revoke references on table "public"."wallet_redeem_options" from "authenticated";

revoke select on table "public"."wallet_redeem_options" from "authenticated";

revoke trigger on table "public"."wallet_redeem_options" from "authenticated";

revoke truncate on table "public"."wallet_redeem_options" from "authenticated";

revoke update on table "public"."wallet_redeem_options" from "authenticated";

revoke delete on table "public"."wallet_redeem_options" from "service_role";

revoke insert on table "public"."wallet_redeem_options" from "service_role";

revoke references on table "public"."wallet_redeem_options" from "service_role";

revoke select on table "public"."wallet_redeem_options" from "service_role";

revoke trigger on table "public"."wallet_redeem_options" from "service_role";

revoke truncate on table "public"."wallet_redeem_options" from "service_role";

revoke update on table "public"."wallet_redeem_options" from "service_role";

revoke delete on table "public"."wallet_transactions" from "anon";

revoke insert on table "public"."wallet_transactions" from "anon";

revoke references on table "public"."wallet_transactions" from "anon";

revoke select on table "public"."wallet_transactions" from "anon";

revoke trigger on table "public"."wallet_transactions" from "anon";

revoke truncate on table "public"."wallet_transactions" from "anon";

revoke update on table "public"."wallet_transactions" from "anon";

revoke delete on table "public"."wallet_transactions" from "authenticated";

revoke insert on table "public"."wallet_transactions" from "authenticated";

revoke references on table "public"."wallet_transactions" from "authenticated";

revoke select on table "public"."wallet_transactions" from "authenticated";

revoke trigger on table "public"."wallet_transactions" from "authenticated";

revoke truncate on table "public"."wallet_transactions" from "authenticated";

revoke update on table "public"."wallet_transactions" from "authenticated";

revoke delete on table "public"."wallet_transactions" from "service_role";

revoke insert on table "public"."wallet_transactions" from "service_role";

revoke references on table "public"."wallet_transactions" from "service_role";

revoke select on table "public"."wallet_transactions" from "service_role";

revoke trigger on table "public"."wallet_transactions" from "service_role";

revoke truncate on table "public"."wallet_transactions" from "service_role";

revoke update on table "public"."wallet_transactions" from "service_role";

revoke delete on table "public"."wallets" from "anon";

revoke insert on table "public"."wallets" from "anon";

revoke references on table "public"."wallets" from "anon";

revoke select on table "public"."wallets" from "anon";

revoke trigger on table "public"."wallets" from "anon";

revoke truncate on table "public"."wallets" from "anon";

revoke update on table "public"."wallets" from "anon";

revoke delete on table "public"."wallets" from "authenticated";

revoke insert on table "public"."wallets" from "authenticated";

revoke references on table "public"."wallets" from "authenticated";

revoke select on table "public"."wallets" from "authenticated";

revoke trigger on table "public"."wallets" from "authenticated";

revoke truncate on table "public"."wallets" from "authenticated";

revoke update on table "public"."wallets" from "authenticated";

revoke delete on table "public"."wallets" from "service_role";

revoke insert on table "public"."wallets" from "service_role";

revoke references on table "public"."wallets" from "service_role";

revoke select on table "public"."wallets" from "service_role";

revoke trigger on table "public"."wallets" from "service_role";

revoke truncate on table "public"."wallets" from "service_role";

revoke update on table "public"."wallets" from "service_role";

revoke delete on table "public"."webhook_logs" from "anon";

revoke insert on table "public"."webhook_logs" from "anon";

revoke references on table "public"."webhook_logs" from "anon";

revoke select on table "public"."webhook_logs" from "anon";

revoke trigger on table "public"."webhook_logs" from "anon";

revoke truncate on table "public"."webhook_logs" from "anon";

revoke update on table "public"."webhook_logs" from "anon";

revoke delete on table "public"."webhook_logs" from "authenticated";

revoke insert on table "public"."webhook_logs" from "authenticated";

revoke references on table "public"."webhook_logs" from "authenticated";

revoke select on table "public"."webhook_logs" from "authenticated";

revoke trigger on table "public"."webhook_logs" from "authenticated";

revoke truncate on table "public"."webhook_logs" from "authenticated";

revoke update on table "public"."webhook_logs" from "authenticated";

revoke delete on table "public"."webhook_logs" from "service_role";

revoke insert on table "public"."webhook_logs" from "service_role";

revoke references on table "public"."webhook_logs" from "service_role";

revoke select on table "public"."webhook_logs" from "service_role";

revoke trigger on table "public"."webhook_logs" from "service_role";

revoke truncate on table "public"."webhook_logs" from "service_role";

revoke update on table "public"."webhook_logs" from "service_role";

revoke delete on table "public"."whatsapp_intents" from "anon";

revoke insert on table "public"."whatsapp_intents" from "anon";

revoke references on table "public"."whatsapp_intents" from "anon";

revoke select on table "public"."whatsapp_intents" from "anon";

revoke trigger on table "public"."whatsapp_intents" from "anon";

revoke truncate on table "public"."whatsapp_intents" from "anon";

revoke update on table "public"."whatsapp_intents" from "anon";

revoke delete on table "public"."whatsapp_intents" from "authenticated";

revoke insert on table "public"."whatsapp_intents" from "authenticated";

revoke references on table "public"."whatsapp_intents" from "authenticated";

revoke select on table "public"."whatsapp_intents" from "authenticated";

revoke trigger on table "public"."whatsapp_intents" from "authenticated";

revoke truncate on table "public"."whatsapp_intents" from "authenticated";

revoke update on table "public"."whatsapp_intents" from "authenticated";

revoke delete on table "public"."whatsapp_intents" from "service_role";

revoke insert on table "public"."whatsapp_intents" from "service_role";

revoke references on table "public"."whatsapp_intents" from "service_role";

revoke select on table "public"."whatsapp_intents" from "service_role";

revoke trigger on table "public"."whatsapp_intents" from "service_role";

revoke truncate on table "public"."whatsapp_intents" from "service_role";

revoke update on table "public"."whatsapp_intents" from "service_role";

revoke delete on table "public"."whatsapp_menu_items" from "anon";

revoke insert on table "public"."whatsapp_menu_items" from "anon";

revoke references on table "public"."whatsapp_menu_items" from "anon";

revoke select on table "public"."whatsapp_menu_items" from "anon";

revoke trigger on table "public"."whatsapp_menu_items" from "anon";

revoke truncate on table "public"."whatsapp_menu_items" from "anon";

revoke update on table "public"."whatsapp_menu_items" from "anon";

revoke delete on table "public"."whatsapp_menu_items" from "authenticated";

revoke insert on table "public"."whatsapp_menu_items" from "authenticated";

revoke references on table "public"."whatsapp_menu_items" from "authenticated";

revoke select on table "public"."whatsapp_menu_items" from "authenticated";

revoke trigger on table "public"."whatsapp_menu_items" from "authenticated";

revoke truncate on table "public"."whatsapp_menu_items" from "authenticated";

revoke update on table "public"."whatsapp_menu_items" from "authenticated";

revoke delete on table "public"."whatsapp_menu_items" from "service_role";

revoke insert on table "public"."whatsapp_menu_items" from "service_role";

revoke references on table "public"."whatsapp_menu_items" from "service_role";

revoke select on table "public"."whatsapp_menu_items" from "service_role";

revoke trigger on table "public"."whatsapp_menu_items" from "service_role";

revoke truncate on table "public"."whatsapp_menu_items" from "service_role";

revoke update on table "public"."whatsapp_menu_items" from "service_role";

alter table "public"."basket_contributions" drop constraint "basket_contributions_basket_id_fkey";

alter table "public"."basket_invites" drop constraint "basket_invites_status_check";

alter table "public"."basket_members" drop constraint "basket_members_basket_id_whatsapp_key";

alter table "public"."baskets" drop constraint "baskets_creator_user_id_fkey";

alter table "public"."baskets" drop constraint "baskets_type_check";

alter table "public"."baskets_reminder_events" drop constraint "baskets_reminder_events_event_check";

alter table "public"."baskets_reminder_events" drop constraint "baskets_reminder_events_reminder_id_fkey";

alter table "public"."baskets_reminders" drop constraint "baskets_reminders_ikimina_id_fkey";

alter table "public"."baskets_reminders" drop constraint "baskets_reminders_member_id_fkey";

alter table "public"."baskets_reminders" drop constraint "baskets_reminders_notification_id_fkey";

alter table "public"."baskets_reminders" drop constraint "baskets_reminders_status_check";

alter table "public"."baskets_reminders" drop constraint "baskets_reminders_type_check";

alter table "public"."business_categories" drop constraint "business_categories_slug_key";

alter table "public"."campaign_targets" drop constraint "campaign_targets_campaign_id_fkey";

alter table "public"."campaign_targets" drop constraint "campaign_targets_user_id_fkey";

alter table "public"."campaigns" drop constraint "campaigns_created_by_fkey";

alter table "public"."contribution_cycles" drop constraint "contribution_cycles_ikimina_id_fkey";

alter table "public"."contribution_cycles" drop constraint "contribution_cycles_status_check";

alter table "public"."contributions_ledger" drop constraint "contributions_ledger_source_check";

alter table "public"."credit_events" drop constraint "credit_events_user_id_fkey";

alter table "public"."deeplink_events" drop constraint "deeplink_events_event_check";

alter table "public"."deeplink_events" drop constraint "deeplink_events_token_id_fkey";

alter table "public"."deeplink_tokens" drop constraint "deeplink_tokens_flow_check";

alter table "public"."deeplink_tokens" drop constraint "deeplink_tokens_token_key";

alter table "public"."driver_status" drop constraint "driver_status_user_id_fkey";

alter table "public"."ibimina" drop constraint "ibimina_status_check";

alter table "public"."ibimina_accounts" drop constraint "ibimina_accounts_status_check";

alter table "public"."ibimina_committee" drop constraint "ibimina_committee_role_check";

alter table "public"."ibimina_members" drop constraint "ibimina_members_status_check";

alter table "public"."ibimina_settings" drop constraint "ibimina_settings_contribution_type_check";

alter table "public"."ibimina_settings" drop constraint "ibimina_settings_due_day_check";

alter table "public"."ibimina_settings" drop constraint "ibimina_settings_periodicity_check";

alter table "public"."insurance_leads" drop constraint "insurance_leads_assigned_admin_fkey";

alter table "public"."insurance_leads" drop constraint "insurance_leads_user_id_fkey";

alter table "public"."insurance_media_queue" drop constraint "insurance_media_queue_lead_id_fkey";

alter table "public"."insurance_quotes" drop constraint "insurance_quotes_user_id_fkey";

alter table "public"."kyc_documents" drop constraint "kyc_documents_doc_type_check";

alter table "public"."kyc_documents" drop constraint "kyc_documents_status_check";

alter table "public"."kyc_documents" drop constraint "kyc_documents_user_id_fkey";

alter table "public"."momo_qr_requests" drop constraint "momo_qr_requests_user_id_fkey";

alter table "public"."momo_unmatched" drop constraint "momo_unmatched_allocation_ledger_id_fkey";

alter table "public"."momo_unmatched" drop constraint "momo_unmatched_linked_member_id_fkey";

alter table "public"."momo_unmatched" drop constraint "momo_unmatched_resolved_by_fkey";

alter table "public"."momo_unmatched" drop constraint "momo_unmatched_status_check";

alter table "public"."momo_unmatched" drop constraint "momo_unmatched_suggested_member_id_fkey";

alter table "public"."profiles" drop constraint "profiles_ref_code_key";

alter table "public"."qr_tokens" drop constraint "qr_tokens_station_id_fkey";

alter table "public"."sacco_collateral" drop constraint "sacco_collateral_loan_id_fkey";

alter table "public"."sacco_collateral" drop constraint "sacco_collateral_source_check";

alter table "public"."sacco_loan_endorsements" drop constraint "sacco_loan_endorsements_committee_member_id_fkey";

alter table "public"."sacco_loan_endorsements" drop constraint "sacco_loan_endorsements_loan_id_committee_member_id_key";

alter table "public"."sacco_loan_endorsements" drop constraint "sacco_loan_endorsements_loan_id_fkey";

alter table "public"."sacco_loan_endorsements" drop constraint "sacco_loan_endorsements_vote_check";

alter table "public"."sacco_loan_events" drop constraint "sacco_loan_events_actor_id_fkey";

alter table "public"."sacco_loan_events" drop constraint "sacco_loan_events_loan_id_fkey";

alter table "public"."sacco_loans" drop constraint "sacco_loans_ikimina_id_fkey";

alter table "public"."sacco_loans" drop constraint "sacco_loans_member_id_fkey";

alter table "public"."sacco_loans" drop constraint "sacco_loans_sacco_decision_by_fkey";

alter table "public"."sacco_loans" drop constraint "sacco_loans_status_check";

alter table "public"."sacco_officers" drop constraint "sacco_officers_sacco_id_fkey";

alter table "public"."sacco_officers" drop constraint "sacco_officers_user_id_fkey";

alter table "public"."saccos" drop constraint "saccos_ltv_min_ratio_check";

alter table "public"."saccos" drop constraint "saccos_status_check";

alter table "public"."subscriptions" drop constraint "subscriptions_user_id_fkey";

alter table "public"."trips" drop constraint "trips_creator_user_id_fkey";

alter table "public"."voucher_events" drop constraint "voucher_events_actor_id_fkey";

alter table "public"."voucher_events" drop constraint "voucher_events_station_id_fkey";

alter table "public"."voucher_events" drop constraint "voucher_events_voucher_id_fkey";

alter table "public"."vouchers" drop constraint "vouchers_campaign_id_fkey";

alter table "public"."vouchers" drop constraint "vouchers_code5_format_check";

alter table "public"."vouchers" drop constraint "vouchers_created_by_fkey";

alter table "public"."vouchers" drop constraint "vouchers_station_scope_fkey";

alter table "public"."wallet_ledger" drop constraint "wallet_ledger_type_check";

alter table "public"."whatsapp_intents" drop constraint "whatsapp_intents_payload_id_key";

alter table "public"."whatsapp_menu_items" drop constraint "whatsapp_menu_items_intent_id_fkey";

alter table "public"."basket_members" drop constraint "basket_members_user_id_fkey";

alter table "public"."baskets" drop constraint "baskets_owner_profile_id_fkey";

alter table "public"."baskets" drop constraint "baskets_status_check";

alter table "public"."referral_attributions" drop constraint "referral_attributions_joiner_user_id_fkey";

alter table "public"."referral_attributions" drop constraint "referral_attributions_sharer_user_id_fkey";

alter table "public"."vouchers" drop constraint "vouchers_status_check";

drop function if exists "public"."audit_log_sync_admin_columns"();

drop function if exists "public"."enforce_loan_ltv"();

drop function if exists "public"."ensure_contact_profile"();

drop function if exists "public"."log_sacco_loan_event"();

drop function if exists "public"."marketplace_add_business"(_owner text, _name text, _description text, _catalog text, _category text, _lat double precision, _lng double precision);

drop view if exists "public"."member_rankings";

drop function if exists "public"."nearby_businesses"(_lat double precision, _lng double precision, _viewer text, _category text, _limit integer);

drop function if exists "public"."nearby_businesses_v2"(_lat double precision, _lng double precision, _viewer text, _category_slug text, _limit integer);

drop function if exists "public"."normalize_e164"(msisdn text);

drop function if exists "public"."notifications_sync_admin_columns"();

drop function if exists "public"."order_events_sync_admin_columns"();

drop function if exists "public"."orders_sync_admin_columns"();

drop view if exists "public"."profile_contact_rollup";

drop function if exists "public"."recent_bar_orders"(p_bar uuid, p_limit integer);

drop function if exists "public"."referral_apply_code"(_joiner_profile_id uuid, _joiner_whatsapp text, _code text);

drop function if exists "public"."refresh_loan_collateral_snapshot"();

drop function if exists "public"."set_bar_number_digits"();

drop function if exists "public"."top_bar_items"(p_bar uuid, p_limit integer);

drop function if exists "public"."touch_updated_at"();

drop function if exists "public"."upsert_contribution_cycle"(_ikimina_id uuid, _yyyymm character, _amount numeric);

drop function if exists "public"."vouchers_sync_admin_columns"();

drop view if exists "public"."whatsapp_menu_entries";

drop function if exists "public"."basket_create"(_profile_id uuid, _whatsapp text, _name text, _is_public boolean, _goal_minor integer);

drop view if exists "public"."leaderboard_snapshots_v";

drop function if exists "public"."recent_drivers_near"(in_lat double precision, in_lng double precision, in_vehicle_type text, in_radius_km numeric, in_max integer);

alter table "public"."audit_logs" drop constraint "audit_logs_pkey";

alter table "public"."bar_number_canonicalization_conflicts" drop constraint "bar_number_canonicalization_conflicts_pkey";

alter table "public"."baskets_reminder_events" drop constraint "baskets_reminder_events_pkey";

alter table "public"."baskets_reminders" drop constraint "baskets_reminders_pkey";

alter table "public"."business_categories" drop constraint "business_categories_pkey";

alter table "public"."campaign_targets" drop constraint "campaign_targets_pkey";

alter table "public"."contribution_cycles" drop constraint "contribution_cycles_pkey";

alter table "public"."credit_events" drop constraint "credit_events_pkey";

alter table "public"."deeplink_events" drop constraint "deeplink_events_pkey";

alter table "public"."deeplink_tokens" drop constraint "deeplink_tokens_pkey";

alter table "public"."feature_gate_audit" drop constraint "feature_gate_audit_pkey";

alter table "public"."idempotency_keys" drop constraint "idempotency_keys_pkey";

alter table "public"."insurance_quotes" drop constraint "insurance_quotes_pkey";

alter table "public"."kyc_documents" drop constraint "kyc_documents_pkey";

alter table "public"."qr_tokens" drop constraint "qr_tokens_pkey";

alter table "public"."sacco_collateral" drop constraint "sacco_collateral_pkey";

alter table "public"."sacco_loan_endorsements" drop constraint "sacco_loan_endorsements_pkey";

alter table "public"."sacco_loan_events" drop constraint "sacco_loan_events_pkey";

alter table "public"."sacco_loans" drop constraint "sacco_loans_pkey";

alter table "public"."sacco_officers" drop constraint "sacco_officers_pkey";

alter table "public"."settings" drop constraint "settings_pkey";

alter table "public"."stations" drop constraint "stations_pkey";

alter table "public"."subscriptions" drop constraint "subscriptions_pkey";

alter table "public"."voucher_events" drop constraint "voucher_events_pkey";

alter table "public"."whatsapp_intents" drop constraint "whatsapp_intents_pkey";

alter table "public"."whatsapp_menu_items" drop constraint "whatsapp_menu_items_pkey";

alter table "public"."contacts" drop constraint "contacts_pkey";

alter table "public"."leaderboard_snapshots" drop constraint "leaderboard_snapshots_pkey";

alter table "public"."referral_links" drop constraint "referral_links_pkey";

drop index if exists "public"."audit_logs_pkey";

drop index if exists "public"."bar_number_canonicalization_conflicts_pkey";

drop index if exists "public"."basket_members_basket_id_whatsapp_key";

drop index if exists "public"."baskets_reminder_events_pkey";

drop index if exists "public"."baskets_reminders_pkey";

drop index if exists "public"."business_categories_pkey";

drop index if exists "public"."business_categories_slug_key";

drop index if exists "public"."campaign_targets_campaign_idx";

drop index if exists "public"."campaign_targets_msisdn_idx";

drop index if exists "public"."campaign_targets_pkey";

drop index if exists "public"."campaign_targets_status_idx";

drop index if exists "public"."campaigns_status_idx";

drop index if exists "public"."contribution_cycles_pkey";

drop index if exists "public"."contribution_cycles_unique";

drop index if exists "public"."credit_events_pkey";

drop index if exists "public"."deeplink_events_pkey";

drop index if exists "public"."deeplink_tokens_pkey";

drop index if exists "public"."deeplink_tokens_token_key";

drop index if exists "public"."feature_gate_audit_pkey";

drop index if exists "public"."ibimina_sacco_name_key";

drop index if exists "public"."idempotency_keys_pkey";

drop index if exists "public"."idx_bar_number_conflicts_bar";

drop index if exists "public"."idx_bar_number_conflicts_numbers";

drop index if exists "public"."idx_bar_numbers_number_digits";

drop index if exists "public"."idx_basket_invites_ikimina";

drop index if exists "public"."idx_basket_invites_status";

drop index if exists "public"."idx_baskets_created_at";

drop index if exists "public"."idx_baskets_reminder_events_created";

drop index if exists "public"."idx_baskets_reminder_events_reminder";

drop index if exists "public"."idx_baskets_reminders_next_attempt";

drop index if exists "public"."idx_baskets_reminders_schedule";

drop index if exists "public"."idx_baskets_reminders_status";

drop index if exists "public"."idx_contribution_cycles_status";

drop index if exists "public"."idx_contributions_ledger_cycle";

drop index if exists "public"."idx_contributions_ledger_ikimina";

drop index if exists "public"."idx_contributions_ledger_member";

drop index if exists "public"."idx_contributions_ledger_txn_id";

drop index if exists "public"."idx_deeplink_tokens_expires";

drop index if exists "public"."idx_deeplink_tokens_flow";

drop index if exists "public"."idx_driver_loc";

drop index if exists "public"."idx_feature_gate_audit_created_at";

drop index if exists "public"."idx_feature_gate_audit_feature";

drop index if exists "public"."idx_feature_gate_audit_msisdn";

drop index if exists "public"."idx_ibimina_accounts_ikimina";

drop index if exists "public"."idx_ibimina_members_ikimina";

drop index if exists "public"."idx_ibimina_members_user";

drop index if exists "public"."idx_kyc_documents_status";

drop index if exists "public"."idx_kyc_documents_user";

drop index if exists "public"."idx_momo_parsed_txns_msisdn";

drop index if exists "public"."idx_momo_parsed_txns_txn";

drop index if exists "public"."idx_momo_sms_inbox_processed_at";

drop index if exists "public"."idx_momo_sms_inbox_received_at";

drop index if exists "public"."idx_momo_unmatched_created";

drop index if exists "public"."idx_momo_unmatched_linked_member";

drop index if exists "public"."idx_momo_unmatched_status";

drop index if exists "public"."idx_momo_unmatched_status_created";

drop index if exists "public"."idx_sacco_collateral_loan";

drop index if exists "public"."idx_sacco_loan_endorsements_loan";

drop index if exists "public"."idx_sacco_loan_endorsements_vote";

drop index if exists "public"."idx_sacco_loan_events_created";

drop index if exists "public"."idx_sacco_loan_events_loan";

drop index if exists "public"."idx_sacco_loans_ikimina";

drop index if exists "public"."idx_sacco_loans_member";

drop index if exists "public"."idx_sacco_loans_status";

drop index if exists "public"."idx_sacco_officers_sacco";

drop index if exists "public"."idx_sacco_officers_user";

drop index if exists "public"."idx_saccos_umurenge_name";

drop index if exists "public"."idx_sub_user";

drop index if exists "public"."idx_trips_created";

drop index if exists "public"."insurance_leads_status_idx";

drop index if exists "public"."insurance_media_queue_status_idx";

drop index if exists "public"."insurance_quotes_pkey";

drop index if exists "public"."insurance_quotes_status_idx";

drop index if exists "public"."insurance_quotes_user_idx";

drop index if exists "public"."kyc_documents_pkey";

drop index if exists "public"."marketplace_categories_slug_key";

drop index if exists "public"."momo_sms_inbox_hash_key";

drop index if exists "public"."notifications_status_idx";

drop index if exists "public"."order_events_order_idx";

drop index if exists "public"."order_events_type_idx";

drop index if exists "public"."orders_bar_idx";

drop index if exists "public"."orders_status_idx";

drop index if exists "public"."profiles_ref_code_key";

drop index if exists "public"."qr_tokens_pkey";

drop index if exists "public"."qr_tokens_station_idx";

drop index if exists "public"."qr_tokens_token_key";

drop index if exists "public"."sacco_collateral_pkey";

drop index if exists "public"."sacco_loan_endorsements_loan_id_committee_member_id_key";

drop index if exists "public"."sacco_loan_endorsements_pkey";

drop index if exists "public"."sacco_loan_events_pkey";

drop index if exists "public"."sacco_loans_pkey";

drop index if exists "public"."sacco_officers_pkey";

drop index if exists "public"."settings_pkey";

drop index if exists "public"."stations_engencode_key";

drop index if exists "public"."stations_location_point_idx";

drop index if exists "public"."stations_name_idx";

drop index if exists "public"."stations_pkey";

drop index if exists "public"."subscriptions_pkey";

drop index if exists "public"."voucher_events_pkey";

drop index if exists "public"."voucher_events_type_idx";

drop index if exists "public"."voucher_events_voucher_idx";

drop index if exists "public"."vouchers_campaign_idx";

drop index if exists "public"."vouchers_code5_active_idx";

drop index if exists "public"."vouchers_status_idx";

drop index if exists "public"."vouchers_user_idx";

drop index if exists "public"."whatsapp_intents_payload_id_key";

drop index if exists "public"."whatsapp_intents_pkey";

drop index if exists "public"."whatsapp_menu_items_intent_idx";

drop index if exists "public"."whatsapp_menu_items_menu_position_idx";

drop index if exists "public"."whatsapp_menu_items_pkey";

drop index if exists "public"."contacts_pkey";

drop index if exists "public"."leaderboard_snapshots_pkey";

drop index if exists "public"."referral_links_pkey";

drop index if exists "public"."trips_created_idx";

drop table "public"."audit_logs";

drop table "public"."bar_number_canonicalization_conflicts";

drop table "public"."baskets_reminder_events";

drop table "public"."baskets_reminders";

drop table "public"."business_categories";

drop table "public"."campaign_targets";

drop table "public"."contribution_cycles";

drop table "public"."credit_events";

drop table "public"."deeplink_events";

drop table "public"."deeplink_tokens";

drop table "public"."feature_gate_audit";

drop table "public"."idempotency_keys";

drop table "public"."insurance_quotes";

drop table "public"."kyc_documents";

drop table "public"."qr_tokens";

drop table "public"."sacco_collateral";

drop table "public"."sacco_loan_endorsements";

drop table "public"."sacco_loan_events";

drop table "public"."sacco_loans";

drop table "public"."sacco_officers";

drop table "public"."settings";

drop table "public"."stations";

drop table "public"."subscriptions";

drop table "public"."voucher_events";

drop table "public"."whatsapp_intents";

drop table "public"."whatsapp_menu_items";

create table "public"."campaign_recipients" (
    "id" bigint not null default nextval('campaign_recipients_id_seq'::regclass),
    "campaign_id" bigint,
    "contact_id" bigint,
    "msisdn_e164" text not null,
    "send_allowed" boolean default true,
    "window_24h_open" boolean default false
);


create table "public"."chat_sessions" (
    "user_id" text not null,
    "state" jsonb,
    "updated_at" timestamp with time zone default now()
);


alter table "public"."chat_sessions" enable row level security;

create table "public"."insurance_media" (
    "id" uuid not null default gen_random_uuid(),
    "lead_id" uuid,
    "wa_media_id" text,
    "storage_path" text not null,
    "mime_type" text,
    "created_at" timestamp with time zone default now()
);


alter table "public"."insurance_media" enable row level security;

create table "public"."leaderboard_notifications" (
    "user_id" uuid not null,
    "window" text not null,
    "last_entered_at" timestamp with time zone,
    "last_dropped_at" timestamp with time zone
);


create table "public"."segments" (
    "id" bigint not null default nextval('segments_id_seq'::regclass),
    "name" text not null,
    "description" text,
    "filter" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone default now()
);


create table "public"."send_logs" (
    "id" bigint not null default nextval('send_logs_id_seq'::regclass),
    "queue_id" bigint,
    "campaign_id" bigint not null,
    "msisdn_e164" text not null,
    "sent_at" timestamp with time zone,
    "provider_msg_id" text,
    "delivery_status" text,
    "error" text
);


create table "public"."send_queue" (
    "id" bigint not null default nextval('send_queue_id_seq'::regclass),
    "campaign_id" bigint,
    "msisdn_e164" text not null,
    "payload" jsonb not null,
    "attempt" integer default 0,
    "next_attempt_at" timestamp with time zone default now(),
    "status" text default 'PENDING'::text
);


create table "public"."shops" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "short_code" text not null,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."shops" enable row level security;

create table "public"."templates" (
    "id" bigint not null default nextval('templates_id_seq'::regclass),
    "name" text not null,
    "language_code" text not null default 'en'::text,
    "category" text,
    "status" text not null,
    "meta_id" text,
    "components" jsonb not null,
    "sample" jsonb default '{}'::jsonb,
    "last_synced_at" timestamp with time zone
);


create table "public"."wa_inbound" (
    "wa_msg_id" text not null,
    "from_msisdn" text,
    "received_at" timestamp with time zone default now()
);


alter table "public"."wa_inbound" enable row level security;

create table "public"."wa_inbox" (
    "id" bigint not null default nextval('wa_inbox_id_seq'::regclass),
    "provider_msg_id" text,
    "from_msisdn" text not null,
    "to_msisdn" text,
    "wa_timestamp" timestamp with time zone,
    "type" text,
    "payload" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone default now()
);


create table "public"."wallet_redemptions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "reward_id" text not null,
    "reward_name" text not null,
    "cost_tokens" integer not null,
    "status" text not null default 'fulfilled'::text,
    "meta" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."admin_alert_prefs" disable row level security;

alter table "public"."app_config" drop column "admin_whatsapp_numbers";

alter table "public"."app_config" drop column "momo_payee_number";

alter table "public"."app_config" drop column "support_phone_e164";

alter table "public"."app_config" add column "openai_api_key" text;

alter table "public"."app_config" add column "referral_daily_cap" integer not null default 0;

alter table "public"."app_config" add column "referral_redeem_rules" text;

alter table "public"."app_config" add column "referral_short_domain" text;

alter table "public"."app_config" add column "tokens_per_referral" integer not null default 10;

alter table "public"."app_config" add column "wallet_redeem_catalog" jsonb not null default '[]'::jsonb;

alter table "public"."app_config" add column "welcome_bonus_tokens" integer not null default 0;

alter table "public"."app_config" alter column "id" set default 1;

alter table "public"."app_config" alter column "insurance_admin_numbers" set default '{}'::text[];

alter table "public"."app_config" alter column "insurance_admin_numbers" set not null;

alter table "public"."app_config" alter column "updated_at" set default now();

alter table "public"."app_config" alter column "updated_at" drop not null;

alter table "public"."audit_log" drop column "actor_id";

alter table "public"."bar_numbers" drop column "number_digits";

alter table "public"."basket_contributions" add column "approved_at" timestamp with time zone;

alter table "public"."basket_contributions" add column "approver_user_id" uuid;

alter table "public"."basket_contributions" add column "contributor_user_id" uuid not null;

alter table "public"."basket_contributions" add column "status" text not null default 'pending'::text;

alter table "public"."basket_contributions" add column "wa_message_id" text;

alter table "public"."basket_contributions" alter column "created_at" set default now();

alter table "public"."basket_invites" drop column "last_resolved_at";

alter table "public"."basket_invites" drop column "resolved_count";

alter table "public"."basket_invites" add column "used_at" timestamp with time zone;

alter table "public"."basket_invites" alter column "created_at" set default timezone('utc'::text, now());

alter table "public"."basket_invites" disable row level security;

alter table "public"."basket_members" alter column "whatsapp" drop not null;

alter table "public"."baskets" drop column "creator_user_id";

alter table "public"."baskets" drop column "lat";

alter table "public"."baskets" drop column "lng";

alter table "public"."baskets" drop column "type";

alter table "public"."baskets" alter column "goal_minor" set data type numeric(12,2) using "goal_minor"::numeric(12,2);

alter table "public"."businesses" drop column "category";

alter table "public"."businesses" add column "geo" geography(Point,4326);

alter table "public"."businesses" alter column "category_id" set data type bigint using "category_id"::bigint;

alter table "public"."businesses" alter column "created_at" set default now();

alter table "public"."businesses" alter column "created_at" drop not null;

alter table "public"."businesses" enable row level security;

alter table "public"."campaigns" drop column "created_by";

alter table "public"."campaigns" drop column "finished_at";

alter table "public"."campaigns" drop column "metadata";

alter table "public"."campaigns" drop column "name";

alter table "public"."campaigns" drop column "started_at";

alter table "public"."campaigns" drop column "type";

alter table "public"."campaigns" add column "message_kind" text not null;

alter table "public"."campaigns" add column "payload" jsonb not null;

alter table "public"."campaigns" add column "scheduled_at" timestamp with time zone;

alter table "public"."campaigns" add column "target_audience" jsonb not null;

alter table "public"."campaigns" add column "time_zone" text default 'Africa/Kigali'::text;

alter table "public"."campaigns" add column "title" text not null;

alter table "public"."campaigns" alter column "created_at" drop not null;

alter table "public"."campaigns" alter column "id" set default nextval('campaigns_id_seq'::regclass);

alter table "public"."campaigns" alter column "id" set data type bigint using "id"::bigint;

alter table "public"."campaigns" alter column "status" set default 'DRAFT'::text;

alter table "public"."campaigns" alter column "status" drop not null;

alter table "public"."campaigns" alter column "template_id" drop not null;

alter table "public"."campaigns" alter column "template_id" set data type bigint using "template_id"::bigint;

alter table "public"."campaigns" disable row level security;

alter table "public"."chat_state" alter column "updated_at" set default now();

alter table "public"."contacts" add column "attributes" jsonb default '{}'::jsonb;

alter table "public"."contacts" add column "city" text;

alter table "public"."contacts" add column "full_name" text;

alter table "public"."contacts" add column "id" bigint not null default nextval('contacts_id_seq'::regclass);

alter table "public"."contacts" add column "last_inbound_ts" timestamp with time zone;

alter table "public"."contacts" add column "opt_in_source" text;

alter table "public"."contacts" add column "sector" text;

alter table "public"."contacts" add column "tags" text[] default '{}'::text[];

alter table "public"."contacts" alter column "opted_in" set default false;

alter table "public"."contacts" alter column "updated_at" drop not null;

alter table "public"."contributions_ledger" alter column "allocated_at" set default timezone('utc'::text, now());

alter table "public"."contributions_ledger" alter column "cycle_yyyymm" drop not null;

alter table "public"."contributions_ledger" alter column "source" set default 'admin'::text;

alter table "public"."contributions_ledger" disable row level security;

alter table "public"."driver_status" alter column "last_seen" drop default;

alter table "public"."driver_status" alter column "last_seen" drop not null;

alter table "public"."driver_status" alter column "online" drop not null;

alter table "public"."driver_status" alter column "vehicle_type" drop not null;

alter table "public"."ibimina" add column "currency" text not null default 'RWF'::text;

alter table "public"."ibimina" add column "goal_minor" numeric(12,2);

alter table "public"."ibimina" add column "is_public" boolean not null default false;

alter table "public"."ibimina" add column "lat" double precision;

alter table "public"."ibimina" add column "lng" double precision;

alter table "public"."ibimina" add column "momo_number_or_code" text;

alter table "public"."ibimina" add column "owner_profile_id" uuid;

alter table "public"."ibimina" add column "owner_whatsapp" text;

alter table "public"."ibimina" add column "updated_at" timestamp with time zone not null default timezone('utc'::text, now());

alter table "public"."ibimina" alter column "created_at" set default timezone('utc'::text, now());

alter table "public"."ibimina" disable row level security;

alter table "public"."ibimina_accounts" alter column "created_at" set default timezone('utc'::text, now());

alter table "public"."ibimina_accounts" disable row level security;

alter table "public"."ibimina_committee" alter column "created_at" set default timezone('utc'::text, now());

alter table "public"."ibimina_committee" disable row level security;

alter table "public"."ibimina_members" alter column "joined_at" set default timezone('utc'::text, now());

alter table "public"."ibimina_members" disable row level security;

alter table "public"."ibimina_settings" add column "created_at" timestamp with time zone not null default timezone('utc'::text, now());

alter table "public"."ibimina_settings" add column "updated_at" timestamp with time zone not null default timezone('utc'::text, now());

alter table "public"."ibimina_settings" disable row level security;

alter table "public"."insurance_leads" drop column "assigned_admin";

alter table "public"."insurance_leads" drop column "user_id";

alter table "public"."insurance_leads" add column "extracted_json" jsonb;

alter table "public"."insurance_leads" add column "whatsapp" text not null;

alter table "public"."insurance_leads" alter column "created_at" set default now();

alter table "public"."insurance_leads" alter column "created_at" drop not null;

alter table "public"."insurance_leads" enable row level security;

alter table "public"."insurance_media_queue" drop column "attempts";

alter table "public"."insurance_media_queue" drop column "last_attempt_at";

alter table "public"."insurance_media_queue" drop column "last_error";

alter table "public"."insurance_media_queue" drop column "lead_id";

alter table "public"."insurance_media_queue" drop column "processed_at";

alter table "public"."leaderboard_snapshots" add column "payload" jsonb not null;

alter table "public"."leaderboard_snapshots" add column "window" text not null;

alter table "public"."leaderboard_snapshots" alter column "generated_at" set default now();

alter table "public"."leaderboard_snapshots" alter column "generated_at" set not null;

alter table "public"."leaderboard_snapshots" alter column "id" drop not null;

alter table "public"."marketplace_categories" drop column "description";

alter table "public"."marketplace_categories" drop column "icon";

alter table "public"."marketplace_categories" drop column "slug";

alter table "public"."marketplace_categories" drop column "updated_at";

alter table "public"."marketplace_categories" alter column "created_at" set default now();

alter table "public"."marketplace_categories" alter column "created_at" drop not null;

alter table "public"."marketplace_categories" alter column "id" set default nextval('marketplace_categories_id_seq'::regclass);

alter table "public"."marketplace_categories" alter column "id" set data type bigint using "id"::bigint;

alter table "public"."marketplace_categories" alter column "sort_order" drop default;

alter table "public"."marketplace_categories" enable row level security;

alter table "public"."momo_parsed_txns" drop column "confidence";

alter table "public"."momo_parsed_txns" alter column "inbox_id" drop not null;

alter table "public"."momo_parsed_txns" disable row level security;

alter table "public"."momo_qr_requests" add column "amount_rwf" integer;

alter table "public"."momo_qr_requests" add column "kind" text not null;

alter table "public"."momo_qr_requests" add column "momo_value" text not null;

alter table "public"."momo_qr_requests" add column "share_url" text;

alter table "public"."momo_qr_requests" add column "ussd_text" text not null;

alter table "public"."momo_qr_requests" add column "whatsapp_e164" text not null;

alter table "public"."momo_qr_requests" alter column "created_at" set default now();

alter table "public"."momo_qr_requests" alter column "qr_url" set not null;

alter table "public"."momo_qr_requests" alter column "requester_wa_id" drop not null;

alter table "public"."momo_qr_requests" alter column "target_type" drop not null;

alter table "public"."momo_qr_requests" alter column "target_value" drop not null;

alter table "public"."momo_qr_requests" alter column "tel_uri" set not null;

alter table "public"."momo_sms_inbox" drop column "attempts";

alter table "public"."momo_sms_inbox" drop column "hash";

alter table "public"."momo_sms_inbox" drop column "ingest_source";

alter table "public"."momo_sms_inbox" drop column "last_error";

alter table "public"."momo_sms_inbox" drop column "processed_at";

alter table "public"."momo_sms_inbox" alter column "raw_text" drop not null;

alter table "public"."momo_sms_inbox" alter column "received_at" set default timezone('utc'::text, now());

alter table "public"."momo_sms_inbox" disable row level security;

alter table "public"."momo_unmatched" drop column "allocation_ledger_id";

alter table "public"."momo_unmatched" drop column "linked_member_id";

alter table "public"."momo_unmatched" drop column "resolution_notes";

alter table "public"."momo_unmatched" drop column "resolved_at";

alter table "public"."momo_unmatched" drop column "resolved_by";

alter table "public"."momo_unmatched" drop column "suggested_member_id";

alter table "public"."momo_unmatched" alter column "created_at" set default timezone('utc'::text, now());

alter table "public"."momo_unmatched" alter column "parsed_id" drop not null;

alter table "public"."momo_unmatched" alter column "reason" drop not null;

alter table "public"."momo_unmatched" disable row level security;

alter table "public"."notifications" drop column "metadata";

alter table "public"."notifications" drop column "msisdn";

alter table "public"."notifications" drop column "to_role";

alter table "public"."notifications" drop column "type";

alter table "public"."notifications" drop column "updated_at";

alter table "public"."order_events" drop column "actor_id";

alter table "public"."order_events" drop column "station_id";

alter table "public"."order_events" drop column "status";

alter table "public"."order_events" drop column "type";

alter table "public"."orders" drop column "bar_name";

alter table "public"."orders" drop column "currency";

alter table "public"."orders" drop column "override_at";

alter table "public"."orders" drop column "override_reason";

alter table "public"."orders" drop column "staff_number";

alter table "public"."orders" drop column "total";

alter table "public"."profiles" drop column "credits_balance";

alter table "public"."profiles" drop column "display_name";

alter table "public"."profiles" drop column "id";

alter table "public"."profiles" drop column "ref_code";

alter table "public"."profiles" drop column "vehicle_plate";

alter table "public"."profiles" alter column "whatsapp_e164" drop not null;

alter table "public"."referral_attributions" add column "created_at" timestamp with time zone not null default now();

alter table "public"."referral_attributions" alter column "code" set not null;

alter table "public"."referral_attributions" alter column "first_message_at" set not null;

alter table "public"."referral_attributions" alter column "joiner_user_id" set not null;

alter table "public"."referral_attributions" alter column "sharer_user_id" set not null;

alter table "public"."referral_links" add column "last_shared_at" timestamp with time zone;

alter table "public"."referral_links" alter column "created_at" set default now();

alter table "public"."saccos" drop column "contact_phone";

alter table "public"."saccos" drop column "district";

alter table "public"."saccos" drop column "ltv_min_ratio";

alter table "public"."saccos" drop column "umurenge_name";

alter table "public"."saccos" alter column "created_at" set default timezone('utc'::text, now());

alter table "public"."saccos" disable row level security;

alter table "public"."trips" alter column "created_at" set default now();

alter table "public"."trips" alter column "created_at" drop not null;

alter table "public"."trips" alter column "dropoff" set data type geometry(Point,4326) using "dropoff"::geometry(Point,4326);

alter table "public"."trips" alter column "role" drop not null;

alter table "public"."trips" alter column "status" drop default;

alter table "public"."trips" alter column "status" drop not null;

alter table "public"."trips" alter column "vehicle_type" drop not null;

alter table "public"."vouchers" drop column "amount";

alter table "public"."vouchers" drop column "campaign_id";

alter table "public"."vouchers" drop column "code5";

alter table "public"."vouchers" drop column "created_by";

alter table "public"."vouchers" drop column "expires_at";

alter table "public"."vouchers" drop column "metadata";

alter table "public"."vouchers" drop column "png_url";

alter table "public"."vouchers" drop column "qr_url";

alter table "public"."vouchers" drop column "station_scope";

alter table "public"."vouchers" disable row level security;

alter table "public"."wa_events" add column "created_at" timestamp with time zone not null default now();

alter table "public"."wa_events" alter column "received_at" set default timezone('utc'::text, now());

alter table "public"."wa_events" alter column "received_at" set not null;

alter table "public"."wallet_accounts" disable row level security;

alter table "public"."wallet_earn_actions" disable row level security;

alter table "public"."wallet_ledger" alter column "created_at" set default now();

alter table "public"."wallet_ledger" alter column "delta_tokens" set not null;

alter table "public"."wallet_ledger" alter column "id" set default nextval('wallet_ledger_id_seq'::regclass);

alter table "public"."wallet_ledger" alter column "id" set data type bigint using "id"::bigint;

alter table "public"."wallet_ledger" alter column "meta" set default '{}'::jsonb;

alter table "public"."wallet_ledger" alter column "meta" set not null;

alter table "public"."wallet_ledger" alter column "type" set not null;

alter table "public"."wallet_ledger" alter column "user_id" set not null;

alter table "public"."wallet_ledger" disable row level security;

alter table "public"."wallet_promoters" disable row level security;

alter table "public"."wallet_redeem_options" disable row level security;

alter table "public"."wallet_transactions" disable row level security;

alter table "public"."wallets" alter column "updated_at" set default now();

alter table "public"."wallets" disable row level security;

alter sequence "public"."campaign_recipients_id_seq" owned by "public"."campaign_recipients"."id";

alter sequence "public"."campaigns_id_seq" owned by "public"."campaigns"."id";

alter sequence "public"."contacts_id_seq" owned by "public"."contacts"."id";

alter sequence "public"."marketplace_categories_id_seq" owned by "public"."marketplace_categories"."id";

alter sequence "public"."segments_id_seq" owned by "public"."segments"."id";

alter sequence "public"."send_logs_id_seq" owned by "public"."send_logs"."id";

alter sequence "public"."send_queue_id_seq" owned by "public"."send_queue"."id";

alter sequence "public"."templates_id_seq" owned by "public"."templates"."id";

alter sequence "public"."wa_inbox_id_seq" owned by "public"."wa_inbox"."id";

alter sequence "public"."wallet_ledger_id_seq" owned by "public"."wallet_ledger"."id";

drop sequence if exists "public"."audit_logs_id_seq";

drop sequence if exists "public"."credit_events_id_seq";

drop sequence if exists "public"."subscriptions_id_seq";

CREATE UNIQUE INDEX baskets_join_token_key ON public.baskets USING btree (join_token);

CREATE UNIQUE INDEX campaign_recipients_campaign_id_contact_id_key ON public.campaign_recipients USING btree (campaign_id, contact_id);

CREATE UNIQUE INDEX campaign_recipients_pkey ON public.campaign_recipients USING btree (id);

CREATE UNIQUE INDEX chat_sessions_pkey ON public.chat_sessions USING btree (user_id);

CREATE UNIQUE INDEX contacts_msisdn_e164_key ON public.contacts USING btree (msisdn_e164);

CREATE UNIQUE INDEX idx_basket_members_unique ON public.basket_members USING btree (basket_id, COALESCE(user_id, profile_id), COALESCE(whatsapp, ''::text)) WHERE ((COALESCE(user_id, profile_id) IS NOT NULL) OR (COALESCE(whatsapp, ''::text) <> ''::text));

CREATE INDEX idx_bk_contrib_basket ON public.basket_contributions USING btree (basket_id);

CREATE INDEX idx_bk_contrib_contributor ON public.basket_contributions USING btree (contributor_user_id);

CREATE INDEX idx_bk_contrib_status ON public.basket_contributions USING btree (status);

CREATE INDEX idx_businesses_created ON public.businesses USING btree (created_at);

CREATE INDEX idx_businesses_geo ON public.businesses USING gist (geo);

CREATE INDEX idx_driver_status_geo ON public.driver_status USING gist (location);

CREATE INDEX idx_driver_status_last_seen ON public.driver_status USING btree (last_seen);

CREATE INDEX idx_driver_status_online ON public.driver_status USING btree (online);

CREATE INDEX idx_momo_qr_requests_created_at ON public.momo_qr_requests USING btree (created_at DESC);

CREATE INDEX idx_momo_qr_requests_user ON public.momo_qr_requests USING btree (user_id);

CREATE INDEX idx_momo_qr_requests_whatsapp ON public.momo_qr_requests USING btree (whatsapp_e164);

CREATE INDEX idx_send_queue_ready ON public.send_queue USING btree (status, next_attempt_at);

CREATE UNIQUE INDEX insurance_media_pkey ON public.insurance_media USING btree (id);

CREATE UNIQUE INDEX leaderboard_notifications_pkey ON public.leaderboard_notifications USING btree (user_id, "window");

CREATE INDEX marketplace_categories_active_sort_idx ON public.marketplace_categories USING btree (is_active, sort_order, id);

CREATE INDEX referral_attributions_code_idx ON public.referral_attributions USING btree (code);

CREATE UNIQUE INDEX referral_attributions_joiner_unique ON public.referral_attributions USING btree (joiner_user_id);

CREATE INDEX referral_attributions_sharer_created_idx ON public.referral_attributions USING btree (sharer_user_id, credited, created_at DESC);

CREATE UNIQUE INDEX segments_pkey ON public.segments USING btree (id);

CREATE UNIQUE INDEX send_logs_pkey ON public.send_logs USING btree (id);

CREATE UNIQUE INDEX send_queue_pkey ON public.send_queue USING btree (id);

CREATE UNIQUE INDEX shops_pkey ON public.shops USING btree (id);

CREATE UNIQUE INDEX shops_short_code_key ON public.shops USING btree (short_code);

CREATE UNIQUE INDEX templates_pkey ON public.templates USING btree (id);

CREATE INDEX trips_dropoff_geog_idx ON public.trips USING gist (dropoff);

CREATE INDEX trips_pickup_geog_idx ON public.trips USING gist (pickup);

CREATE UNIQUE INDEX uniq_marketplace_categories_name ON public.marketplace_categories USING btree (name);

CREATE UNIQUE INDEX uq_businesses_name_owner ON public.businesses USING btree (name, owner_whatsapp);

CREATE UNIQUE INDEX uq_chat_state_user ON public.chat_state USING btree (user_id);

CREATE UNIQUE INDEX uq_marketplace_categories_name ON public.marketplace_categories USING btree (name);

CREATE UNIQUE INDEX uq_profiles_whatsapp ON public.profiles USING btree (whatsapp_e164);

CREATE UNIQUE INDEX uq_wa_events_wa_message_id ON public.wa_events USING btree (wa_message_id);

CREATE UNIQUE INDEX wa_inbound_pkey ON public.wa_inbound USING btree (wa_msg_id);

CREATE UNIQUE INDEX wa_inbox_pkey ON public.wa_inbox USING btree (id);

CREATE UNIQUE INDEX wa_inbox_provider_msg_id_key ON public.wa_inbox USING btree (provider_msg_id);

CREATE INDEX wallet_ledger_user_created_idx ON public.wallet_ledger USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX wallet_redemptions_pkey ON public.wallet_redemptions USING btree (id);

CREATE UNIQUE INDEX contacts_pkey ON public.contacts USING btree (id);

CREATE UNIQUE INDEX leaderboard_snapshots_pkey ON public.leaderboard_snapshots USING btree ("window");

CREATE UNIQUE INDEX referral_links_pkey ON public.referral_links USING btree (user_id);

CREATE INDEX trips_created_idx ON public.trips USING btree (created_at);

alter table "public"."campaign_recipients" add constraint "campaign_recipients_pkey" PRIMARY KEY using index "campaign_recipients_pkey";

alter table "public"."chat_sessions" add constraint "chat_sessions_pkey" PRIMARY KEY using index "chat_sessions_pkey";

alter table "public"."insurance_media" add constraint "insurance_media_pkey" PRIMARY KEY using index "insurance_media_pkey";

alter table "public"."leaderboard_notifications" add constraint "leaderboard_notifications_pkey" PRIMARY KEY using index "leaderboard_notifications_pkey";

alter table "public"."segments" add constraint "segments_pkey" PRIMARY KEY using index "segments_pkey";

alter table "public"."send_logs" add constraint "send_logs_pkey" PRIMARY KEY using index "send_logs_pkey";

alter table "public"."send_queue" add constraint "send_queue_pkey" PRIMARY KEY using index "send_queue_pkey";

alter table "public"."shops" add constraint "shops_pkey" PRIMARY KEY using index "shops_pkey";

alter table "public"."templates" add constraint "templates_pkey" PRIMARY KEY using index "templates_pkey";

alter table "public"."wa_inbound" add constraint "wa_inbound_pkey" PRIMARY KEY using index "wa_inbound_pkey";

alter table "public"."wa_inbox" add constraint "wa_inbox_pkey" PRIMARY KEY using index "wa_inbox_pkey";

alter table "public"."wallet_redemptions" add constraint "wallet_redemptions_pkey" PRIMARY KEY using index "wallet_redemptions_pkey";

alter table "public"."contacts" add constraint "contacts_pkey" PRIMARY KEY using index "contacts_pkey";

alter table "public"."leaderboard_snapshots" add constraint "leaderboard_snapshots_pkey" PRIMARY KEY using index "leaderboard_snapshots_pkey";

alter table "public"."referral_links" add constraint "referral_links_pkey" PRIMARY KEY using index "referral_links_pkey";

alter table "public"."basket_contributions" add constraint "basket_contributions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."basket_contributions" validate constraint "basket_contributions_status_check";

alter table "public"."basket_invites" add constraint "basket_invites_token_key" UNIQUE using index "basket_invites_token_key";

alter table "public"."baskets" add constraint "baskets_join_token_key" UNIQUE using index "baskets_join_token_key";

alter table "public"."campaign_recipients" add constraint "campaign_recipients_campaign_id_contact_id_key" UNIQUE using index "campaign_recipients_campaign_id_contact_id_key";

alter table "public"."campaign_recipients" add constraint "campaign_recipients_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE not valid;

alter table "public"."campaign_recipients" validate constraint "campaign_recipients_campaign_id_fkey";

alter table "public"."campaign_recipients" add constraint "campaign_recipients_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE not valid;

alter table "public"."campaign_recipients" validate constraint "campaign_recipients_contact_id_fkey";

alter table "public"."campaigns" add constraint "campaigns_message_kind_check" CHECK ((message_kind = ANY (ARRAY['TEMPLATE'::text, 'TEXT'::text, 'INTERACTIVE'::text]))) not valid;

alter table "public"."campaigns" validate constraint "campaigns_message_kind_check";

alter table "public"."campaigns" add constraint "campaigns_status_check" CHECK ((status = ANY (ARRAY['DRAFT'::text, 'QUEUED'::text, 'SENDING'::text, 'PAUSED'::text, 'COMPLETED'::text, 'FAILED'::text]))) not valid;

alter table "public"."campaigns" validate constraint "campaigns_status_check";

alter table "public"."campaigns" add constraint "campaigns_template_id_fkey" FOREIGN KEY (template_id) REFERENCES templates(id) not valid;

alter table "public"."campaigns" validate constraint "campaigns_template_id_fkey";

alter table "public"."contacts" add constraint "contacts_msisdn_e164_key" UNIQUE using index "contacts_msisdn_e164_key";

alter table "public"."ibimina" add constraint "ibimina_owner_profile_id_fkey" FOREIGN KEY (owner_profile_id) REFERENCES profiles(user_id) not valid;

alter table "public"."ibimina" validate constraint "ibimina_owner_profile_id_fkey";

alter table "public"."ibimina" add constraint "ibimina_slug_key" UNIQUE using index "ibimina_slug_key";

alter table "public"."insurance_media" add constraint "insurance_media_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES insurance_leads(id) ON DELETE CASCADE not valid;

alter table "public"."insurance_media" validate constraint "insurance_media_lead_id_fkey";

alter table "public"."leaderboard_notifications" add constraint "leaderboard_notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE not valid;

alter table "public"."leaderboard_notifications" validate constraint "leaderboard_notifications_user_id_fkey";

alter table "public"."momo_qr_requests" add constraint "momo_qr_requests_kind_check" CHECK ((kind = ANY (ARRAY['number'::text, 'code'::text]))) not valid;

alter table "public"."momo_qr_requests" validate constraint "momo_qr_requests_kind_check";

alter table "public"."momo_qr_requests" add constraint "momo_qr_requests_user_fk" FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."momo_qr_requests" validate constraint "momo_qr_requests_user_fk";

alter table "public"."referral_attributions" add constraint "referral_attributions_code_fkey" FOREIGN KEY (code) REFERENCES referral_links(code) ON DELETE RESTRICT not valid;

alter table "public"."referral_attributions" validate constraint "referral_attributions_code_fkey";

alter table "public"."referral_links" add constraint "referral_links_code_key" UNIQUE using index "referral_links_code_key";

alter table "public"."saccos" add constraint "saccos_branch_code_key" UNIQUE using index "saccos_branch_code_key";

alter table "public"."send_logs" add constraint "send_logs_queue_id_fkey" FOREIGN KEY (queue_id) REFERENCES send_queue(id) ON DELETE CASCADE not valid;

alter table "public"."send_logs" validate constraint "send_logs_queue_id_fkey";

alter table "public"."send_queue" add constraint "send_queue_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE not valid;

alter table "public"."send_queue" validate constraint "send_queue_campaign_id_fkey";

alter table "public"."send_queue" add constraint "send_queue_status_check" CHECK ((status = ANY (ARRAY['PENDING'::text, 'SENT'::text, 'FAILED'::text, 'SKIPPED'::text]))) not valid;

alter table "public"."send_queue" validate constraint "send_queue_status_check";

alter table "public"."shops" add constraint "shops_short_code_key" UNIQUE using index "shops_short_code_key";

alter table "public"."templates" add constraint "templates_category_check" CHECK ((category = ANY (ARRAY['MARKETING'::text, 'UTILITY'::text, 'AUTHENTICATION'::text, 'SERVICE'::text]))) not valid;

alter table "public"."templates" validate constraint "templates_category_check";

alter table "public"."templates" add constraint "templates_status_check" CHECK ((status = ANY (ARRAY['APPROVED'::text, 'REJECTED'::text, 'PENDING'::text, 'DRAFT'::text]))) not valid;

alter table "public"."templates" validate constraint "templates_status_check";

alter table "public"."vouchers" add constraint "vouchers_code_5_check" CHECK ((code_5 ~ '^[0-9]{5}$'::text)) not valid;

alter table "public"."vouchers" validate constraint "vouchers_code_5_check";

alter table "public"."wa_inbox" add constraint "wa_inbox_provider_msg_id_key" UNIQUE using index "wa_inbox_provider_msg_id_key";

alter table "public"."wallet_redemptions" add constraint "wallet_redemptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE not valid;

alter table "public"."wallet_redemptions" validate constraint "wallet_redemptions_user_id_fkey";

alter table "public"."basket_members" add constraint "basket_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE SET NULL not valid;

alter table "public"."basket_members" validate constraint "basket_members_user_id_fkey";

alter table "public"."baskets" add constraint "baskets_owner_profile_id_fkey" FOREIGN KEY (owner_profile_id) REFERENCES profiles(user_id) not valid;

alter table "public"."baskets" validate constraint "baskets_owner_profile_id_fkey";

alter table "public"."baskets" add constraint "baskets_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'locked'::text, 'closed'::text, 'archived'::text]))) NOT VALID not valid;

alter table "public"."baskets" validate constraint "baskets_status_check";

alter table "public"."referral_attributions" add constraint "referral_attributions_joiner_user_id_fkey" FOREIGN KEY (joiner_user_id) REFERENCES profiles(user_id) ON DELETE CASCADE not valid;

alter table "public"."referral_attributions" validate constraint "referral_attributions_joiner_user_id_fkey";

alter table "public"."referral_attributions" add constraint "referral_attributions_sharer_user_id_fkey" FOREIGN KEY (sharer_user_id) REFERENCES profiles(user_id) ON DELETE CASCADE not valid;

alter table "public"."referral_attributions" validate constraint "referral_attributions_sharer_user_id_fkey";

alter table "public"."vouchers" add constraint "vouchers_status_check" CHECK ((status = ANY (ARRAY['issued'::text, 'redeemed'::text, 'cancelled'::text, 'expired'::text]))) not valid;

alter table "public"."vouchers" validate constraint "vouchers_status_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public._touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end$function$
;

CREATE OR REPLACE FUNCTION public.basket_create(_profile_id uuid, _whatsapp text, _name text, _is_public boolean, _goal_minor numeric)
 RETURNS TABLE(basket_id uuid, share_token text, qr_url text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_basket_id uuid;
  v_token text;
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF _profile_id IS NULL THEN
    RAISE EXCEPTION 'basket_profile_required' USING MESSAGE = 'Profile required';
  END IF;

  v_token := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  INSERT INTO public.baskets (
    owner_profile_id,
    owner_whatsapp,
    name,
    is_public,
    goal_minor,
    share_token,
    join_token,
    join_token_revoked,
    status,
    created_at,
    updated_at
  )
  VALUES (
    _profile_id,
    COALESCE(_whatsapp, ''),
    _name,
    COALESCE(_is_public, false),
    _goal_minor,
    v_token,
    v_token,
    false,
    'open',
    v_now,
    v_now
  )
  RETURNING id INTO v_basket_id;

  INSERT INTO public.basket_members (
    basket_id,
    profile_id,
    user_id,
    whatsapp,
    role,
    joined_at,
    joined_via,
    join_reference
  )
  VALUES (
    v_basket_id,
    _profile_id,
    _profile_id,
    COALESCE(_whatsapp, ''),
    'owner',
    v_now,
    'create',
    v_token
  )
  ON CONFLICT DO NOTHING;

  basket_id := v_basket_id;
  share_token := v_token;
  qr_url := 'https://quickchart.io/qr?text=JB:' || v_token;
  RETURN NEXT;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.dashboard_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  total_baskets bigint;
  active_baskets bigint;
  pending_baskets bigint;
  total_members bigint;
BEGIN
  SELECT count(*) INTO total_baskets FROM public.ibimina;
  SELECT count(*) INTO active_baskets FROM public.ibimina WHERE status = 'active';
  SELECT count(*) INTO pending_baskets FROM public.ibimina WHERE status = 'pending';
  SELECT count(*) INTO total_members FROM public.ibimina_members WHERE status = 'active';

  RETURN jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object(
        'label', 'Total Baskets',
        'primaryValue', total_baskets::text,
        'secondaryValue', concat(active_baskets, ' active'),
        'trend', null
      ),
      jsonb_build_object(
        'label', 'Pending Approvals',
        'primaryValue', pending_baskets::text,
        'secondaryValue', null,
        'trend', null
      ),
      jsonb_build_object(
        'label', 'Active Members',
        'primaryValue', total_members::text,
        'secondaryValue', null,
        'trend', null
      )
    ),
    'timeseries', jsonb_build_array()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_sync_basket_invites_to_baskets()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  active_token text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE public.baskets
    SET share_token = NEW.token,
        join_token = NEW.token,
        join_token_revoked = false,
        updated_at = timezone('utc', now())
    WHERE id = NEW.ikimina_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'active' THEN
      UPDATE public.baskets
      SET share_token = NEW.token,
          join_token = NEW.token,
          join_token_revoked = false,
          updated_at = timezone('utc', now())
      WHERE id = NEW.ikimina_id;
    ELSE
      SELECT token INTO active_token
      FROM public.basket_invites
      WHERE ikimina_id = NEW.ikimina_id
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1;

      IF active_token IS NULL THEN
        UPDATE public.baskets
        SET share_token = NULL,
            join_token = NULL,
            join_token_revoked = true,
            updated_at = timezone('utc', now())
        WHERE id = NEW.ikimina_id;
      ELSE
        UPDATE public.baskets
        SET share_token = active_token,
            join_token = active_token,
            join_token_revoked = false,
            updated_at = timezone('utc', now())
        WHERE id = NEW.ikimina_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_sync_basket_members_to_ibimina()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  target_user uuid;
  joined_at_value timestamptz;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.ibimina_members
    SET status = 'removed'
    WHERE id = OLD.id;

    DELETE FROM public.ibimina_committee
    WHERE member_id = OLD.id;

    RETURN OLD;
  END IF;

  target_user := COALESCE(
    NEW.user_id,
    NEW.profile_id,
    (SELECT user_id FROM public.profiles WHERE whatsapp_e164 = NEW.whatsapp LIMIT 1)
  );

  IF target_user IS NULL THEN
    RETURN NEW;
  END IF;

  joined_at_value := COALESCE(NEW.joined_at, timezone('utc', now()));

  INSERT INTO public.ibimina_members (id, ikimina_id, user_id, joined_at, status)
  VALUES (NEW.id, NEW.basket_id, target_user, joined_at_value, 'active')
  ON CONFLICT (id) DO UPDATE
  SET ikimina_id = EXCLUDED.ikimina_id,
      user_id = EXCLUDED.user_id,
      joined_at = EXCLUDED.joined_at,
      status = 'active';

  IF NEW.role = 'owner' THEN
    INSERT INTO public.ibimina_committee (ikimina_id, member_id, role)
    VALUES (NEW.basket_id, NEW.id, 'president')
    ON CONFLICT (ikimina_id, role) DO UPDATE
    SET member_id = EXCLUDED.member_id;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_sync_baskets_to_ibimina()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  mapped_status text;
  slug text;
  goal_value numeric(12,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.ibimina
    SET status = 'suspended'
    WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  mapped_status := CASE NEW.status
    WHEN 'open' THEN 'active'
    WHEN 'closed' THEN 'suspended'
    ELSE 'pending'
  END;

  slug := COALESCE(NEW.name, 'basket');
  slug := regexp_replace(lower(slug), '[^a-z0-9]+', '-', 'g');
  slug := trim(both '-' FROM slug);
  IF slug = '' THEN
    slug := substr(encode(gen_random_bytes(4), 'hex'), 1, 8);
  END IF;

  goal_value := CASE WHEN NEW.goal_minor IS NULL THEN NULL ELSE NEW.goal_minor::numeric END;

  INSERT INTO public.ibimina (
    id,
    name,
    description,
    slug,
    status,
    created_at,
    owner_profile_id,
    owner_whatsapp,
    is_public,
    goal_minor,
    currency,
    momo_number_or_code
  )
  VALUES (
    NEW.id,
    NEW.name,
    NEW.description,
    slug,
    mapped_status,
    COALESCE(NEW.created_at, timezone('utc', now())),
    NEW.owner_profile_id,
    NEW.owner_whatsapp,
    COALESCE(NEW.is_public, false),
    goal_value,
    COALESCE(NEW.currency, 'RWF'),
    NEW.momo_number_or_code
  )
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      slug = EXCLUDED.slug,
      status = EXCLUDED.status,
      created_at = EXCLUDED.created_at,
      owner_profile_id = EXCLUDED.owner_profile_id,
      owner_whatsapp = EXCLUDED.owner_whatsapp,
      is_public = EXCLUDED.is_public,
      goal_minor = EXCLUDED.goal_minor,
      currency = EXCLUDED.currency,
      momo_number_or_code = EXCLUDED.momo_number_or_code,
      updated_at = timezone('utc', now());

  INSERT INTO public.ibimina_settings (ikimina_id)
  VALUES (NEW.id)
  ON CONFLICT (ikimina_id) DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.issue_basket_invite_token(_basket_id uuid, _created_by uuid, _explicit_token text DEFAULT NULL::text, _ttl interval DEFAULT '14 days'::interval)
 RETURNS TABLE(id uuid, basket_id uuid, token text, expires_at timestamp with time zone, created_at timestamp with time zone, created_by uuid, used_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_expiry timestamptz := v_now + COALESCE(_ttl, interval '14 days');
  v_token text;
  v_record public.basket_invites%ROWTYPE;
  v_creator_member uuid;
BEGIN
  v_token := COALESCE(
    _explicit_token,
    upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6))
  );

  SELECT m.id INTO v_creator_member
  FROM public.ibimina_members m
  WHERE m.ikimina_id = _basket_id
    AND m.user_id = _created_by
    AND m.status = 'active'
  LIMIT 1;

  INSERT INTO public.basket_invites (
    ikimina_id,
    token,
    issuer_member_id,
    expires_at,
    status
  )
  VALUES (
    _basket_id,
    v_token,
    v_creator_member,
    v_expiry,
    'active'
  )
  RETURNING * INTO v_record;

  UPDATE public.baskets
  SET share_token = v_record.token,
      join_token = v_record.token,
      join_token_revoked = false,
      updated_at = timezone('utc', now())
  WHERE public.baskets.id = _basket_id;

  id := v_record.id;
  basket_id := v_record.ikimina_id;
  token := v_record.token;
  expires_at := v_record.expires_at;
  created_at := v_record.created_at;
  created_by := _created_by;
  used_at := v_record.used_at;
  RETURN NEXT;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.km(a geography, b geography)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select (st_distance(a,b) / 1000.0)::numeric
$function$
;

CREATE OR REPLACE FUNCTION public.mark_driver_served(viewer_e164 text, driver_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  insert into public.served_drivers(viewer_passenger_msisdn, driver_contact_id, expires_at)
  values (viewer_e164, driver_uuid, now() + interval '15 minutes')
  on conflict (viewer_passenger_msisdn, driver_contact_id)
  do update set expires_at = excluded.expires_at, created_at = now();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_passenger_served(viewer_e164 text, trip_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  insert into public.served_passengers(viewer_driver_msisdn, passenger_trip_id, expires_at)
  values (viewer_e164, trip_uuid, now() + interval '15 minutes')
  on conflict (viewer_driver_msisdn, passenger_trip_id)
  do update set expires_at = excluded.expires_at, created_at = now();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_served(_viewer text, _kind text, _target_pk text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  if _kind = 'driver' then
    insert into public.served_drivers (viewer_passenger_msisdn, driver_contact_id, expires_at)
    values (_viewer, (_target_pk)::uuid, now() + interval '15 minutes')
    on conflict (viewer_passenger_msisdn, driver_contact_id)
    do update set expires_at = excluded.expires_at, created_at = now();

  elsif _kind = 'passenger' then
    insert into public.served_passengers (viewer_driver_msisdn, passenger_trip_id, expires_at)
    values (_viewer, (_target_pk)::uuid, now() + interval '15 minutes')
    on conflict (viewer_driver_msisdn, passenger_trip_id)
    do update set expires_at = excluded.expires_at, created_at = now();

  else
    -- businesses are never served; do nothing
    perform 1;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.marketplace_add_business(_owner text, _name text, _description text, _catalog text, _lat double precision, _lng double precision)
 RETURNS uuid
 LANGUAGE sql
AS $function$
  INSERT INTO public.businesses (owner_whatsapp, name, description, catalog_url, lat, lng)
  VALUES (_owner, _name, _description, _catalog, _lat, _lng)
  RETURNING id;
$function$
;

CREATE OR REPLACE FUNCTION public.nearby_businesses(_lat double precision, _lng double precision, _viewer text, _limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, owner_whatsapp text, name text, description text, location_text text, distance_km double precision)
 LANGUAGE sql
AS $function$
  SELECT b.id,
         b.owner_whatsapp,
         b.name,
         b.description,
         b.location_text,
         CASE
           WHEN b.lat IS NULL OR b.lng IS NULL THEN NULL
           ELSE public.haversine_km(b.lat, b.lng, _lat, _lng)
         END AS distance_km
  FROM public.businesses b
  WHERE b.is_active = true
  ORDER BY distance_km NULLS LAST, b.created_at DESC
  LIMIT COALESCE(_limit, 10);
$function$
;

CREATE OR REPLACE FUNCTION public.purge_expired_served()
 RETURNS integer
 LANGUAGE sql
AS $function$
  with d1 as (
    delete from public.served_drivers    where expires_at <= now() returning 1
  ), d2 as (
    delete from public.served_passengers where expires_at <= now() returning 1
  )
  select coalesce((select count(*) from d1),0) + coalesce((select count(*) from d2),0);
$function$
;

CREATE OR REPLACE FUNCTION public.recent_businesses_near(in_lat double precision, in_lng double precision, in_category_id integer, in_radius_km numeric, in_max integer)
 RETURNS TABLE(business_id bigint, name text, owner_user_id uuid, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
  select b.id, b.name, b.owner_user_id, b.created_at
  from businesses b
  where (in_category_id is null or b.category_id = in_category_id)
    and st_dwithin(
      b.location::geography,
      st_setsrid(st_makepoint(in_lng, in_lat), 4326),
      in_radius_km * 1000
    )
  order by b.created_at desc
  limit greatest(in_max, 1);
$function$
;

CREATE OR REPLACE FUNCTION public.round(value double precision, ndigits integer)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select round((value)::numeric, ndigits);
$function$
;

CREATE OR REPLACE FUNCTION public.wallet_apply_delta(p_user_id uuid, p_delta integer, p_type text, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(balance integer, ledger_id bigint)
 LANGUAGE plpgsql
AS $function$
declare
  new_balance integer;
  inserted_id bigint;
begin
  insert into public.wallets(user_id, balance_tokens, updated_at)
  values (p_user_id, 0, now())
  on conflict (user_id) do nothing;

  insert into public.wallet_ledger(user_id, delta_tokens, type, meta)
  values (p_user_id, p_delta, p_type, coalesce(p_meta, '{}'::jsonb))
  returning id into inserted_id;

  update public.wallets
  set balance_tokens = balance_tokens + p_delta,
      updated_at = now()
  where user_id = p_user_id
  returning balance_tokens into new_balance;

  return query select coalesce(new_balance, 0), inserted_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_sub_command(_action text, _reference text, _actor text)
 RETURNS TABLE(status text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_status text;
BEGIN
  IF _action IS NULL OR _reference IS NULL THEN
    status := 'invalid';
    RETURN NEXT;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_submissions WHERE reference = _reference) THEN
    INSERT INTO public.admin_submissions (reference, applicant_name)
    VALUES (_reference, NULL)
    ON CONFLICT (reference) DO NOTHING;
  END IF;
  IF _action = 'approve' THEN
    UPDATE public.admin_submissions SET status = 'approved' WHERE reference = _reference;
    v_status := 'approved';
  ELSIF _action = 'reject' THEN
    UPDATE public.admin_submissions SET status = 'rejected' WHERE reference = _reference;
    v_status := 'rejected';
  ELSE
    v_status := 'unknown_action';
  END IF;
  INSERT INTO public.admin_audit_log (actor_wa, action, target, details)
  VALUES (_actor, 'sub_' || _action, _reference, jsonb_build_object('reference', _reference));
  status := v_status;
  RETURN NEXT;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_sub_list_pending(_limit integer DEFAULT 10)
 RETURNS TABLE(reference text, name text, submitted_at timestamp with time zone)
 LANGUAGE sql
AS $function$
  SELECT reference, applicant_name, submitted_at
  FROM public.admin_submissions
  WHERE status = 'pending'
  ORDER BY submitted_at ASC
  LIMIT COALESCE(_limit, 10);
$function$
;

CREATE OR REPLACE FUNCTION public.auth_bar_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  SELECT NULLIF(public.auth_claim('bar_id'), '')::uuid;
$function$
;

CREATE OR REPLACE FUNCTION public.auth_claim(text)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COALESCE(current_setting('request.jwt.claim.' || $1, true), '');
$function$
;

CREATE OR REPLACE FUNCTION public.auth_customer_id()
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'auth_customer_id() is deprecated. Use auth_profile_id().' USING ERRCODE = 'P0001';
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auth_profile_id()
 RETURNS uuid
 LANGUAGE sql
AS $function$
  SELECT NULLIF(public.auth_claim('profile_id'), '')::uuid;
$function$
;

CREATE OR REPLACE FUNCTION public.auth_role()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT public.auth_claim('role');
$function$
;

CREATE OR REPLACE FUNCTION public.auth_wa_id()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT public.auth_claim('wa_id');
$function$
;

CREATE OR REPLACE FUNCTION public.basket_close(_profile_id uuid, _basket_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.baskets
  SET status = 'closed', updated_at = timezone('utc', now())
  WHERE id = _basket_id AND (owner_profile_id = _profile_id OR owner_profile_id IS NULL);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.basket_create(_profile_id uuid, _whatsapp text, _name text, _is_public boolean, _goal_minor integer)
 RETURNS TABLE(basket_id uuid, share_token text, qr_url text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_basket_id uuid;
  v_token text;
  v_updated integer;
  v_now timestamptz := timezone('utc', now());
  v_whatsapp text := COALESCE(_whatsapp, '');
BEGIN
  IF _profile_id IS NULL THEN
    RAISE EXCEPTION 'basket_profile_required'
      USING MESSAGE = 'A profile is required to create a basket.';
  END IF;

  v_token := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  INSERT INTO public.baskets (
    owner_profile_id,
    owner_whatsapp,
    creator_user_id,
    name,
    is_public,
    goal_minor,
    share_token,
    join_token,
    join_token_revoked,
    status,
    created_at,
    updated_at
  )
  VALUES (
    _profile_id,
    v_whatsapp,
    _profile_id,
    _name,
    COALESCE(_is_public, false),
    _goal_minor,
    v_token,
    v_token,
    false,
    'open',
    v_now,
    v_now
  )
  RETURNING id INTO v_basket_id;

  UPDATE public.basket_members
  SET profile_id = _profile_id,
      user_id = _profile_id,
      whatsapp = v_whatsapp,
      role = 'owner',
      joined_at = v_now,
      joined_via = 'create',
      join_reference = v_token
  WHERE basket_id = v_basket_id
    AND (
      (user_id IS NOT NULL AND user_id = _profile_id)
      OR COALESCE(whatsapp, '') = v_whatsapp
    )
  RETURNING 1 INTO v_updated;

  IF NOT FOUND THEN
    INSERT INTO public.basket_members (
      basket_id,
      profile_id,
      user_id,
      whatsapp,
      role,
      joined_at,
      joined_via,
      join_reference
    )
    VALUES (
      v_basket_id,
      _profile_id,
      _profile_id,
      v_whatsapp,
      'owner',
      v_now,
      'create',
      v_token
    );
  END IF;

  basket_id := v_basket_id;
  share_token := v_token;
  qr_url := 'https://quickchart.io/qr?text=JB:' || v_token;
  RETURN NEXT;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.basket_detail(_profile_id uuid, _basket_id uuid)
 RETURNS TABLE(id uuid, name text, status text, member_count integer, balance_minor integer, goal_minor integer, currency text, share_token text, is_owner boolean, owner_name text, owner_whatsapp text, last_activity timestamp with time zone)
 LANGUAGE sql
AS $function$
  SELECT b.id,
         b.name,
         b.status,
         (SELECT count(*) FROM public.basket_members bm WHERE bm.basket_id = b.id) AS member_count,
         COALESCE((SELECT sum(amount_minor) FROM public.basket_contributions bc WHERE bc.basket_id = b.id), 0) AS balance_minor,
         b.goal_minor,
         b.currency,
         b.share_token,
         (b.owner_profile_id = _profile_id OR b.owner_whatsapp = public.profile_wa(_profile_id)) AS is_owner,
         (SELECT display_name FROM public.profiles p WHERE p.user_id = b.owner_profile_id) AS owner_name,
         b.owner_whatsapp,
         GREATEST(
           b.updated_at,
           COALESCE((SELECT max(bm.joined_at) FROM public.basket_members bm WHERE bm.basket_id = b.id), b.updated_at),
           COALESCE((SELECT max(bc.created_at) FROM public.basket_contributions bc WHERE bc.basket_id = b.id), b.updated_at)
         ) AS last_activity
  FROM public.baskets b
  WHERE b.id = _basket_id;
$function$
;

CREATE OR REPLACE FUNCTION public.basket_discover_nearby(_profile_id uuid, _lat double precision, _lng double precision, _limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, name text, description text, distance_km double precision, member_count integer)
 LANGUAGE sql
AS $function$
  SELECT b.id,
         b.name,
         b.description,
         CASE
           WHEN b.lat IS NULL OR b.lng IS NULL THEN NULL
           ELSE public.haversine_km(b.lat, b.lng, _lat, _lng)
         END AS distance_km,
         (SELECT count(*) FROM public.basket_members bm WHERE bm.basket_id = b.id) AS member_count
  FROM public.baskets b
  WHERE b.is_public = true AND b.status::text = 'open'
  ORDER BY distance_km NULLS LAST, b.created_at DESC
  LIMIT COALESCE(_limit, 10);
$function$
;

CREATE OR REPLACE FUNCTION public.basket_generate_qr(_profile_id uuid, _basket_id uuid)
 RETURNS TABLE(qr_url text)
 LANGUAGE sql
AS $function$
  SELECT 'https://quickchart.io/qr?text=JB:' || COALESCE(share_token, '') AS qr_url
  FROM public.baskets
  WHERE id = _basket_id;
$function$
;

CREATE OR REPLACE FUNCTION public.basket_join_by_code(_profile_id uuid, _whatsapp text, _code text)
 RETURNS TABLE(basket_id uuid, basket_name text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_token text;
  v_contact text := COALESCE(_whatsapp, '');
  v_basket public.baskets;
  v_now timestamptz := timezone('utc', now());
  v_joined public.basket_members;
  v_attempts integer;
BEGIN
  IF _code IS NULL OR length(trim(_code)) < 4 THEN
    RAISE EXCEPTION 'basket_code_invalid'
      USING MESSAGE = 'That join code looks invalid.';
  END IF;

  v_token := upper(regexp_replace(trim(_code), '^JB[:\-]?', ''));
  IF length(v_token) < 4 THEN
    RAISE EXCEPTION 'basket_code_invalid'
      USING MESSAGE = 'That join code looks invalid.';
  END IF;

  SELECT * INTO v_basket
  FROM public.baskets b
  WHERE COALESCE(b.join_token, b.share_token) = v_token
  LIMIT 1;

  IF v_basket.id IS NULL THEN
    RAISE EXCEPTION 'basket_code_not_found'
      USING MESSAGE = 'No basket found for that code.';
  END IF;

  IF COALESCE(v_basket.join_token_revoked, false) THEN
    RAISE EXCEPTION 'basket_code_revoked'
      USING MESSAGE = 'This join code has been revoked.';
  END IF;

  IF v_basket.status IS NULL OR v_basket.status::text <> 'open' THEN
    RAISE EXCEPTION 'basket_not_joinable'
      USING MESSAGE = 'This basket is not accepting new members.';
  END IF;

  SELECT count(*) INTO v_attempts
  FROM public.basket_members bm
  WHERE bm.joined_at >= v_now - interval '5 minutes'
    AND (
      (_profile_id IS NOT NULL AND (bm.profile_id = _profile_id OR bm.user_id = _profile_id))
      OR (v_contact <> '' AND COALESCE(bm.whatsapp, '') = v_contact)
    );

  IF v_attempts >= 5 THEN
    RAISE EXCEPTION 'basket_join_rate_limit'
      USING MESSAGE = 'Too many join attempts. Wait a few minutes and try again.';
  END IF;

  UPDATE public.basket_members
  SET profile_id = COALESCE(_profile_id, profile_id),
      user_id = COALESCE(_profile_id, user_id),
      whatsapp = CASE WHEN v_contact = '' THEN whatsapp ELSE v_contact END,
      role = CASE WHEN role = 'owner' THEN role ELSE 'member' END,
      joined_at = v_now,
      joined_via = 'code',
      join_reference = v_token
  WHERE basket_id = v_basket.id
    AND (
      (_profile_id IS NOT NULL AND (profile_id = _profile_id OR user_id = _profile_id))
      OR (v_contact <> '' AND COALESCE(whatsapp, '') = v_contact)
    )
  RETURNING * INTO v_joined;

  IF NOT FOUND THEN
    INSERT INTO public.basket_members (
      basket_id,
      profile_id,
      user_id,
      whatsapp,
      role,
      joined_at,
      joined_via,
      join_reference
    )
    VALUES (
      v_basket.id,
      _profile_id,
      _profile_id,
      NULLIF(v_contact, ''),
      'member',
      v_now,
      'code',
      v_token
    )
    RETURNING * INTO v_joined;
  END IF;

  basket_id := v_basket.id;
  basket_name := v_basket.name;
  RETURN NEXT;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.basket_leave(_profile_id uuid, _basket_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM public.basket_members
  WHERE basket_id = _basket_id
    AND (profile_id = _profile_id OR (SELECT whatsapp_e164 FROM public.profiles WHERE user_id = _profile_id) = whatsapp);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.basket_list_mine(_profile_id uuid)
 RETURNS TABLE(id uuid, name text, status text, member_count integer, balance_minor integer, currency text)
 LANGUAGE sql
AS $function$
  SELECT b.id,
         b.name,
         b.status,
         (SELECT count(*) FROM public.basket_members bm WHERE bm.basket_id = b.id) AS member_count,
         COALESCE((SELECT sum(amount_minor) FROM public.basket_contributions bc WHERE bc.basket_id = b.id), 0) AS balance_minor,
         b.currency
  FROM public.baskets b
  WHERE EXISTS (
    SELECT 1 FROM public.basket_members m
    WHERE m.basket_id = b.id
      AND (
        (_profile_id IS NOT NULL AND m.profile_id = _profile_id)
        OR (
          COALESCE(public.profile_wa(_profile_id), '') <> ''
          AND m.whatsapp = public.profile_wa(_profile_id)
        )
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.fn_assert_basket_create_rate_limit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_owner uuid := NEW.owner_profile_id;
  v_recent_window interval := interval '10 minutes';
  v_daily_limit integer := 10;
  v_recent_limit integer := 3;
  recent_count integer;
  daily_count integer;
BEGIN
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.baskets b
  WHERE b.owner_profile_id = v_owner
    AND b.created_at >= timezone('utc', now()) - v_recent_window;

  IF recent_count >= v_recent_limit THEN
    RAISE EXCEPTION 'basket_create_rate_limit'
      USING MESSAGE = 'You are creating baskets too quickly. Try again later.';
  END IF;

  SELECT count(*) INTO daily_count
  FROM public.baskets b
  WHERE b.owner_profile_id = v_owner
    AND b.created_at >= date_trunc('day', timezone('utc', now()));

  IF daily_count >= v_daily_limit THEN
    RAISE EXCEPTION 'basket_create_daily_limit'
      USING MESSAGE = 'You have reached the daily basket creation limit.';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.gate_pro_feature(_user_id uuid)
 RETURNS TABLE(access boolean, used_credit boolean, credits_left integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_rec public.mobility_pro_access;
  v_access boolean := false;
  v_used boolean := false;
  v_left integer := 0;
BEGIN
  SELECT * INTO v_rec FROM public.mobility_pro_access WHERE user_id = _user_id;
  IF v_rec.user_id IS NULL THEN
    RETURN QUERY SELECT false, false, 0;
    RETURN;
  END IF;
  v_left := COALESCE(v_rec.credits_left, 0);
  IF v_rec.granted_until IS NOT NULL AND v_rec.granted_until >= timezone('utc', now()) THEN
    v_access := true;
  ELSIF v_left > 0 THEN
    v_access := true;
  END IF;
  RETURN QUERY SELECT v_access, v_used, v_left;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_order_code()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_seq bigint;
BEGIN
  SELECT nextval('public.order_code_seq') INTO v_seq;
  RETURN upper(lpad(to_hex(v_seq), 6, '0'));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT 2 * 6371 * asin(
    sqrt(
      pow(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * pow(sin(radians(lng2 - lng1) / 2), 2)
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.insurance_queue_media(_profile_id uuid, _wa_id text, _storage_path text, _mime_type text, _caption text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.insurance_media_queue (profile_id, wa_id, storage_path, mime_type, caption)
  VALUES (_profile_id, _wa_id, _storage_path, _mime_type, _caption);
END;
$function$
;

create or replace view "public"."leaderboard_snapshots_v" as  SELECT id,
    snapshot_window AS "window",
    generated_at,
    top9,
    your_rank_map
   FROM leaderboard_snapshots;


CREATE OR REPLACE FUNCTION public.match_drivers_for_trip_v2(_trip_id uuid, _limit integer DEFAULT 9, _prefer_dropoff boolean DEFAULT false, _radius_m integer DEFAULT NULL::integer, _window_days integer DEFAULT 30)
 RETURNS TABLE(trip_id uuid, creator_user_id uuid, whatsapp_e164 text, ref_code text, distance_km numeric, drop_bonus_m numeric, pickup_text text, dropoff_text text, matched_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  base_trip RECORD;
  target_role text;
  window_start timestamptz;
  effective_radius integer;
BEGIN
  SELECT id, role, vehicle_type, pickup, dropoff, pickup_radius_m, dropoff_radius_m, created_at
  INTO base_trip
  FROM public.trips
  WHERE id = _trip_id;

  IF NOT FOUND OR base_trip.pickup IS NULL THEN
    RETURN;
  END IF;

  target_role := CASE WHEN base_trip.role = 'driver' THEN 'passenger' ELSE 'driver' END;
  window_start := timezone('utc', now()) - (_window_days || ' days')::interval;
  effective_radius := COALESCE(_radius_m, base_trip.pickup_radius_m, 20000);

  RETURN QUERY
  SELECT
    t.id,
    t.creator_user_id,
    p.whatsapp_e164,
    public.profile_ref_code(t.creator_user_id) AS ref_code,
    (ST_Distance(t.pickup, base_trip.pickup) / 1000.0)::numeric(10, 3) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND base_trip.dropoff IS NOT NULL AND t.dropoff IS NOT NULL
        THEN ST_Distance(t.dropoff, base_trip.dropoff)
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.created_at AS matched_at
  FROM public.trips t
  JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.status = 'open'
    AND t.id <> base_trip.id
    AND t.pickup IS NOT NULL
    AND t.role = target_role
    AND t.vehicle_type = base_trip.vehicle_type
    AND t.created_at >= window_start
    AND ST_DWithin(t.pickup, base_trip.pickup, effective_radius)
  ORDER BY
    ST_Distance(t.pickup, base_trip.pickup),
    CASE
      WHEN _prefer_dropoff AND base_trip.dropoff IS NOT NULL AND t.dropoff IS NOT NULL
        THEN ST_Distance(t.dropoff, base_trip.dropoff)
      ELSE NULL
    END,
    t.created_at DESC,
    t.id
  LIMIT _limit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.match_passengers_for_trip_v2(_trip_id uuid, _limit integer DEFAULT 9, _prefer_dropoff boolean DEFAULT false, _radius_m integer DEFAULT NULL::integer, _window_days integer DEFAULT 30)
 RETURNS TABLE(trip_id uuid, creator_user_id uuid, whatsapp_e164 text, ref_code text, distance_km numeric, drop_bonus_m numeric, pickup_text text, dropoff_text text, matched_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  base_trip RECORD;
  target_role text;
  window_start timestamptz;
  effective_radius integer;
BEGIN
  SELECT id, role, vehicle_type, pickup, dropoff, pickup_radius_m, dropoff_radius_m, created_at
  INTO base_trip
  FROM public.trips
  WHERE id = _trip_id;

  IF NOT FOUND OR base_trip.pickup IS NULL THEN
    RETURN;
  END IF;

  target_role := CASE WHEN base_trip.role = 'driver' THEN 'passenger' ELSE 'driver' END;
  window_start := timezone('utc', now()) - (_window_days || ' days')::interval;
  effective_radius := COALESCE(_radius_m, base_trip.pickup_radius_m, 20000);

  RETURN QUERY
  SELECT
    t.id,
    t.creator_user_id,
    p.whatsapp_e164,
    public.profile_ref_code(t.creator_user_id) AS ref_code,
    (ST_Distance(t.pickup, base_trip.pickup) / 1000.0)::numeric(10, 3) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND base_trip.dropoff IS NOT NULL AND t.dropoff IS NOT NULL
        THEN ST_Distance(t.dropoff, base_trip.dropoff)
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.created_at AS matched_at
  FROM public.trips t
  JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.status = 'open'
    AND t.id <> base_trip.id
    AND t.pickup IS NOT NULL
    AND t.role = target_role
    AND t.vehicle_type = base_trip.vehicle_type
    AND t.created_at >= window_start
    AND ST_DWithin(t.pickup, base_trip.pickup, effective_radius)
  ORDER BY
    ST_Distance(t.pickup, base_trip.pickup),
    CASE
      WHEN _prefer_dropoff AND base_trip.dropoff IS NOT NULL AND t.dropoff IS NOT NULL
        THEN ST_Distance(t.dropoff, base_trip.dropoff)
      ELSE NULL
    END,
    t.created_at DESC,
    t.id
  LIMIT _limit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.on_menu_publish_refresh()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM public.refresh_menu_items_snapshot();
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.orders_set_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.order_code IS NULL OR NEW.order_code = '' THEN
    NEW.order_code := public.generate_order_code();
  END IF;
  IF NEW.created_at IS NULL THEN
    NEW.created_at := timezone('utc', now());
  END IF;
  IF NEW.updated_at IS NULL THEN
    NEW.updated_at := timezone('utc', now());
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.profile_ref_code(_profile_id uuid)
 RETURNS text
 LANGUAGE sql
AS $function$
  SELECT COALESCE(metadata->>'ref_code',
                  upper(substring(md5(COALESCE(whatsapp_e164, '')) FROM 1 FOR 6)))
  FROM public.profiles
  WHERE user_id = _profile_id;
$function$
;

CREATE OR REPLACE FUNCTION public.profile_wa(_profile_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT whatsapp_e164 FROM public.profiles WHERE user_id = _profile_id;
$function$
;

CREATE OR REPLACE FUNCTION public.recent_drivers_near(in_lat double precision, in_lng double precision, in_vehicle_type text, in_radius_km double precision, in_max integer)
 RETURNS TABLE(ref_code text, whatsapp_e164 text, last_seen timestamp with time zone)
 LANGUAGE sql
AS $function$
  SELECT
    public.profile_ref_code(ds.user_id) AS ref_code,
    p.whatsapp_e164,
    ds.last_seen
  FROM public.driver_status ds
  JOIN public.profiles p ON p.user_id = ds.user_id
  WHERE ds.online = true
    AND p.whatsapp_e164 IS NOT NULL
    AND (in_vehicle_type IS NULL OR ds.vehicle_type = in_vehicle_type)
    AND ds.lat IS NOT NULL AND ds.lng IS NOT NULL
    AND (
      in_radius_km IS NULL
      OR public.haversine_km(ds.lat, ds.lng, in_lat, in_lng) <= in_radius_km
    )
  ORDER BY ds.last_seen DESC
  LIMIT COALESCE(in_max, 9);
$function$
;

CREATE OR REPLACE FUNCTION public.recent_drivers_near(in_lat double precision, in_lng double precision, in_vehicle_type text, in_radius_km numeric, in_max integer)
 RETURNS TABLE(ref_code character, whatsapp_e164 text, last_seen timestamp with time zone, user_id uuid)
 LANGUAGE sql
 STABLE
AS $function$
  select p.ref_code, p.whatsapp_e164, d.last_seen, d.user_id
  from driver_status d
  join profiles p on p.user_id = d.user_id
  where d.online = true
    and (in_vehicle_type is null or d.vehicle_type = in_vehicle_type)
    and d.location is not null
    and st_dwithin(d.location::geography,
                   st_setsrid(st_makepoint(in_lng, in_lat),4326),
                   in_radius_km * 1000)
  order by d.last_seen desc
  limit greatest(in_max,1);
$function$
;

CREATE OR REPLACE FUNCTION public.recent_passenger_trips_near(in_lat double precision, in_lng double precision, in_vehicle_type text, in_radius_km double precision, in_max integer)
 RETURNS TABLE(trip_id uuid, ref_code text, whatsapp_e164 text, created_at timestamp with time zone)
 LANGUAGE sql
AS $function$
  SELECT
    t.id,
    public.profile_ref_code(t.creator_user_id) AS ref_code,
    p.whatsapp_e164,
    t.created_at
  FROM public.trips t
  JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    AND p.whatsapp_e164 IS NOT NULL
    AND (in_vehicle_type IS NULL OR t.vehicle_type = in_vehicle_type)
    AND t.pickup_lat IS NOT NULL AND t.pickup_lng IS NOT NULL
    AND (
      in_radius_km IS NULL
      OR public.haversine_km(t.pickup_lat, t.pickup_lng, in_lat, in_lng) <= in_radius_km
    )
  ORDER BY t.created_at DESC
  LIMIT COALESCE(in_max, 9);
$function$
;

CREATE OR REPLACE FUNCTION public.recent_passenger_trips_near(in_lat double precision, in_lng double precision, in_vehicle_type text, in_radius_km numeric, in_max integer)
 RETURNS TABLE(trip_id bigint, creator_user_id uuid, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
  select t.id, t.creator_user_id, t.created_at
  from trips t
  where t.role='passenger' and t.status='open'
    and (in_vehicle_type is null or t.vehicle_type=in_vehicle_type)
    and st_dwithin(t.pickup::geography,
                   st_setsrid(st_makepoint(in_lng, in_lat),4326),
                   in_radius_km * 1000)
  order by t.created_at desc
  limit greatest(in_max,1);
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_menu_items_snapshot()
 RETURNS void
 LANGUAGE sql
AS $function$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.menu_items_snapshot;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.wallet_apply_delta(_user_id uuid, _delta integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.wallets (user_id, balance_tokens)
  VALUES (_user_id, COALESCE(_delta, 0))
  ON CONFLICT (user_id)
  DO UPDATE SET balance_tokens = public.wallets.balance_tokens + COALESCE(_delta, 0), updated_at = timezone('utc', now());
END;
$function$
;

CREATE OR REPLACE FUNCTION public.wallet_earn_actions(_profile_id uuid, _limit integer DEFAULT 10)
 RETURNS SETOF wallet_earn_actions
 LANGUAGE sql
AS $function$
  SELECT * FROM public.wallet_earn_actions
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT COALESCE(_limit, 10);
$function$
;

CREATE OR REPLACE FUNCTION public.wallet_redeem_options(_profile_id uuid)
 RETURNS SETOF wallet_redeem_options
 LANGUAGE sql
AS $function$
  SELECT * FROM public.wallet_redeem_options WHERE is_active = true ORDER BY created_at DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.wallet_summary(_profile_id uuid)
 RETURNS TABLE(balance_minor integer, pending_minor integer, currency text, tokens integer)
 LANGUAGE sql
AS $function$
  SELECT balance_minor, pending_minor, currency, tokens
  FROM public.wallet_accounts
  WHERE profile_id = _profile_id;
$function$
;

CREATE OR REPLACE FUNCTION public.wallet_top_promoters(_limit integer DEFAULT 9)
 RETURNS SETOF wallet_promoters
 LANGUAGE sql
AS $function$
  SELECT * FROM public.wallet_promoters ORDER BY tokens DESC, updated_at DESC LIMIT COALESCE(_limit, 9);
$function$
;

CREATE OR REPLACE FUNCTION public.wallet_transactions_recent(_profile_id uuid, _limit integer DEFAULT 5)
 RETURNS SETOF wallet_transactions
 LANGUAGE sql
AS $function$
  SELECT * FROM public.wallet_transactions
  WHERE profile_id = _profile_id
  ORDER BY occurred_at DESC
  LIMIT COALESCE(_limit, 5);
$function$
;

create policy "deny_all_app_config"
on "public"."app_config"
as permissive
for all
to public
using (false);


create policy "deny_all_biz"
on "public"."businesses"
as permissive
for all
to public
using (false);


create policy "deny_all_cs"
on "public"."chat_sessions"
as permissive
for all
to public
using (false);


create policy "deny_all_chat_state"
on "public"."chat_state"
as permissive
for all
to public
using (false);


create policy "deny_all_driver_status"
on "public"."driver_status"
as permissive
for all
to public
using (false);


create policy "deny_all_il"
on "public"."insurance_leads"
as permissive
for all
to public
using (false);


create policy "deny_all_im"
on "public"."insurance_media"
as permissive
for all
to public
using (false);


create policy "deny_all_marketplace_categories"
on "public"."marketplace_categories"
as permissive
for all
to public
using (false);


create policy "mc_public_read_active"
on "public"."marketplace_categories"
as permissive
for select
to authenticated, anon
using ((COALESCE(is_active, true) = true));


create policy "deny_all_profiles"
on "public"."profiles"
as permissive
for all
to public
using (false);


create policy "deny_all_shops"
on "public"."shops"
as permissive
for all
to public
using (false);


create policy "deny_all_trips"
on "public"."trips"
as permissive
for all
to public
using (false);


create policy "deny_all_wa_events"
on "public"."wa_events"
as permissive
for all
to public
using (false);


create policy "deny_all_wa_in"
on "public"."wa_inbound"
as permissive
for all
to public
using (false);


create policy "orders_customer_select"
on "public"."orders"
as permissive
for select
to public
using (((auth_role() = ANY (ARRAY['customer'::text, 'platform'::text])) AND ((auth_role() = 'platform'::text) OR (auth_profile_id() = profile_id))));


create policy "sessions_role_rw"
on "public"."sessions"
as permissive
for all
to public
using (((auth_role() = 'platform'::text) OR ((auth_role() = 'customer'::text) AND (auth_profile_id() = profile_id))))
with check (((auth_role() = 'platform'::text) OR ((auth_role() = 'customer'::text) AND (auth_profile_id() = profile_id))));


CREATE TRIGGER trg_basket_invites_sync AFTER INSERT OR UPDATE ON public.basket_invites FOR EACH ROW EXECUTE FUNCTION fn_sync_basket_invites_to_baskets();

CREATE TRIGGER trg_basket_members_sync AFTER INSERT OR DELETE OR UPDATE ON public.basket_members FOR EACH ROW EXECUTE FUNCTION fn_sync_basket_members_to_ibimina();

CREATE TRIGGER trg_baskets_sync AFTER INSERT OR DELETE OR UPDATE ON public.baskets FOR EACH ROW EXECUTE FUNCTION fn_sync_baskets_to_ibimina();

CREATE TRIGGER trg_baskets_updated BEFORE UPDATE ON public.baskets FOR EACH ROW EXECUTE FUNCTION set_updated_at();


create schema if not exists "tiger";

create extension if not exists "postgis_tiger_geocoder" with schema "tiger" version '3.3.7';

create type "tiger"."norm_addy" as ("address" integer, "predirabbrev" character varying, "streetname" character varying, "streettypeabbrev" character varying, "postdirabbrev" character varying, "internal" character varying, "location" character varying, "stateabbrev" character varying, "zip" character varying, "parsed" boolean, "zip4" character varying, "address_alphanumeric" character varying);


create schema if not exists "tiger_data";


create schema if not exists "topology";

create extension if not exists "postgis_topology" with schema "topology" version '3.3.7';

create type "topology"."getfaceedges_returntype" as ("sequence" integer, "edge" integer);

create type "topology"."topogeometry" as ("topology_id" integer, "layer_id" integer, "id" integer, "type" integer);

create type "topology"."validatetopology_returntype" as ("error" character varying, "id1" integer, "id2" integer);

CREATE TRIGGER layer_integrity_checks BEFORE DELETE OR UPDATE ON topology.layer FOR EACH ROW EXECUTE FUNCTION layertrigger();

COMMIT;

