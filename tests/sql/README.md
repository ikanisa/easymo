## SQL Regression Scripts

This folder now contains pgTAP regression checks for critical database
functions. Each script seeds its own fixtures inside a transaction and rolls
back automatically, so you can run them against staging snapshots without
leaving residue.

### Suites

- `claim_notifications.sql` — verifies queue locking semantics and privilege
granularities for `security.claim_notifications`.
- `promote_draft_menu.sql` — promotes a draft menu and asserts cloned
categories/items/modifiers.
- `matching_v2.sql` — seeds minimal mobility data to validate
  `match_*_v2` proximity filters.

### Running

1. Start a Supabase instance (local or remote) with PostGIS, pgcrypto, vector,
   and pgTAP extensions available.
2. From the repo root execute `pnpm test:sql` (or `pg_prove --recurse tests/sql` when running outside the workspace).
3. Suites emit TAP output; failures are surfaced as individual failed tests.
