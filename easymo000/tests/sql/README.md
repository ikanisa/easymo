## SQL Regression Scripts

This folder contains plain-SQL regression checks for critical functions. Each
script seeds its own fixtures inside a transaction and rolls back automatically
so you can run them against staging snapshots without leaving residue.

### Scripts

- `claim_notifications.sql` — verifies queue locking semantics and privilege
  grants for `security.claim_notifications`.
- `promote_draft_menu.sql` — promotes a draft menu and asserts cloned
  categories/items/modifiers.
- `matching_v2.sql` — seeds minimal mobility data to validate `match_*_v2`
  proximity filters.

### Running

1. Start a Supabase instance (local or remote) with PostGIS enabled.
2. From the repo root execute `psql -f tests/sql/run_all.sql` (or `cd tests/sql`
   then `psql -f run_all.sql`).
3. Scripts raise exceptions when assertions fail; on success you will only see
   the final `ROLLBACK`.
