# Migration Progress Tracker - Nov 21, 2025

## Fixed So Far (11 commits)

| # | Commit | Migration | Issue Fixed |
|---|--------|-----------|-------------|
| 1 | b683684 | NEW | Dead Letter Queue implementation |
| 2 | 09fa8c9 | 20251119100000 | Invalid FK to orders table |
| 3 | 71b18d5 | Multiple | polname → policyname |
| 4 | 04032da | 20251119100000 | Function param order |
| 5 | 0f46fa7 | 20251119103000 | profile_id → owner_profile_id |
| 6 | 2fbee45 | 20251119103000 | RLS policy DO blocks |
| 7 | 39cf059 | 20251119123000 | Add market_code column check |
| 8 | 9f3e5e3 | 20251119123000 | Add all produce_catalog columns |
| 9 | d8a4ef2 | 20251119133542 | Create wallet_accounts table |
| 10 | 74da372 | 20251119140000 | profile_id → owner_profile_id |
| 11 | ff36ca3 | 20251119140000 | Add farms columns (phone, whatsapp, etc) |

## Successfully Applied Migrations (5/37)

✅ 20251119100000_supply_chain_verification.sql
✅ 20251119103000_farmer_pickups.sql  
✅ 20251119123000_farmer_market_foundation.sql
✅ 20251119133542_add_tokens_to_recipients.sql
✅ 20251119140000_farmer_agent_complete.sql *(in progress)*

## Remaining Migrations (32)

⏳ 20251119141500_token_partners_seed.sql
⏳ 20251119141839_add_farmer_agent_menu.sql
⏳ 20251120073400_add_easymo_petro_station.sql
⏳ 20251120080700_create_wa_events_table.sql
⏳ 20251120100000_general_broker_user_memory.sql
⏳ 20251120100001_general_broker_service_requests.sql
⏳ 20251120100002_general_broker_vendors.sql
⏳ 20251120100003_general_broker_catalog_faq.sql
⏳ 20251120100500_voice_infrastructure_complete.sql
⏳ 20251120120000_dual_llm_provider_infrastructure.sql ⭐ CRITICAL
⏳ 20251120120001_dual_llm_standalone.sql
⏳ 20251120140000_llm_tables_rls.sql
⏳ 20251120143000_agent_configurations_updated_by.sql
⏳ 20251120143500_wa_events_message_id_unique.sql
⏳ 20251120190000_fix_wa_events_schema_cache.sql
⏳ 20251120210000_fix_webhook_logs_schema.sql
⏳ 20251120211000_fix_produce_listings_columns.sql
⏳ 20251120220000_fix_wa_events_event_type_nullable.sql
⏳ 20251120220100_create_wa_interactions_table.sql
⏳ 20251121000000_create_enhanced_webhook_tables.sql
⏳ 20251121000000_fix_schema_permissions_and_constraints.sql
⏳ 20251121054000_complete_webhook_fix.sql
⏳ 20251121065000_populate_home_menu.sql
⏳ 20251121070000_fix_farms_table_schema.sql
⏳ 20251121074500_fix_farm_synonyms_columns.sql
⏳ 20251121080000_fix_jsonb_gist_indexes.sql
⏳ 20251121090000_enable_postgis.sql
⏳ 20251121092900_create_referral_tables.sql
⏳ 20251121104249_consolidate_rides_menu.sql ⭐ CRITICAL
⏳ 20251121121348_wa_dead_letter_queue.sql ⭐ CRITICAL (NEW)
⏳ 20251121153900_create_business_directory.sql
⏳ 20251121170000_restore_bars_and_bar_numbers_tables.sql

## Common Issues Pattern

### Schema Drift Issues:
- `profile_id` vs `owner_profile_id` (farms table)
- Missing columns in existing tables
- Different table schemas than expected

### Solutions Applied:
1. Conditional column additions via DO blocks
2. Column name standardization
3. Idempotent CREATE IF NOT EXISTS patterns

## Progress: 13.5% (5/37 migrations applied)

**Estimated Remaining Time:** 1.5-2 hours at current pace
