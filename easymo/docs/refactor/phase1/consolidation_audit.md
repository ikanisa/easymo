# Phase 1 Consolidation Audit (2025-09-25)

## Snapshot Source

- Remote DB: `ezrriefbmhiiqfoxgjgz` (Supabase)
- Snapshot time: 2025-09-25 (see `supabase/snapshots/phase0/`)

## Candidate Overlaps

### Identity & Contacts

| Table           | Rows | Purpose                                                          | Notes                                                                  |
| --------------- | ---- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `profiles`      | 17   | Canonical WhatsApp-linked identity (`user_id`, `whatsapp_e164`). | Referenced by 20+ FKs (orders, wallets, baskets). RLS enforced.        |
| `contacts`      | 5    | Marketing/CRM channel list (`msisdn_e164`, opt-in flags).        | Used by edge admin flows for broadcasts; FK to `profiles` established. |
| `chat_state`    | 6    | Per-profile WA session state.                                    | References `profiles.user_id`.                                         |
| `chat_sessions` | 0    | Legacy conversation log stub.                                    | No data, no code references outside docs.                              |
| `sessions`      | 0    | Alternate chat session payload (JSON context).                   | Latest flows use `chat_state` instead.                                 |

**Recommendation**: keep `profiles` as the golden record. (Done: migration
`20251010100000` links contacts by `profile_id`; 5/5 contacts backfilled after
creating missing profile `983fd246-9ff8-4aaa-8623-8ab3f4da0511`. Follow-up
`20251012140000` adds `ensure_contact_profile()` trigger +
`profile_contact_rollup` view so new contacts are auto-linked.) Deprecate
`chat_sessions` and `sessions` after migrating any residual code to
`chat_state`.

### Basket Membership

| Table                    | Rows | Purpose                                       | Notes                                                        |
| ------------------------ | ---- | --------------------------------------------- | ------------------------------------------------------------ |
| `baskets`                | 5    | Basket definitions (status/type).             | Active.                                                      |
| `basket_members`         | 1    | Canonical membership (profile linkage, role). | Only new schema uses this.                                   |
| `_archive.basket_joins`  | 0    | Legacy staging for WA join events.            | Archived then dropped in Phase 5 (`20251011130000`).         |
| `basket_contributions`   | 0    | Structured contribution records.              | Created but not populated; superset of legacy contributions. |
| `_archive.contributions` | 0    | Legacy contribution ledger.                   | Archived then dropped in Phase 5.                            |

**Recommendation**: consolidate membership state in `basket_members`.
(Completed: `basket_join_by_code` now updates `basket_members`;
`basket_joins`/`contributions` parked in `_archive`.) Repurpose
`basket_contributions.amount_minor` as canonical amount column and remove
duplicate `amount_rwf` (migration `20251010100000`).

### Mobility Matching

| Table                          | Rows | Purpose                                      | Notes                                  |
| ------------------------------ | ---- | -------------------------------------------- | -------------------------------------- |
| `trips`                        | 47   | Active mobility trip records.                | Referenced by modern RPCs.             |
| `_archive.drivers_available`   | 0    | Legacy near real-time availability snapshot. | Archived then dropped in Phase 5.      |
| `_archive.passengers_requests` | 0    | Legacy request queue (pre-trips).            | Archived then dropped in Phase 5.      |
| `_archive.served_drivers`      | 6    | Historical matching log.                     | Exported to CSV (Phase 5) and dropped. |
| `_archive.served_passengers`   | 4    | Historical matching log.                     | Exported to CSV (Phase 5) and dropped. |

**Recommendation**: migrate historical rows from archived `served_*` tables into
analytics warehouse or enrich `trips` audit columns before final drop.

## Code Reference Scan

- `contacts`: referenced in `wa-webhook` admin broadcast + guard flows (needs
  schema change coordination).
- `basket_joins`, `contributions`, `chat_sessions`, `sessions`,
  `drivers_available`, `passengers_requests`, `served_*`: no runtime references
  after migration staging.

## Next Actions

1. Deploy migrations `20251010100000`, `20251010101000`, `20251010102000` to
   staging, verify backfill + archive moves succeed.
2. Update edge flows that query `contacts` to join on `profile_id` once column
   exists in production.
3. Coordinate export or deletion of archived mobility logs before Phase 5.
