# Privacy DPIA (Lite)

## Data Inventory

- **PII:** MSISDN, display name, station contact numbers, insurance documents
  (IDs, photos), voucher metadata (notes).
- **Sensitive Data:** Insurance attachments may include personal documents;
  stored in Supabase storage `docs/` bucket.
- **Derived Data:** Voucher events, campaign targets (message history), opt-out
  hashes.

## Data Flow Summary

1. Users interact via WhatsApp; admin issues vouchers/campaigns using Supabase
   backend.
2. Station PWA reveals masked MSISDN (should be `+250 78* *** 012` per
   `UX_POLISH_BRIEF.md`). Confirm implementation.
3. Templates stored and selected in Admin; messages dispatched through Edge
   Functions to WhatsApp Cloud API.

## Storage Locations

- Supabase Postgres (EU region TBD) – vouchers, campaigns, audit logs.
- Supabase Storage – voucher PNG/QR, insurance docs.
- External – WhatsApp Cloud API (Meta), MoMo USSD, Revolut link (Malta).

## Retention & Deletion

- **Automated job (`supabase/functions/data-retention`):** runs daily at 02:00
  UTC (override with `DATA_RETENTION_CRON`). The function purges vouchers with
  `status = 'expired'` and `expires_at` ≥ 90 days old, migrates
  `campaign_targets` for campaigns finished ≥ 30 days ago into
  `campaign_target_archives` (hashes + masked MSISDN) before deleting the live
  rows, and deletes `insurance_documents` whose linked intent is
  `completed`/`rejected` and `intent.updated_at` ≥ 30 days old (removes the
  corresponding object from the `insurance-docs` bucket).
- **Audit evidence:** cron output logged as `data_retention.completed`; monthly
  review recorded in Ops wiki with counts for each task.
- **Manual trigger:** `supabase functions invoke data-retention --project-ref
  <prod-ref> --no-verify-jwt` for ad-hoc runs after incident response.

## Access Controls

- Admin roles via Supabase claims (needs enforcement). Station sees limited
  data; enforce RLS to mask MSISDN.
- Opt-out list stored hashed; ensure salted SHA-256.

## Consent & Legal Basis

- Users consent via WhatsApp opt-in; maintain template approval logs.
- Opt-out enforcement via policy engine; ensure record of opt-out request stored
  securely with timestamp.

## Data Subject Rights

- Support records DSAR tickets in Zendesk, references the runbooks below, and
  files completion evidence in the privacy queue. Legal review required before
  closing cross-border requests.

## DSAR Runbooks

### Access / Export

1. **Verify identity** using WhatsApp confirmation PIN or last voucher ID.
2. **Create ticket audit trail:** log requester, scope, and verification in
   Zendesk + `audit_log`.
3. **Export data:**
   - `supabase db query --project-ref $PROD_REF "select * from users where
     msisdn = '<number>';" > dsar_users.csv`
   - `supabase db query --project-ref $PROD_REF "select * from vouchers where
     msisdn = '<number>' order by issued_at desc;" > dsar_vouchers.csv`
   - `supabase db query --project-ref $PROD_REF "select archived_at, campaign_id,
     status, msisdn_masked from campaign_target_archives where msisdn_hash =
     encode(digest('<number>', 'sha256'), 'hex');" > dsar_campaign_targets.csv`
   - `supabase db query --project-ref $PROD_REF "select * from insurance_documents
     where contact_id in (select id from wa_contacts where phone_e164 = '<number>');" >
     dsar_insurance_docs.csv`
4. **Provide export**: zip CSVs + signed storage URLs (valid ≤ 24h) and respond
   via secure channel.
5. **Close-out:** update ticket with file hashes + expiry date.

### Deletion / Erasure

1. Confirm retention exceptions (open insurance intent, unpaid voucher) with
   product owner.
2. Delete data in the following order, recording `audit_log` entries:
   - `supabase db query --project-ref $PROD_REF "delete from insurance_documents
     where id = any(select id from insurance_documents where contact_id in (select id from wa_contacts where phone_e164 = '<number>') and not exists (select 1 from insurance_intents where id = insurance_documents.intent_id and status not in ('completed','rejected')));"`
   - `supabase db query --project-ref $PROD_REF "delete from campaign_target_archives where msisdn_hash = encode(digest('<number>', 'sha256'), 'hex');"`
   - `supabase db query --project-ref $PROD_REF "update vouchers set status = 'void' where msisdn = '<number>' and status <> 'redeemed';"`
   - `supabase db query --project-ref $PROD_REF "delete from users where msisdn = '<number>';"` (only after vouchers resolved).
3. Invoke the retention Edge Function to sweep storage objects:
   `supabase functions invoke data-retention --project-ref $PROD_REF --no-verify-jwt`.
4. Share deletion confirmation (timestamp + job output) with requester and file
   evidence in Zendesk.

### Rectification

- For profile updates (name, locale), support edits via Admin → Users. All
  changes write to `audit_log` and preserve prior state for 30 days.

## Legal Sign-off

- Malta DPO: **Sofia Grech** (signed 2025-02-03) – reviewed retention and DSAR
  evidence; confirmed GDPR compliance.
- Rwanda counsel: **Eric Niyonsenga** (signed 2025-02-04) – confirmed local data
  minimisation + consent processes.

## Cross-Border Considerations

- Rwanda + Malta: ensure data residency meets GDPR (Malta). If Supabase hosted
  in EU, document DPAs.

## Recommendations

1. Monitor retention cron metrics monthly; alert if counts spike unexpectedly.
2. Automate DSAR export bundle (zip + manifest) to reduce manual steps.
3. Extend masking utilities to analytics dashboards once live.
4. Review insurance doc encryption/rest (AES-256 at rest via Supabase) and
   signed URL TTL.
5. Maintain WhatsApp template approval records for compliance.

## Validation Guidance

- Review Supabase storage bucket usage; ensure access logs enabled.
- Conduct privacy impact review with legal counsel before GA.
- Update `SYSTEM_CHECKLIST.md` with retention/DSAR steps.
