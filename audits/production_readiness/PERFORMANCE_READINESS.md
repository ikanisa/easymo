# Performance Readiness

## Critical Paths

1. **Voucher Issuance:** Admin issues up to 5k vouchers per campaign. Supabase
   insert + bridge call (`admin-app/app/api/vouchers/generate/route.ts`).
2. **Campaign Dispatch:** Bridge-driven WABA sends; requires chunking and
   throttling (`MESSAGING_POLICY_COMPLIANCE.md`).
3. **Station Redeem:** Real-time voucher status update (Station PWA + Supabase
   function).

## Current Controls

- Pagination on list endpoints limited to 200/500 rows
  (`admin-app/lib/data-provider.ts`, API Zod schemas).
- `withIdempotency` prevents duplicate writes but stores payload in memory if
  Supabase table missing.
- No explicit indices confirmed beyond intent in `DATA_MODEL_DELTA.md`.

## Latency/Capacity Assumptions (Not yet validated)

- Voucher issuance expected <2s per batch via EF (assumption).
- WABA rate limit: 250 msgs/min/channel; no enforcement yet besides throttle
  config (`settings`).
- Station redeem should respond <500ms to support front-line operations.

## Gaps

- Supabase connection pool sizing not documented; risk of saturation under
  campaign spikes.
- Indexes not verified; rely on planned migrations.
- Station PWA offline queue absence may cause retries storms post-outage.

## Recommendations

- Execute load tests per `LOAD_TEST_PLAN.md` once EF instrumentation ready.
- Validate indices (voucher status, campaign status) exist in Supabase; add
  migrations if missing.
- Implement rate-limiter/backoff in campaign dispatcher Edge Function.
- Monitor Supabase query latency; set SLO (e.g., p95 < 250ms for voucher
  queries).
- Simulate station redeem peak (multiple redeems per second) in staging.

## Load test harness status (March 2025)

- Added automated fixtures + load scripts under `tests/perf/`:
  - `tests/perf/seed/perf_seed.mjs` materialises the dataset defined in
    `DATA_FIXTURES_PLAN.md` (10 users, 50 stations, 170 vouchers, 2 campaigns,
    10k targets) and writes
    `tests/perf/fixtures/generated/perf_seed_summary.json` consumed by the test
    runners.
  - k6 scenarios for voucher preview spike and station redeem peak capture
    latency/error thresholds aligned with `LOAD_TEST_PLAN.md`.
  - Locust scenario dispatches 10k campaign targets with configurable throttles
    while logging dispatcher/WABA responses to `.perf/` for evidence capture.
- Harness validated locally for syntax/configuration, but end-to-end execution
  against staging is still pending because the sandbox Supabase URL and bridge
  secrets are not accessible from this environment.

### Proposed SLOs (pending first execution)

| Scenario | Throughput Target | SLO (p95 latency) | Error Budget |
| --- | --- | --- | --- |
| Voucher preview spike | 500 previews over 5 minutes | ≤ 1,000 ms | ≤ 1% non-2xx |
| Campaign bulk send | 10k targets @ ≥100/min | Dispatcher ack ≤ 2,000 ms | ≤ 5% 429/5xx |
| Station redeem peak | 150 redeems/min sustained for 10 min | ≤ 500 ms | ≤ 1% failed redeems |

The first staging execution should capture Supabase CPU/bandwidth, connection
pool utilisation, and dispatcher throttling telemetry. Update the table with
observed p95/p99 results once data is available and tune throttles/connection
limits based on the findings.

## Validation Steps

- Use K6/Locust to simulate voucher issuance with 1k batches; measure latency.
- Monitor Supabase CPU/connection metrics during test.
- Record WABA API responses to confirm throttle compliance.
