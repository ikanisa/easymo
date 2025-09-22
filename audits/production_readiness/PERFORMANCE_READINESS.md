# Performance Readiness

## Critical Paths
1. **Voucher Issuance:** Admin issues up to 5k vouchers per campaign. Supabase insert + bridge call (`admin-app/app/api/vouchers/generate/route.ts`).
2. **Campaign Dispatch:** Bridge-driven WABA sends; requires chunking and throttling (`MESSAGING_POLICY_COMPLIANCE.md`).
3. **Station Redeem:** Real-time voucher status update (Station PWA + Supabase function).

## Current Controls
- Pagination on list endpoints limited to 200/500 rows (`admin-app/lib/data-provider.ts`, API Zod schemas).
- `withIdempotency` prevents duplicate writes but stores payload in memory if Supabase table missing.
- No explicit indices confirmed beyond intent in `DATA_MODEL_DELTA.md`.

## Latency/Capacity Assumptions (Not yet validated)
- Voucher issuance expected <2s per batch via EF (assumption).
- WABA rate limit: 250 msgs/min/channel; no enforcement yet besides throttle config (`settings`).
- Station redeem should respond <500ms to support front-line operations.

## Gaps
- No load/perf tests executed; `LOAD_TEST_PLAN.md` pending execution.
- Supabase connection pool sizing not documented; risk of saturation under campaign spikes.
- Indexes not verified; rely on planned migrations.
- Station PWA offline queue absence may cause retries storms post-outage.

## Recommendations
- Execute load tests per `LOAD_TEST_PLAN.md` once EF instrumentation ready.
- Validate indices (voucher status, campaign status) exist in Supabase; add migrations if missing.
- Implement rate-limiter/backoff in campaign dispatcher Edge Function.
- Monitor Supabase query latency; set SLO (e.g., p95 < 250ms for voucher queries).
- Simulate station redeem peak (multiple redeems per second) in staging.

## Validation Steps
- Use K6/Locust to simulate voucher issuance with 1k batches; measure latency.
- Monitor Supabase CPU/connection metrics during test.
- Record WABA API responses to confirm throttle compliance.

