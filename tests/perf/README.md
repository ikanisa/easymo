# Performance Test Harness

This directory hosts repeatable load tests for the three high-risk customer
journeys outlined in [`audits/production_readiness/LOAD_TEST_PLAN.md`](../../audits/production_readiness/LOAD_TEST_PLAN.md).
The suite is intentionally split between [k6](https://k6.io/) (for synchronous
HTTP workloads) and [Locust](https://locust.io/) (for dispatcher-style fanout)
so the staging environment can be stressed using tools the team already
supports.

## Prerequisites

1. Install dependencies locally:
   - Node.js 18+
   - `pnpm install`
   - `k6` ≥ 0.48
   - `locust` ≥ 2.20
2. Export Supabase admin credentials (service role) for staging:

   ```bash
   export SUPABASE_URL="https://staging-project.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="..."
   ```

3. Configure dispatcher + integration endpoints so the bridges called by the
   admin panel resolve inside staging:

   ```bash
   export PERF_APP_BASE_URL="https://staging-admin.easymo.africa"
   export PERF_VOUCHER_PREVIEW_URL="${PERF_APP_BASE_URL}/api/vouchers/preview"
   export PERF_CAMPAIGN_DISPATCH_URL="https://dispatcher.staging.easymo.africa/campaigns"
   export PERF_STATION_REDEEM_URL="https://station-api.staging.easymo.africa/redeem"
   export PERF_SUPABASE_METRICS_URL="https://console.supabase.com/project/.../metrics"
   ```

   The URLs above are examples—override them to match the actual staging
   deployment. The scripts only rely on environment variables so no secrets are
   hard-coded.

4. (Optional) export WhatsApp sandbox credentials if you want Locust to report
   WABA responses during the run:

   ```bash
   export PERF_WABA_SANDBOX_NUMBER="whatsapp:+250788000000"
   export PERF_WABA_SANDBOX_TOKEN="..."
   ```

## 1. Seed staging with deterministic fixtures

The `perf_seed.mjs` script builds on the canonical fixture plan to provision
10 users, 50 stations, 20 vouchers, 2 campaigns, 12 curated campaign targets
and a 10k target bulk set for high-volume tests. It also synchronises voucher
history so k6 assertions can verify redemption timelines.

Run the script any time you need to reset staging before executing the load
tests:

```bash
pnpm perf:seed
```

Outputs are written to `tests/perf/fixtures/generated/perf_seed_summary.json`
which is consumed by all three test harnesses. The summary includes voucher
IDs/codes, campaign IDs, station IDs and the generated campaign target batch
identifier so the load runners avoid querying staging to discover that data at
runtime.

> **Idempotent:** The seeding script uses Supabase upserts and Admin API user
> updates, so it is safe to re-run without duplicating rows.

## 2. Execute the three scenarios

### Voucher preview spike (k6)

```bash
pnpm perf:test:voucher
```

- 500 concurrent previews ramped over five minutes using staged arrival rates.
- Validates voucher preview image/PDF generation and records p95 latency.

### Campaign bulk send (Locust)

```bash
pnpm perf:test:campaign
```

- Dispatches 10k campaign targets via the dispatcher endpoint using a swarm of
  Locust users.
- Streams dispatcher and optional WABA responses to stdout for audit capture.

### Station redeem peak (k6)

```bash
pnpm perf:test:redeem
```

- Simulates 50 stations redeeming 3 vouchers per minute for 10 minutes.
- Verifies each redeem response returns within the defined SLO and that voucher
  state changes persist.

## 3. Observability capture

During each run collect:

- Supabase metrics from `${PERF_SUPABASE_METRICS_URL}` (CPU %, connections,
  bandwidth, latency per table).
- Dispatcher and WABA HTTP status distribution (Locust logs to
  `./.perf/locust-responses.log`).
- k6 summary JSON (saved to `./.perf/k6-*.json`).

The harness writes raw metrics under `.perf/` so they can be attached to an
EVIDENCE archive or referenced from the performance readiness report.
Create the directory upfront with `mkdir -p .perf` or change the output paths
via `PERF_OUTPUT_FILE` / `PERF_LOCUST_LOG` environment variables.

## Extending the suite

- Update `tests/perf/seed/perf_seed.mjs` with additional fixture types when new
  load scenarios surface.
- Add new k6 scripts under `tests/perf/k6/` following the shared helper module
  (`perf-shared.js`) if future work introduces it.
- Mirror any throttling or pool changes in the Locust task so the dispatcher
  test stays representative of production configurations.

## Troubleshooting

- Ensure Supabase RLS policies admit the service role—the script requires full
  table access.
- If Locust logs 401 responses, verify `BRIDGE_SHARED_SECRET` matches the
  staging deployment secret and is exported before running the swarm.
- When running locally, set `K6_WEB_DASHBOARD=true` to view real-time charts in
  the browser if desired.
