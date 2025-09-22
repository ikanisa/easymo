# Security Review

## Secrets & Credentials
- Service role keys referenced only server-side (`admin-app/app/api/**`). Ensure stored in secrets manager (Vault/AWS SM).
- Edge Function bridges accept `Authorization` header + `x-bridge-secret` when configured (`admin-app/lib/server/edge-bridges.ts:60-89`). Rotate secrets quarterly.
- No evidence of secrets committed to repo; `.env` ignored via `ALLOWLIST` policies.

## Authentication & Authorization
- Admin UI assumes authenticated session via Next Auth (not reviewed; ensure SSO/OIDC integration).
- Supabase RLS still pending for newer tables (see `RLS_POLICY_AUDIT.md`).
- Station PWA relies on session tokens; confirm device binding to prevent sharing.

## Upload Handling
- Insurance docs stored in Supabase Storage (`DATA_MODEL_DELTA.md`). Deletion/retention policy unspecified; implement TTL.
- Signed URL endpoint returns mock URL when credentials missing (`admin-app/app/api/files/signed-url/route.ts:1-80`). Ensure TTL <= 60s in production to reduce leak window.

## SSRF/CSRF/Injection
- All API routes use Next.js `route.ts`; CSRF mitigated via authenticated session; confirm same-site cookies.
- External fetch targets restricted to configured endpoints in `edge-bridges`; avoid user-controlled URLs.
- Input validation via Zod prevents type issues, but sanitize `metadata` fields before logging to avoid log injection.

## Dependency Posture
- `package.json` includes `papaparse`, `@supabase/supabase-js`, Next 14.2.3. Schedule Dependabot / renovate for patch updates.
- Add SCA scanning for Edge Function code (not in scope here).

## Station PWA Risks
- Device theft: ensure sign-out and token revocation within Supabase auth.
- Replay attempts: voucher redeem must use atomic update in Supabase; verify `redeemed_at` check occurs server-side.
- Offline mode: queue not implemented; risk of double spend if manual process repeated.

## Network & Infra
- Supabase Data hosted (region unspecified). Confirm GDPR compliance for Malta; data residency documented.
- WhatsApp Cloud API / MoMo integration require allowlisted IPs; ensure secrets handled server-side.

## Recommended Actions
1. Finish RLS hardening and add admin role claims enforcement.
2. Document and test storage retention policies (insurance docs, voucher PNG).
3. Implement device-level protections (PIN/Biometric) for Station PWA if feasible.
4. Add SAST/SCA pipeline checks (ESLint, Dependabot, npm audit gating).
5. Conduct penetration test focusing on API routes and PWA offline behavior.

## Validation
- Run Supabase policy inspection to ensure no table lacks RLS.
- Verify secrets present only in managed vault; rotate sample secret before launch.
- Execute security tabletop covering token compromise scenario.

