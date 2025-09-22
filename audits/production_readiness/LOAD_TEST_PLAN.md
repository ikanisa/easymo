# Load Test Plan

## Objectives
- Validate system resilience under peak voucher issuance, campaign send, and station redeem workloads.
- Confirm policy throttles kick in without degrading user experience.
- Produce baseline metrics for GA go/no-go.

## Scenarios
1. **Voucher Preview Spike**
   - **Description:** 500 concurrent voucher preview requests over 5 minutes (operator QA + customer resend requests).
   - **KPIs:** p95 latency < 1s; error rate < 1%. Supabase bandwidth usage.
   - **Abort Threshold:** >5% 5xx responses or latency > 2s sustained.

2. **Campaign Bulk Send**
   - **Description:** Dispatch 10k campaign targets via dispatcher (batches of 100/min).
   - **KPIs:** Bridge throughput, WABA 429 rate, policy block count, audit log ingestion.
   - **Abort Threshold:** WABA 429 > 5% or queue backlog > 15 minutes.

3. **Station Redeem Peak**
   - **Description:** 50 stations redeem 3 vouchers/minute simultaneously for 10 minutes.
   - **KPIs:** Redeem latency < 500ms, voucher state consistency (no double spend), Supabase CPU.
   - **Abort Threshold:** Redeem errors > 1% or latency > 1s sustained.

## Tooling
- Recommend K6/Locust for HTTP workloads; custom script for station redeem (simulate RPC).
- Use staging environment with production-like data size.

## Preparation
- Seed dataset per `DATA_FIXTURES_PLAN.md`.
- Ensure logging/metrics dashboards live before test.
- Coordinate with Messaging Ops to avoid real customer sends (use sandbox WABA numbers).

## Execution Steps
1. Review checklist with Ops; confirm alerting muted or directed to test channel.
2. Run scenario scripts sequentially; capture metrics.
3. Record anomalies in `EVIDENCE_INDEX.md`.

## Reporting
- Summaries appended to `Performance Readiness` doc upon completion.
- Include throughput, error rate, resource utilization, bottleneck analysis.

