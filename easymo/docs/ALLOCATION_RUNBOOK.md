# Allocation Runbook — Baskets Module (Skeleton)

## Scope
- Covers end-to-end flow from MoMo SMS ingest to contribution ledger posting.

## Pipelines
1. SMS Ingest (`momo-sms-hook`)
   - Validate HMAC/IP allow list.
   - Persist raw payload + hash to `momo_sms_inbox`.
   - Monitor duplicates (hash collisions) and queue depth.
2. Parsing & Allocation (`momo-allocator`)
   - Batch size controlled by `MOMO_ALLOCATOR_BATCH_SIZE` (default 10).
   - Regex heuristics extract amount, currency, txn ID, timestamp, MSISDN.
   - Auto-allocation requires confidence ≥ `MOMO_ALLOCATOR_MIN_CONFIDENCE` and (optionally) a txn ID.
   - Success path inserts into `momo_parsed_txns` → `contributions_ledger` → `upsert_contribution_cycle`.
   - Records `processed_at`, increments `attempts`, clears `last_error`.
3. Unmatched Case Handling
   - Reasons captured in `momo_unmatched.reason` (e.g., `profile_not_found`, `low_confidence`).
   - Admin UI resolves cases, which should flip `status` to `resolved` and optionally trigger manual allocation.
4. Rollback Procedures
   - Use ledger UI/API to reverse incorrect entries (insert compensating entry with `source='correction'`).
   - Update `contribution_cycles` manually via SQL helper if required.
   - Mark `momo_unmatched` resolved once manual fix applied.

## Operational Checks
- Queue sizes (inbox where `processed_at` NULL, unmatched `status='open'`).
- Allocations per minute (ledger rows with `source='sms'`).
- Error rates (count of inbox rows with non-null `last_error`).
- Duplicate detection (allocator summary + ledger unique-constraint hits).
- **Alert thresholds (pilot guidance):**
  - `momo_sms_inbox` unprocessed > 25 rows for more than 10 minutes → investigate ingest failures.
  - `momo_unmatched` open cases > 10 or any single case older than 60 minutes → escalate to reconciliation workflow.

## Incident Response
- Pause allocator by disabling the cron/worker trigger; leave ingest running (inbox queue persists).
- For manual allocation, locate the inbox row, resolve member, and use admin UI to log a correction entry.
- To re-run allocator on a specific SMS, clear `processed_at`/`last_error` and ensure `momo_parsed_txns` row is removed if inserted.

## Audit Trail
- Edge functions emit structured logs (`momo_sms_hook.*`, `momo_allocator.*`).
- `contributions_ledger.meta` stores inbox/parsing references for each allocation.
- `audit_log` captures manual corrections and unmatched resolutions via admin APIs.
