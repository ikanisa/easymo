# Phase 1 Naming & Classification Guide

## Table naming
- Use `snake_case` with singular nouns (e.g., `basket_member`, `wallet_transaction`) unless the table is a factual log (`*_log`) or queue (`*_queue`).
- Append `_log` for append-only audit tables and `_queue` for transient dispatch tables; both require explicit retention policies.
- Archive tables move to the `_archive` schema and keep the original table name to ease discovery (e.g., `_archive.basket_joins`).

## Column naming
- Primary UUID columns follow `<entity>_id` when the entity differs from the PK name. Keep `id` for canonical primary keys.
- Monetary values are stored in minor units with an integer type and `_minor` suffix; avoid duplicate major-unit columns (`amount_rwf`).
- Timestamps end with `_at` and use UTC-aware defaults (`timezone('utc', now())`).

## Relationship patterns
- All identity links reference `profiles.user_id`; use `_profile_id` or `_user_id` consistently.
- Marketing data links to profiles via nullable `profile_id` while still enforcing uniqueness on channel identifiers (`msisdn_e164`).
- Prefer helper views for RLS-friendly exposure instead of granting direct `SELECT` on raw tables to anonymous roles.

## Documentation expectations
- Update `/docs/refactor/db_tables.md` whenever a table changes classification or ownership.
- Record migration IDs and archive moves alongside table entries in the Phase tracker.
- Keep ERD diagrams in `docs/refactor/phase*/` aligned with naming changes.
