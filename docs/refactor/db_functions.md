# Database Function Inventory (Phase 2)

## Summary
- **PostGIS core**: hundreds of `_st_*`, `geometry_*`, `postgis_*` helpers — keep, managed by extension (includes `st_estimatedextent` SECURITY DEFINER variants).
- **Auth helpers**: `auth_role`, `auth_wa_id`, `auth_customer_id`, `auth_bar_id`, `checkauth*`, `addauth` — confirm usage; none require `SECURITY DEFINER` today.
- **Basket domain**: `basket_*` functions now lean on canonical membership tables; rate limiting logic consolidated in `basket_join_by_code` (Phase 1).
- **Mobility domain**: `match_*_v2` are the active RPCs consumed by edge functions. Legacy `match_*` (v1) and `nearby_*` helpers removed in `20251011113000`.
- **Wallet domain**: `wallet_apply_delta`, `wallet_summary`, `wallet_transactions_recent` — ensure tests; confirm the overloaded `wallet_apply_delta` behaviours.
- **Notification pipeline**: `security.claim_notifications` remains SECURITY DEFINER (moved out of `public` via `20251011121000_phase2_claim_notifications_security.sql`); only `service_role` retains execute rights.
- **Incremental utilities**: `insurance_queue_media`, `mark_driver_served`, `mark_passenger_served` — verify runtime usage. (`increment_profile_credits` dropped in `20251011124000_phase2_menu_admin_promote.sql`.)
- **Security definers (non-extension)**: `security.claim_notifications`, `menu_admin.promote_draft_menu`. Matching RPCs now run as invokers (`20251011113000`).

## Phase 2 Priorities
1. **Schema hardening**: monitor `security.claim_notifications`; move `menu_admin.promote_draft_menu` callers to schema-qualified usage (done) and document privileges.
2. **Cleanup stragglers**: confirm remaining incremental utilities are still required; plan invoker conversions if needed.
3. **Testing**: add pgTAP/SQL coverage for `security.claim_notifications`, `match_*_v2`, `basket_join_by_code`, and other business triggers.

## Action Items
- Add ownership comments to project-specific functions as they are touched (security, mobility, marketplace squads).
- Prepare follow-up migrations to rehome any additional privileged routines and to enforce grants via roles rather than direct user assignments.
- Update `docs/refactor/deprecations.md` after future drop migrations merge, noting target release + rollback steps.
