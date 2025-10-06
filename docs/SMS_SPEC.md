# MoMo SMS Spec — Baskets Module (Skeleton)

## Sources
- GSM modem or aggregator delivering raw SMS.

## Message Formats
- Sample: "You have received RWF {amount} from {name} {msisdn} TxnID {txn} on {date} {time}."

## Ingest

### Endpoint

```
POST /functions/v1/momo-sms-hook
Headers:
  Content-Type: application/json
  X-Signature: <HMAC hex>        # optional, enabled when MOMO_SMS_HMAC_SECRET is set
  X-Forwarded-For: <client-ip>   # used against MOMO_SMS_ALLOWED_IPS when present

Body:
{
  "message": "You have received RWF 12,000 from ...",
  "msisdn": "+250788000001",           # optional – raw sender number
  "receivedAt": "2025-01-18T14:20:00Z", # optional ISO8601
  "ingestSource": "modem-1",            # optional label (defaults to gateway)
  "metadata": {...}                      # ignored for now, reserved for future
}
```

### Behaviour

- Calculates SHA-256 hash over `message|msisdn|receivedAt` for dedupe.
- Inserts into `momo_sms_inbox` with `hash`, `raw_text`, `msisdn_raw`, `received_at`, `ingest_source`.
- Returns `{ ok: true, inboxId }` or `{ ok: true, duplicate: true }` when the hash already exists.
- HMAC validation (when `MOMO_SMS_HMAC_SECRET` set) uses header `x-signature` (hex-encoded SHA256 HMAC).
- Optional IP allow-list via `MOMO_SMS_ALLOWED_IPS` (comma-separated).

## Allocation Worker

### Endpoint

```
POST /functions/v1/momo-allocator
Body (optional): { "limit": 10 }
```

### Behaviour

1. Fetches up to `limit` unprocessed rows from `momo_sms_inbox` (`processed_at IS NULL`).
2. Parses each message with deterministic regex heuristics. Fields extracted: amount, currency, txn_id, txn timestamp, sender name, MSISDN.
3. Inserts into `momo_parsed_txns` (unique on `txn_id`).
4. Resolves member by `profiles.whatsapp_e164` → `ibimina_members(status='active')`.
5. On success, writes to `contributions_ledger` (`source='sms'`) and bumps cycle totals via `upsert_contribution_cycle`.
6. On ambiguity/low confidence/missing data, creates a `momo_unmatched` row linked to the parsed transaction.
7. Updates `momo_sms_inbox.processed_at`, `attempts`, and `last_error` accordingly.

### Responses

```
{
  "ok": true,
  "summary": {
    "processed": 5,
    "allocated": 4,
    "unmatched": 1,
    "duplicates": 0,
    "skipped": 0,
    "errors": []
  }
}
```

## Idempotency & Dedupe
- Inbox dedupe: `momo_sms_inbox.hash` unique index.
- Parsed dedupe: `momo_parsed_txns.txn_id` unique when present.
- Ledger dedupe: `contributions_ledger.txn_id` unique where not null.

## Failure & Escalation
- Rows that cannot be allocated (missing member, low confidence, etc.) land in `momo_unmatched` for reconciliation UI.
- Unexpected allocator errors update `momo_sms_inbox.last_error`; the row remains unprocessed so the next run can retry.

## Observability
- `attempts` on inbox rows exposes retry counts.
- `last_error` captures the final state (`low_confidence`, `profile_not_found`, etc.).
- Allocator summary is returned per invocation; aggregate metrics can be scraped from logs.
