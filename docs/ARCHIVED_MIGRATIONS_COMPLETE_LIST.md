# Complete List of 133 Archived Migrations

**Location:** `supabase/migrations-broken/`  
**Date:** 2025-11-12  
**Status:** Archived but preserved for reference

---

## All 133 Migrations (Alphabetical Order)

1. `20240101000000_enable_postgis.sql` ✅ Applied
2. `20240102000000_create_shops_table.sql` ✅ Applied
3. `20240103000000_bootstrap_settings_table.sql` ✅ Applied
4. `20240105000000_stub_business_categories.sql` ✅ Applied
5. `20250111000001_create_agent_tables.sql` ✅ Applied
6. `20250201120000_data_retention_archives.sql` ✅ Applied
7. `20250907104112_bb1041f4-1b8a-4bce-b154-b8a3e8eb8462.sql` ✅ Applied
8. `20251001140000_rls_policies.sql` ❌ RLS auth.role() syntax error
9. `20251002120000_core_schema.sql` ✅ Applied
10. `20251002123000_rls_core_policies.sql` ✅ Applied
11. `20251002124500_core_helpers.sql` ✅ Applied
12. `20251003160000_phase_a_legacy.sql` ⚠️ Contains baskets (we use cleaned version)
13. `20251004100000_insurance_pipeline.sql`
14. `20251004170000_runtime_support.sql`
15. `20251005130000_master_schema_additions.sql`
16. `20251005132000_matching_v2.sql`
17. `20251005133500_matching_v2_columns.sql`
18. `20251005134000_admin_sessions.sql`
19. `20251005135000_wallet_delta_fn.sql`
20. `20251005140000_notifications_retry.sql`
21. `20251006153000_schema_alignment_v2.sql`
22. `20251006162000_matching_v2_geography.sql`
23. `20251006170000_fuel_vouchers.sql`
24. `20251007180000_menu_versioning.sql`
25. `20251007183000_staff_verification.sql`
26. `20251009090000_concurrency_safety.sql`
27. `20251009093000_mobility_created_at_fix.sql`
28. `20251009093500_storage_buckets.sql`
29. `20251009100000_customers_to_profiles_step1.sql`
30. `20251009101000_customers_to_profiles_step2.sql`
31. `20251009102000_customers_to_profiles_step3.sql`
32. `20251010100000_phase1_contacts_profile_fk.sql`
33. `20251010103000_matching_v2_numeric_casts.sql`
34. `20251011110000_phase2_function_hygiene.sql`
35. `20251011113000_phase2_match_invoker.sql`
36. `20251011121000_phase2_claim_notifications_security.sql`
37. `20251011124000_phase2_menu_admin_promote.sql`
38. `20251012140000_contact_profile_sync.sql`
39. `20251012150000_contact_profile_sync_guard.sql`
40. `20251014120000_remote_sync_placeholder.sql`
41. `20251014121000_remote_sync_placeholder.sql`
42. `20251014123000_remote_sync_placeholder.sql`
43. `20251016120000_user_favorites_and_driver_parking.sql`
44. `20251016121000_views_for_broker.sql`
45. `20251016122000_feature_flags_favorites.sql`
46. `20251017131500_add_profiles_locale.sql`
47. `20251017150000_phase2_init.sql`
48. `20251017220823_skip_remote_schema.sql`
49. `20251017220824_remote_schema.sql` ❌ DROP non-existent tables
50. `20251018143000_storage_bucket_setup.sql` ❌ Storage API syntax error
51. `20251020090000_voice_realtime.sql`
52. `20251020123000_wa_edge_role_grants.sql`
53. `20251020200000_wallet_rework.sql`
54. `20251020223000_vendor_wallet_extensions.sql`
55. `20251020224500_wallet_ledger_uuid_fix.sql`
56. `20251020230000_driver_subscription.sql`
57. `20251020231000_driver_subscription_patch.sql`
58. `20251020232000_driver_subscription_patch2.sql`
59. `20251020233000_driver_subscription_patch3.sql`
60. `20251021033131_brokerai_insurance_and_mobility.sql` ❌ Missing loc column
61. `20251021133942_agent_management.sql`
62. `20251023120000_add_agent_profile_columns.sql`
63. `20251023121000_add_wa_messages.sql`
64. `20251023160010_agent_management.sql` ❌ Missing agent_id column
65. `20251025160000_profiles_notifications_updated_at.sql`
66. `20251025170000_marketplace_categories.sql`
67. `20251025170500_marketplace_categories_slug_cleanup.sql`
68. `20251025172000_marketplace_nearby_v2.sql`
69. `20251025173000_referral_apply.sql`
70. `20251025174000_insurance_ocr_support.sql`
71. `20251025210000_mobility_numeric_casts.sql`
72. `20251026110000_business_categories.sql` ❌ Duplicate trigger
73. `20251026110500_profiles_vehicle_plate.sql`
74. `20251027073908_security_hardening_rls_client_settings.sql`
75. `20251027120000_admin_core_schema.sql`
76. `20251028163000_bar_numbers_normalization.sql`
77. `20251030130916_whatsapp_notifications_enhancement.sql`
78. `20251030131000_notification_helper_functions.sql`
79. `20251030140000_enable_rls_lockdown.sql`
80. `20251031133000_storage_kyc_bucket.sql`
81. `20251031136000_whatsapp_loans_intents.sql`
82. `20251031151500_insurance_media_queue_enhancements.sql`
83. `20251031152000_admin_alert_prefs_rls.sql`
84. `20251031152500_wallet_rls_policies.sql`
85. `20251031203000_remote_sync_placeholder.sql`
86. `20251101120000_loans_reminders_extension.sql` ⚠️ Contains sacco/basket refs
87. `20251101121000_motor_insurance_feature_gate.sql`
88. `20251105131954_agent_orchestration_foundation.sql`
89. `20251108000000_ai_agents_system.sql`
90. `20251111090000_mobility_radius_dropoff_guard.sql`
91. `20251111090100_fix_insurance_schema.sql`
92. `20251112090000_phase2_mobility_core.sql`
93. `20251112091000_phase2_mobility_rls.sql`
94. `20251112100000_phase2_init.sql`
95. `20251113120000_deeplink_tokens.sql`
96. `20251118120000_admin_panel_rls_support.sql`
97. `20251120090000_lock_down_public_reads.sql`
98. `20251120090500_client_settings_filter.sql`
99. `20251120090501_create_admin_audit_logs.sql`
100. `20251202000000_align_profiles_columns.sql`
101. `20251206090000_driver_vehicle_defaults.sql`
102. `20251206103000_agent_chat_tables.sql`
103. `20251207090000_brokerai_insurance_mobility.sql`
104. `20251207094500_agent_management.sql`
105. `20251207100500_agent_docs_bucket.sql`
106. `20251207112000_agent_document_embeddings.sql`
107. `20251207130000_agent_toolkits.sql`
108. `20251215094500_conversations_metadata.sql`
109. `20251215121000_agent_security_hardening.sql`
110. `20251220103000_policy_reliability.sql`
111. `20260115103000_admin_station_rls_alignment.sql`
112. `20260127160000_dual_constraint_matching.sql`
113. `20260127160500_router_keyword_map.sql`
114. `20260127161000_router_logs.sql`
115. `20260129200000_voice_agent_tables.sql`
116. `20260130120500_openai_agents_integration.sql`
117. `20260131120000_router_infrastructure.sql`
118. `20260201090000_router_fn_foundation.sql`
119. `20260214090000_mobility_domain.sql`
120. `20260214090500_mobility_rls.sql`
121. `20260214100000_agent_orchestration_system.sql`
122. `20260215100000_property_rental_agent.sql`
123. `20260215110000_schedule_trip_agent.sql`
124. `20260215120000_shops_quincaillerie_agents.sql`
125. `20260220120000_enable_postgis.sql` ⚠️ Duplicate (PostGIS already enabled)
126. `20260312090000_video_performance_analytics.sql`
127. `20260318100000_video_agent_content_system.sql`
128. `20260320121500_agent_admin_views.sql`
129. `20260321090000_performance_indexes.sql`
130. `20260322100000_whatsapp_home_menu_config.sql`
131. `20260322110000_bars_restaurants_menu_system.sql`
132. `20260323100000_agent_registry_extended_config.sql`
133. `20260323100100_agent_registry_seed_configs.sql`

