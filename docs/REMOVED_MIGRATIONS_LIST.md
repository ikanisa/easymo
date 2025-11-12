# Removed Migrations - Complete List

**Date:** 2025-11-12  
**Total Removed:** 124 migrations

---

## Summary

### Categories of Removed Migrations:

1. **Permanently Deleted** (11 migrations) - in `migrations-deleted/`
   - Deprecated features: baskets, saccos, campaigns, momo_sms_inbox
   
2. **Archived for Reference** (113 migrations) - in `migrations-broken/`
   - Moved due to dependency issues, but may contain useful code

---

## 1. PERMANENTLY DELETED (11 migrations)

### Location: `supabase/migrations-deleted/`

These were deleted entirely because they reference deprecated features:

#### Basket-related (3 files):
1. `20251010101000_phase1_archive_legacy_tables.sql`
2. `20251011130000_phase5_drop_archive_tables.sql`
3. `20260304120000_remove_baskets_vouchers.sql`

#### SACCO-related (3 files):
4. `20251031134020_contribution_cycle_helper.sql`
5. `20251031135000_sacco_loan_endorsements.sql`
6. `20251031135010_sacco_loan_endorsements_rls.sql`

#### Campaign-related (3 files):
7. `20251030100000_campaigns_uuid_rework.sql`
8. `20251130090000_remove_orders_templates_campaigns.sql`
9. `20251205100000_admin_marketing_fixture_support.sql`

#### Other deprecated (2 files):
10. `20251031134015_momo_inbox_tracking.sql` - MoMo SMS inbox feature
11. `20250215093000_add_business_tags.sql` - Early reference to non-existent businesses table

---

## 2. ARCHIVED MIGRATIONS (113 migrations)

### Location: `supabase/migrations-broken/`

These are shown as "deleted" in git status but are preserved in migrations-broken/:

### Phase 1: Early 2025 (7 migrations)
1. `20250201120000_data_retention_archives.sql` *(actually applied)*
2. `20250907104112_bb1041f4-1b8a-4bce-b154-b8a3e8eb8462.sql` *(actually applied)*

### Phase 2: October 2025 - Core Schema (30 migrations)
3. `20251001140000_rls_policies.sql` - ❌ RLS auth.role() syntax error
4. `20251003160000_phase_a_legacy.sql` - ⚠️  Contains baskets (we use cleaned version)
5. `20251004100000_insurance_pipeline.sql`
6. `20251004170000_runtime_support.sql`
7. `20251005130000_master_schema_additions.sql`
8. `20251005132000_matching_v2.sql`
9. `20251005133500_matching_v2_columns.sql`
10. `20251005134000_admin_sessions.sql`
11. `20251005135000_wallet_delta_fn.sql`
12. `20251005140000_notifications_retry.sql`
13. `20251006153000_schema_alignment_v2.sql`
14. `20251006162000_matching_v2_geography.sql`
15. `20251006170000_fuel_vouchers.sql`
16. `20251007180000_menu_versioning.sql`
17. `20251007183000_staff_verification.sql`
18. `20251009090000_concurrency_safety.sql`
19. `20251009093000_mobility_created_at_fix.sql`
20. `20251009093500_storage_buckets.sql`
21. `20251009100000_customers_to_profiles_step1.sql`
22. `20251009101000_customers_to_profiles_step2.sql`
23. `20251009102000_customers_to_profiles_step3.sql`
24. `20251010100000_phase1_contacts_profile_fk.sql`
25. `20251010103000_matching_v2_numeric_casts.sql`
26. `20251011110000_phase2_function_hygiene.sql`
27. `20251011113000_phase2_match_invoker.sql`
28. `20251011121000_phase2_claim_notifications_security.sql`
29. `20251011124000_phase2_menu_admin_promote.sql`
30. `20251012140000_contact_profile_sync.sql`
31. `20251012150000_contact_profile_sync_guard.sql`
32. `20251014120000_remote_sync_placeholder.sql`

### Phase 3: Mid-October 2025 (20 migrations)
33. `20251014121000_remote_sync_placeholder.sql`
34. `20251014123000_remote_sync_placeholder.sql`
35. `20251016120000_user_favorites_and_driver_parking.sql`
36. `20251016121000_views_for_broker.sql`
37. `20251016122000_feature_flags_favorites.sql`
38. `20251017131500_add_profiles_locale.sql`
39. `20251017150000_phase2_init.sql`
40. `20251017220823_skip_remote_schema.sql`
41. `20251017220824_remote_schema.sql` - ❌ DROP statements on non-existent tables
42. `20251018143000_storage_bucket_setup.sql` - ❌ Storage API syntax error
43. `20251020090000_voice_realtime.sql`
44. `20251020123000_wa_edge_role_grants.sql`
45. `20251020200000_wallet_rework.sql`
46. `20251020223000_vendor_wallet_extensions.sql`
47. `20251020224500_wallet_ledger_uuid_fix.sql`
48. `20251020230000_driver_subscription.sql`
49. `20251020231000_driver_subscription_patch.sql`
50. `20251020232000_driver_subscription_patch2.sql`
51. `20251020233000_driver_subscription_patch3.sql`
52. `20251021033131_brokerai_insurance_and_mobility.sql` - ❌ Missing loc column

