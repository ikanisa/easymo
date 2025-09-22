# RLS Policy Audit

## Method
Read-only review of Supabase schema intent (`DATA_MODEL_DELTA.md`), existing documentation, and application access patterns (`admin-app/lib/server/policy.ts`, API handlers). No migrations or policies were modified.

## Current Policies (Documented / Assumed)
| Table | Intended Access | Evidence | Notes |
| --- | --- | --- | --- |
| `vouchers` | Admin (all); station (scope-limited); end-user (self) | `DATA_MODEL_DELTA.md:52-90`; policy engine restricts redeem scope (`admin-app/lib/server/policy.ts`) | Need explicit RLS enforcing station scope & user ownership. |
| `voucher_events` | Admin; station (own scope); read-only | No explicit policy file found | High risk – events likely inherit table-level open access. |
| `campaigns` | Admin roles only | API handlers require admin context (`admin-app/app/api/campaigns/route.ts:53-170`) | Ensure Supabase RLS matches app-level checks. |
| `campaign_targets` | Admin (limited to campaign); no station/user access | No policy located | Must prevent leakage of recipient MSISDN hashes. |
| `insurance_quotes` | Admin (Support); user (own quote); station none | Drawer logic fetches quotes via admin creds (`admin-app/components/insurance/InsuranceDrawer.tsx`) | Verify RLS differentiates between admin and user contexts. |
| `stations` | Admin full; station operator limited to own record | API allows create/update/delete for admins (`admin-app/app/api/stations/[id]/route.ts`) | Confirm RLS using role claims. |
| `settings` | Admin read/write; others read-only public keys | API writes service role path (`admin-app/app/api/settings/route.ts`) | RLS should restrict to admin roles; throttle/quiet hours are sensitive. |
| `audit_log` | Admin read-only | `admin-app/app/api/logs/route.ts` expects service role | Use row level policies to restrict to admin users only. |

## Gaps & Recommendations
1. **voucher_events RLS absent** – implement policy ensuring only admin role or station with matching scope can view events. Evidence: no policy references found; application expects admin to query events.
2. **campaign_targets exposure** – ensure only admins can query; apply row filter on `jwt.claims.role in ('super_admin','support')`.
3. **settings table** – require admin role for writes; allow read for public keys via dedicated function. `POST /api/settings` uses service role fallback, implying missing RLS.
4. **audit_log fallback** – ensure select blocked for non-admin; consider security definer wrapper to expose necessary audit rows.

## Roles & Access Patterns
- **Admin (super_admin/support/data_ops):** Full CRUD on vouchers, campaigns, insurance, settings; read audit log.
- **Station Operator:** Read vouchers scoped to station; redeem voucher; cannot view PII beyond masked MSISDN.
- **End User:** Interact via WhatsApp; no direct Supabase access.

## Minimal Additive Fixes (Recommendations Only)
- Create RLS policies per table (admin-only + station scope) in new migrations files (not part of this audit).
- Add PostgREST RPC for safe audit log read with pagination.
- Integrate policy assertions into CI using Supabase CLI `db remote inspect` (documented step).

## Validation Guidance
- Use Supabase dashboard or `supabase db remote inspect` to list policies and ensure `using`/`with check` clauses match above recommendations.
- Test station JWT access via PostgREST to confirm denial where appropriate.

