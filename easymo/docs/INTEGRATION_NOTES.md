# Integration Notes — Baskets Module

## SACCO & Ikimina References
- `saccos.id`: primary identifier for SACCO branches; referenced by `sacco_officers.sacco_id` and `ibimina.sacco_id`.
- `ibimina.slug`: used for deep-link tokens and public references.
- `ibimina_accounts.sacco_account_number`: surfaced in admin settings and contribution instructions.

## Membership & Committee
- `ibimina_members.user_id`: must remain unique for status `active` (partial unique index).
- `ibimina_committee.role`: limited to `president | vp | secretary | treasurer`; UI should enforce single occupant per role.
- `ibimina_settings.quorum`: JSON payload controlling committee voting thresholds for loans.

## Contributions Pipeline
- `contributions_ledger.txn_id`: idempotency anchor for allocator; duplicates prevented by unique index.
- `contributions_ledger.source`: track origin (`sms | admin | correction`).
- `contribution_cycles`: provides expected vs collected values per `yyyymm`; update alongside ledger inserts.
- `member_rankings` view: drives UI leaderboards (total and current month rankings).

## SMS Ingest
- `momo-sms-hook` edge function receives raw JSON payloads (HMAC + IP protected) and writes to `momo_sms_inbox`.
- `momo_sms_inbox.hash`: SHA hash of message/msisdn/timestamp; prevents duplicate ingest.
- `momo-allocator` processes unhandled rows, populates `momo_parsed_txns`, and allocates contributions.
- `momo_parsed_txns.confidence`: allocator sets overall confidence; low values route to unmatched handling.
- `momo_unmatched`: reconciliation queue; UI should change `status` to `resolved` once linked.

## Loans & Collateral
- `sacco_loans.status`: workflow states consumed by admin UI and WhatsApp notifications.
- `sacco_collateral.coverage_ratio`: computed at allocation time; supports LTV eligibility.
- `sacco_loans.meta`: store endorsements, decision metadata, repayment schedule (JSON).

## Invitations & Deep Links
- `basket_invites.token`: single-use deep link resolved by `deeplink-resolver` EF.
- `basket_invites.expires_at`: enforce TTL in both admin UI and WhatsApp entry flow.

## Admin API (Phase 2 Skeleton)
- `GET /api/baskets/saccos` — paginated SACCO branch listing with search/filtering.
- `GET /api/baskets/ibimina` — paginated Ibimina listing joined with SACCO context.
- `POST /api/baskets/saccos` — create SACCO branch records.
- `PATCH /api/baskets/saccos/:id` — update branch metadata/status.
- `GET /api/baskets/saccos/officers` — list SACCO officers with linked profile metadata.
- `POST /api/baskets/saccos/officers` — assign officer to a branch.
- `DELETE /api/baskets/saccos/officers/:id` — remove officer assignment.
- `GET /api/baskets/memberships` — list Ikimina memberships with profile context.
- `PATCH /api/baskets/memberships/:id` — update membership status.
- `GET /api/baskets/momo/unmatched` — list unmatched MoMo SMS for reconciliation.
- `PATCH /api/baskets/momo/unmatched/:id` — resolve or reclassify unmatched SMS.
- `POST /api/baskets/invites` — create deep-link invites with TTL.
- `POST /api/baskets/invites/accept` — activate membership by invite token.
- `GET /api/baskets/search/users` — profile search for officer/member assignment.
- `POST /api/baskets/momo/unmatched/:id/allocate` — allocate unmatched SMS to a member and ledger.
- `GET /api/baskets/contributions` — paginated ledger view with Ikimina/Member joins.
- `GET /api/baskets/kyc` — list KYC documents awaiting review.
- `PATCH /api/baskets/kyc/:id` — approve/reject KYC documents.
- `GET /api/baskets/settings` / `PATCH /api/baskets/settings` — fetch and update quiet hours, templates, feature flags.
- `GET /api/baskets/loans` — list loan requests with collateral summaries.
- Additional CRUD endpoints will be added in later phases; current routes provide read-only data for dashboard cards.

## KYC
- `kyc_documents.parsed_json`: output from `ibimina-ocr`; review UI compares with images.
- `kyc_documents.status`: drives KYC queue filtering (pending vs verified vs rejected).

## Settings Seeds
- `settings` keys inserted via `20251031120000_baskets_seed_settings.sql`:
  - `baskets.quiet_hours`
  - `baskets.templates`
  - `baskets.feature_flags`
  Update values through admin PWA (Phase 2) rather than direct SQL.