### Phase 4: Late October 2025 (30 migrations)
53. `20251021133942_agent_management.sql`
54. `20251023120000_add_agent_profile_columns.sql`
55. `20251023121000_add_wa_messages.sql`
56. `20251023160010_agent_management.sql` - ❌ Missing agent_id column
57. `20251025160000_profiles_notifications_updated_at.sql`
58. `20251025170000_marketplace_categories.sql`
59. `20251025170500_marketplace_categories_slug_cleanup.sql`
60. `20251025172000_marketplace_nearby_v2.sql`
61. `20251025173000_referral_apply.sql`
62. `20251025174000_insurance_ocr_support.sql`
63. `20251025210000_mobility_numeric_casts.sql`
64. `20251026110000_business_categories.sql` - ❌ Duplicate trigger
65. `20251026110500_business_hours.sql`
66. `20251027073908_order_items_id_uuid.sql`
67. `20251027120000_admin_core_schema.sql`
68. `20251028163000_item_modifier_index.sql`
69. `20251030100000_campaigns_uuid_rework.sql` *(deleted - campaigns)*
70. `20251030130916_whatsapp_notifications_enhancement.sql`
71. `20251030131000_notification_helper_functions.sql`
72. `20251030140000_enable_rls_lockdown.sql`
73. `20251031133000_storage_kyc_bucket.sql`
74. `20251031136000_whatsapp_loans_intents.sql`
75. `20251031151500_insurance_media_queue_enhancements.sql`
76. `20251031152000_admin_alert_prefs_rls.sql`
77. `20251031152500_wallet_rls_policies.sql`
78. `20251031203000_remote_sync_placeholder.sql`
79. `20251101120000_loans_reminders_extension.sql` - ⚠️  Contains sacco/basket refs
80. `20251101121000_motor_insurance_feature_gate.sql`
81. `20251105131954_agent_orchestration_foundation.sql`
82. `20251108000000_ai_agents_system.sql`

### Phase 5: November 2025 (20 migrations)
83. `20251111090000_mobility_radius_dropoff_guard.sql`
84. `20251111090100_fix_insurance_schema.sql`
85. `20251112090000_phase2_mobility_core.sql`
86. `20251112091000_phase2_mobility_rls.sql`
87. `20251112100000_phase2_init.sql`
88. `20251113120000_deeplink_tokens.sql`
89. `20251118120000_admin_panel_rls_support.sql`
90. `20251120090000_lock_down_public_reads.sql`
91. `20251120090500_client_settings_filter.sql`
92. `20251120090501_create_admin_audit_logs.sql`
93. `20251202000000_align_profiles_columns.sql`
94. `20251206090000_driver_vehicle_defaults.sql`
95. `20251206103000_agent_chat_tables.sql`
96. `20251207090000_brokerai_insurance_mobility.sql`
97. `20251207094500_agent_management.sql`
98. `20251207100500_agent_docs_bucket.sql`
99. `20251207112000_agent_document_embeddings.sql`
100. `20251207130000_agent_toolkits.sql`
101. `20251215094500_conversations_metadata.sql`
102. `20251215121000_agent_security_hardening.sql`
103. `20251220103000_policy_reliability.sql`

### Phase 6: January-March 2026 (21 migrations)
104. `20260115103000_admin_station_rls_alignment.sql`
105. `20260127160000_dual_constraint_matching.sql`
106. `20260127160500_router_keyword_map.sql`
107. `20260127161000_router_logs.sql`
108. `20260129200000_voice_agent_tables.sql`
109. `20260130120500_openai_agents_integration.sql`
110. `20260131120000_router_infrastructure.sql`
111. `20260201090000_router_fn_foundation.sql`
112. `20260214090000_mobility_domain.sql`
113. `20260214090500_mobility_rls.sql`
114. `20260214100000_agent_orchestration_system.sql`
115. `20260215100000_property_rental_agent.sql`
116. `20260215110000_schedule_trip_agent.sql`
117. `20260215120000_shops_quincaillerie_agents.sql`
118. `20260220120000_enable_postgis.sql` *(duplicate - PostGIS already enabled)*
119. `20260312090000_video_performance_analytics.sql`
120. `20260318100000_video_agent_content_system.sql`
121. `20260320121500_agent_admin_views.sql`
122. `20260321090000_performance_indexes.sql`
123. `20260322100000_whatsapp_home_menu_config.sql`
124. `20260322110000_bars_restaurants_menu_system.sql`
125. `20260323100000_agent_registry_extended_config.sql`
126. `20260323100100_agent_registry_seed_configs.sql`