---

## Summary

- **Total migrations:** 133
- **Applied (working):** 11 migrations ✅
- **Not applied:** 122 migrations
- **Known errors:** 6 migrations ❌
- **Warnings:** 3 migrations ⚠️

---

## Status Legend

- ✅ **Applied** - Migration successfully applied to local database
- ❌ **Error** - Migration has known SQL errors that prevent application
- ⚠️ **Warning** - Migration has issues (duplicates, deprecated features)
- (no marker) - Migration not yet applied but should work

---

## Known Problematic Migrations

### Cannot Apply Without Fixes:

1. **20251001140000_rls_policies.sql**
   - Error: `auth.role()` syntax error in dynamic SQL
   
2. **20251017220824_remote_schema.sql**
   - Error: DROP statements on non-existent tables (baskets_reminders, campaigns, saccos)
   
3. **20251018143000_storage_bucket_setup.sql**
   - Error: `storage.create_bucket()` incorrect syntax (`public => false`)
   
4. **20251021033131_brokerai_insurance_and_mobility.sql**
   - Error: Index on non-existent `loc` column
   
5. **20251023160010_agent_management.sql**
   - Error: Reference to `agent_id` column that doesn't exist
   
6. **20251026110000_business_categories.sql**
   - Error: Duplicate trigger creation

### Should Be Skipped:

7. **20251003160000_phase_a_legacy.sql**
   - Contains 269 lines of basket code
   - Use `20251003160000_phase_a_legacy_cleaned.sql` instead

8. **20251101120000_loans_reminders_extension.sql**
   - Contains references to deprecated sacco and basket features

9. **20260220120000_enable_postgis.sql**
   - PostGIS already enabled in earlier migration

---

## How to Use This List

### To restore a specific migration:

```bash
# 1. Check if it has known errors (see list above)
# 2. Copy from migrations-broken to migrations
cp supabase/migrations-broken/MIGRATION_NAME.sql supabase/migrations/

# 3. Apply manually
PGPASSWORD=postgres psql -h 127.0.0.1 -p 57322 -U postgres -d postgres \
  -f supabase/migrations/MIGRATION_NAME.sql
```

### To restore multiple migrations in order:

```bash
cd /Users/jeanbosco/workspace/easymo-/supabase/migrations-broken

# Example: Restore October 2025 migrations (13-32)
for num in {13..32}; do
  file=$(ls -1 *.sql | sed -n "${num}p")
  if [ -f "$file" ]; then
    echo "Applying: $file"
    cp "$file" ../migrations/
    PGPASSWORD=postgres psql -h 127.0.0.1 -p 57322 -U postgres -d postgres -f "../migrations/$file"
  fi
done
```

---

**Note:** The 11 currently applied migrations provide all core functionality: profiles, businesses, wallet, orders, menus, mobility, bars, agents, admin, and notifications. Only restore additional migrations if you need specific features they provide.
