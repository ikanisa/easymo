# Observability Gaps

## Current State

- **Application Logs:** API handlers log console errors on Supabase/bridge
  failures (`admin-app/app/api/vouchers/send/route.ts:57-74`,
  `admin-app/app/api/campaigns/route.ts:119`). No structured logging or
  correlation IDs.
- **Audit Log:** Writes attempted via `recordAudit`
  (`admin-app/lib/server/audit.ts:1-45`) but fall back to mock array when
  Supabase unavailable, providing no alerting.
- **Integration Badges:** UI surfaces degraded states via
  `IntegrationStatusBadge`
  (`admin-app/components/ui/IntegrationStatusBadge.tsx`), providing operator
  visibility but no alert automation.
- **QA Matrix:** Manual observability checks limited to log viewer polling
  (`QA_MATRIX.md:190-204`).

## Missing Capabilities

1. **Centralized Logging:** Need structured logs (JSON) capturing `actor`,
   `action`, `target_table`, `integration.status`, `request_id` across all API
   handlers.
2. **Correlation IDs:** No mechanism to propagate IDs from client to server to
   EF bridge, making tracing multi-step interactions difficult.
3. **Metrics/Dashboards:** No dashboards for voucher issuance rate, campaign
   throughput, policy blocks, EF latency.
4. **Alerts:** No on-call alerts for EF downtime, policy spike, audit fallback,
   Supabase errors.
5. **Bridge Health Telemetry:** `edge-bridges` helper lacks metric emission;
   only logs on console.

## Recommendations

- Implement structured logging wrapper that emits JSON to Supabase Logflare or
  external stack; include context fields.
- Inject correlation IDs (UUID) per request; propagate to Edge Function headers
  for traceability.
- Publish custom metrics (voucher issuance count, policy blocks) via Supabase
  functions or external telemetry (Prometheus/Grafana).
- Configure alert rules: EF availability (<99.5%), policy block rate (>5/min),
  audit fallback occurrences.
- Extend `EF_AVAILABILITY_MATRIX.md` with SLO targets and integrate with
  monitoring.
- Document operator dashboards in runbooks.

## How to Validate

- After implementing, verify logs contain structured entries in Supabase log
  explorer.
- Confirm dashboards exist in chosen monitoring tool; screenshot in evidence
  index.
- Run simulated EF outage; ensure alert triggers within SLA.
