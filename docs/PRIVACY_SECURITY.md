# Privacy & Security — Baskets Module (Skeleton)

## Data Classification
- PII: National IDs, MSISDNs, loan details.
- Financial: Contributions, loan collateral.

## Storage Controls
- Encrypted at rest (Supabase defaults).
- Access via RLS roles.

## Minimization & Masking
- Mask MSISDN in non-privileged views.
- Retain OCR artifacts only as required for compliance.

## Secrets Management
- Edge functions read from secure env vars; no secrets client-side.

## Compliance & Audit
- Audit log on all mutations.
- Retention policies TBD with SACCO requirements.

