# Privacy DPIA (Lite)

## Data Inventory
- **PII:** MSISDN, display name, station contact numbers, insurance documents (IDs, photos), voucher metadata (notes).
- **Sensitive Data:** Insurance attachments may include personal documents; stored in Supabase storage `docs/` bucket.
- **Derived Data:** Voucher events, campaign targets (message history), opt-out hashes.

## Data Flow Summary
1. Users interact via WhatsApp; admin issues vouchers/campaigns using Supabase backend.
2. Station PWA reveals masked MSISDN (should be `+250 78* *** 012` per `UX_POLISH_BRIEF.md`). Confirm implementation.
3. Templates stored and selected in Admin; messages dispatched through Edge Functions to WhatsApp Cloud API.

## Storage Locations
- Supabase Postgres (EU region TBD) – vouchers, campaigns, audit logs.
- Supabase Storage – voucher PNG/QR, insurance docs.
- External – WhatsApp Cloud API (Meta), MoMo USSD, Revolut link (Malta).

## Retention & Deletion
- No documented retention schedule. Recommendation: purge expired vouchers (>=90 days), archive campaign targets post-campaign, auto-delete insurance docs after decision.

## Access Controls
- Admin roles via Supabase claims (needs enforcement). Station sees limited data; enforce RLS to mask MSISDN.
- Opt-out list stored hashed; ensure salted SHA-256.

## Consent & Legal Basis
- Users consent via WhatsApp opt-in; maintain template approval logs.
- Opt-out enforcement via policy engine; ensure record of opt-out request stored securely with timestamp.

## Data Subject Rights
- Process for data export/deletion not documented. Document workflow (support ticket → DB query → confirm deletion).

## Cross-Border Considerations
- Rwanda + Malta: ensure data residency meets GDPR (Malta). If Supabase hosted in EU, document DPAs.

## Recommendations
1. Draft retention policy and implement automated deletions (cron/EFF) with audit evidence.
2. Provide DSAR (Data Subject Access Request) SOP for support team.
3. Ensure station UI masks PII consistently; add tests.
4. Review insurance doc encryption/rest (AES-256 at rest via Supabase) and signed URL TTL.
5. Maintain WhatsApp template approval records for compliance.

## Validation Guidance
- Review Supabase storage bucket usage; ensure access logs enabled.
- Conduct privacy impact review with legal counsel before GA.
- Update `SYSTEM_CHECKLIST.md` with retention/DSAR steps.

