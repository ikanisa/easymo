# Naming Conventions & Shared Enums — Baskets Module

## Database Objects
- **Tables:** snake_case plural (e.g., `ibimina_members`, `momo_sms_inbox`).
- **Primary Keys:** `id UUID DEFAULT gen_random_uuid()` unless business requires natural key; legacy bigint retained as `legacy_id` when necessary.
- **Foreign Keys:** `<entity>_id` (e.g., `ikimina_id`, `sacco_id`).
- **Timestamps:** `created_at`, `updated_at`, `allocated_at`, `received_at` (timestamptz, default `now()` for create columns).
- **Enums:** use PostgreSQL enums prefixed with `enum_` migration helper (e.g., `enum_ikimina_status`) or text with check constraint when values may expand frequently.
- **Indexes:** `idx_<table>_<column[_column]>` (e.g., `idx_contributions_ledger_txn_id`).

## JSON Columns
- `ibimina_settings.reminder_policy`: `{ "quiet_hours": { "start": "22:00", "end": "06:00" }, "templates": { "due_in_3": "template_id" } }`
- `ibimina_settings.quorum`: `{ "roles": ["president","vp","secretary"], "threshold": 3 }`
- `contributions_ledger.meta`: `{ "source_sms_id": "uuid", "notes": "text" }`
- `momo_parsed_txns.parsed_json`: `{ "raw_amount": "5,000", "raw_sender": "NAME", "confidence_breakdown": {"regex":0.8,"llm":0.6} }`
- `kyc_documents.parsed_json`: `{ "full_name": "string", "id_number": "string", "dob": "YYYY-MM-DD", "place_of_issue": "string", "confidence": 0.92 }`
- `sacco_loans.meta` (future): `{ "committee_votes": [{"member_id":"uuid","vote":"approve"}], "sacco_decision": {"by":"uuid","reason":""} }`
- `baskets_reminders.meta`: `{ "cycle": "202511", "amount_minor": 500000 }`

## Shared Enums
- `enum_sacco_status`: `pending`, `active`, `suspended`.
- `enum_ikimina_status`: `pending`, `active`, `suspended`.
- `enum_committee_role`: `president`, `vp`, `secretary`, `treasurer`.
- `enum_member_status`: `pending`, `active`, `removed`.
- `enum_contribution_type`: `fixed`, `variable`.
- `enum_contribution_periodicity`: `weekly`, `monthly`.
- `enum_contribution_source`: `sms`, `admin`, `correction`.
- `enum_cycle_status`: `pending`, `open`, `closed`.
- `enum_momo_unmatched_status`: `open`, `resolved`.
- `enum_loan_status`: `pending`, `endorsing`, `approved`, `rejected`, `disbursed`, `closed`.
- `enum_collateral_source`: `group_savings`, `member_savings`, `guarantor`, `asset`.
- `enum_reminder_status`: `pending`, `queued`, `sent`, `skipped`, `blocked`, `cancelled`.
- `enum_invite_status`: `active`, `used`, `expired`, `canceled`.
- `enum_kyc_status`: `pending`, `verified`, `rejected`.

## API Naming
- REST endpoints use kebab-case segments (e.g., `/api/saccos/branches`).
- Payload keys camelCase for JSON responses (`ikiminaId`, `memberRankings`).
- WhatsApp payload IDs snake_case (e.g., `saccos_menu_member`, `ikimina_invite_token`).

## Audit Actions (prefixes)
- `BASKETS_*` for module-wide events.
- Examples: `BASKETS_CREATE_IKIMINA`, `BASKETS_ALLOCATE_CONTRIBUTION`, `BASKETS_LOAN_DECISION`.

## Error Codes (proposed)
- `BKT_DUP_MEMBERSHIP` — user already in an ikimina.
- `BKT_OCR_LOW_CONFIDENCE` — manual review required.
- `BKT_SMS_DUPLICATE` — duplicate MoMo SMS detected.
- `BKT_LTV_EXCEEDED` — loan request exceeds coverage.
