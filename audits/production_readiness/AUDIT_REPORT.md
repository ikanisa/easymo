# Production Readiness Audit – easyMO / Kwigira

## Executive Summary

- **Verdict:** **Amber** – Core flows (voucher issuance/redeem, campaign
  drafting, insurance review, notifications) function end-to-end with mock
  fallbacks and policy enforcement. However, production readiness depends on
  closing gaps in RLS hardening, bridge observability, campaign dispatch
  throughput, and Supabase DR/backup validation before GA.
- **Top Findings:**
  - RLS coverage incomplete for newly introduced tables (e.g., `voucher_events`,
    `campaign_targets`) leaving lateral read exposure when service role keys
    leak (see `RLS_POLICY_AUDIT.md`).
  - Edge Function bridges lack health dashboards/alerts; degraded UX exists but
    no automated paging (see `EF_AVAILABILITY_MATRIX.md`).
  - WhatsApp policy stack (opt-out → quiet hours → throttle) enforced in code
    (`admin-app/lib/server/policy.ts:12`), yet no automated regression tests or
    rate-limit monitors.
  - Disaster recovery process undocumented for Supabase migrations and storage
    assets.
  - Station PWA lacks offline queue guarantees, risking double redeem on
    reconnect.

## Scope & Methodology

- **In Scope:** Admin Panel (`admin-app`), Station PWA (`station-app`), Supabase
  schema & RLS, Edge Functions contracts, messaging policy chain, voucher
  lifecycle, observability, security/privacy posture.
- **Out of Scope:** Modifying code, running migrations, altering forbidden
  paths, executing load tests. Observations based on repo inspection (commit
  `fix/ops-manifests-lint-inventory`), documentation (`DATA_MODEL_DELTA.md`,
  `QA_MATRIX.md`), and API handler review (`admin-app/app/api/**`).
- **Method:**
  1. Inventory APIs, data models, policies.
  2. Map user journeys: voucher issuance, campaign dispatch, insurance approval,
     station redeem.
  3. Assess controls: auth/RLS, observability, backups, policy enforcement.
  4. Record evidence with file:line references.
  5. Rank risks (severity × likelihood) and align remediation tasks.

## Evidence Sources

- `admin-app/app/api/vouchers/generate/route.ts:1-200` (idempotent issuance &
  degraded handling).
- `admin-app/lib/server/policy.ts:1-160` (policy evaluation order).
- `DATA_MODEL_DELTA.md:24-123` (voucher/campaign schema intent).
- `QA_MATRIX.md:1-220` (test coverage expectations).
- `admin-app/docs/API.md:1-220` (API surface contract).
- `station-app/README.md` (PWA scope – read only).
- Existing runbooks (`INCIDENT_RUNBOOKS.md`, `ROLLBACK_PLAYBOOK.md`).

## Readiness Heatmap (Severity × Likelihood)

| Risk                                        | Severity | Likelihood |
| ------------------------------------------- | -------- | ---------- |
| RLS gaps on operational tables              | P1       | M          |
| Missing EF monitoring/alerts                | P1       | L          |
| DR/backup process unclear                   | P1       | M          |
| Messaging throttle enforcement visibility   | P2       | M          |
| Voucher replay protection (station offline) | P2       | M          |
| Edge Function rate limiting                 | P2       | L          |
| Privacy/PII masking (station UI)            | P3       | M          |
| Admin accessibility gaps                    | P3       | M          |
| Performance headroom for bulk campaigns     | P3       | M          |
| Documentation & SOP gaps                    | P4       | M          |

## Go-Live Gate Checklist (Pass/Fail Summary)

- **✅ API idempotency** (voucher, campaign, station writes).
- **✅ Policy enforcement** (opt-out → quiet hours → throttle).
- **✅ Degraded UX** for EF outages.
- **✅ Audit trails** (writes call `recordAudit`).
- **⚠️ RLS hardening** – missing coverage for events/targets tables.
- **⚠️ Supabase DR/backups** – plan absent.
- **⚠️ Observability** – no dashboards/alerts.
- **⚠️ Accessibility** – Station PWA outdoor/keyboard audit incomplete.
- **❌ Automated load tests** – plan only, no execution.

## Key Pass/Fail Checkpoints

- **Security:** Service-role usage restricted; RLS verified on
  vouchers/campaigns before launch.
- **Reliability:** EF health probes with alerting in place; DR tabletop
  complete.
- **Performance:** Bulk campaign throughput validated; Supabase connections
  sized.
- **Privacy:** Opt-out list hashed; station UI masks MSISDN consistently
  (`admin-app/components/staff/StaffTable.tsx`, `station-app`).
- **Operability:** Runbooks tested; on-call rota trained.

Refer to supporting artefacts in this folder for detailed findings and
remediation actions.
