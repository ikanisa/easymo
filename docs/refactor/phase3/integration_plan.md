# Phase 3 Integration Test Plan (Draft)

## Edge Coverage Snapshot
| Domain | Primary flows | Test artifact | Status |
|--------|---------------|---------------|--------|
| Dine-in | Menu browse, order, payment | `tests/edge/wa_webhook_router.test.ts` (router smoke paths) | Ready; extend with dine-in domain assertions |
| Notifications | Queue + delivery | `supabase/functions/wa-webhook/notify/sender.test.ts` | Ready |
| Mobility | Trip matching, nearby | `tests/sql/matching_v2.sql` | Ready |
| Marketplace/Vendor | Vendor onboarding, menu review | Add Deno smoke once vendor domain stabilises | Pending |
| Wallet | Wallet flows (earn, redeem, transactions) | Scheduled SQL + Deno hybrid tests | Pending |

## Planned Integration Scripts
- `tests/sql/matching_v2.sql`: validates `match_*_v2` RPCs post Phase 2.
- `tests/sql/claim_notifications.sql`: validates `security.claim_notifications` behaviour.
- `tests/sql/promote_draft_menu.sql`: validates `menu_admin.promote_draft_menu`.
- Future domain smoke tests should follow the Deno pattern under `tests/edge/<domain>.test.ts` with lightweight Supabase stubs.

## Next Steps
1. Add domain-specific Deno tests for marketplace and wallet flows once modules migrate.
2. Expand SQL/pgTAP coverage for vouchers and OCR once Phase 4 automation lands.
3. Wire Deno + SQL scripts into CI after lint/pre-commit hooks are in place (Phase 4).