---

## 3. CURRENTLY APPLIED (11 migrations)

### Location: `supabase/migrations/` - These are active and working

1. ✅ `20240101000000_enable_postgis.sql`
2. ✅ `20240102000000_create_shops_table.sql`
3. ✅ `20240103000000_bootstrap_settings_table.sql`
4. ✅ `20240105000000_stub_business_categories.sql`
5. ✅ `20250111000001_create_agent_tables.sql`
6. ✅ `20250201120000_data_retention_archives.sql`
7. ✅ `20250907104112_bb1041f4-1b8a-4bce-b154-b8a3e8eb8462.sql`
8. ✅ `20251002120000_core_schema.sql`
9. ✅ `20251002123000_rls_core_policies.sql`
10. ✅ `20251002124500_core_helpers.sql`
11. ✅ `20251003160000_phase_a_legacy_cleaned.sql` *(custom - baskets removed)*

---

## 4. NEW MIGRATIONS FROM REMOTE (9 migrations)

### Just pulled from git - not yet applied

1. 🆕 `20260324100000_business_multiple_whatsapp_numbers.sql`
2. 🆕 `20260324110000_vehicle_insurance_certificates.sql`
3. 🆕 `20260324120000_business_vector_embeddings.sql`
4. 🆕 `20260401100000_system_observability.sql`
5. 🆕 `20260401110000_whatsapp_sessions.sql`
6. 🆕 `20260401120000_transactions_payments.sql`
7. 🆕 `20260401130000_service_registry_feature_flags.sql`
8. 🆕 `20260401140000_event_store_message_queue.sql`
9. 🆕 `20260401150000_location_cache_optimization.sql`

---

## Migration Issues Identified

### ❌ Migrations with Known Errors:

1. **20251001140000_rls_policies.sql**
   - Issue: `auth.role()` syntax error in dynamic SQL
   - Impact: RLS policies fail to create

2. **20251017220824_remote_schema.sql**
   - Issue: DROP statements on non-existent tables (baskets_reminders, campaigns, saccos)
   - Impact: Migration fails immediately

3. **20251018143000_storage_bucket_setup.sql**
   - Issue: `storage.create_bucket()` incorrect syntax (`public => false`)
   - Impact: Storage bucket creation fails

4. **20251021033131_brokerai_insurance_and_mobility.sql**
   - Issue: Index on non-existent `loc` column
   - Impact: Index creation fails

5. **20251023160010_agent_management.sql**
   - Issue: Reference to `agent_id` column that doesn't exist
   - Impact: Foreign key constraint fails

6. **20251026110000_business_categories.sql**
   - Issue: Duplicate trigger creation
   - Impact: Trigger already exists error

---

## Statistics

- **Total original migrations:** 144
- **Permanently deleted:** 11
- **Archived (migrations-broken):** 113
- **Currently applied:** 11
- **Success rate:** 11/144 (7.6%)
- **Newly pulled from remote:** 9

---

## Notes

1. **Phase A Legacy**: We created a cleaned version (`phase_a_legacy_cleaned.sql`) with 269 lines of basket code removed
2. **Baskets domain**: Completely removed (group savings/crowdfunding feature)
3. **SACCOs domain**: Completely removed (savings & credit cooperatives)
4. **Campaigns domain**: Completely removed (marketing campaigns)
5. **Remote sync**: 138 migrations successfully applied on remote database

---

## Recommendations

### To restore specific migrations:

```bash
# Copy from migrations-broken back to migrations
cp supabase/migrations-broken/MIGRATION_NAME.sql supabase/migrations/

# Apply manually
PGPASSWORD=postgres psql -h 127.0.0.1 -p 57322 -U postgres -d postgres \
  -f supabase/migrations/MIGRATION_NAME.sql
```

### To apply new remote migrations:

```bash
# Apply the 9 new migrations from April 2026
for file in supabase/migrations/202604*.sql; do
  PGPASSWORD=postgres psql -h 127.0.0.1 -p 57322 -U postgres -d postgres -f "$file"
done
```

---

**End of Report**

