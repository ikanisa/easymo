# Edge Function Monitoring & Alerting Spec

## Scope

Applies to voucher preview, voucher send, voucher generate, campaign dispatcher,
insurance workflow, station directory, and notifications dispatcher Edge
Functions.

## Metrics to Collect

- **Availability:** Success vs failure counts (HTTP status buckets).
- **Latency:** p50/p95/p99 response times per function.
- **Throughput:** Requests/minute segmented by action (send, create, approve).
- **Degraded Flags:** Count of responses that triggered
  `integration.status = 'degraded'` in Admin UI.

## Instrumentation Plan

1. **Supabase Edge Logging:** Enable structured logs with `event`, `target`,
   `status`, `request_id` (mirror `edge-bridges` payload).
2. **Health Endpoint:** Add `/health` route returning 200 when dependencies OK;
   used by uptime checks.
3. **Metrics Export:**
   - Option A: Use Supabase Logflare → BigQuery + Grafana dashboards.
   - Option B: Send metrics to Prometheus via Pushgateway (requires serverless
     cron).
4. **Correlation IDs:** Pass `x-correlation-id` header from Admin UI to Edge
   Functions; log it for tracing.

## Dashboards

- **Overview Panel:** Status of each EF (green/amber/red).
- **Voucher Ops:** Issuance count, preview failures, send queue depth.
- **Campaign Dispatcher:** Sends/min, retries, WABA 429 rate.
- **Insurance Workflow:** Approvals vs requests, failure reasons.

## Alerts

| Alert                | Condition                                | Action                                                     |
| -------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| EF Down              | Health check failing 3 consecutive times | Page on-call (PagerDuty); switch UI to degraded messaging. |
| Error Spike          | HTTP 5xx > 5% in 5 min                   | Page on-call; examine recent deploy.                       |
| Latency Breach       | p95 latency > 2s for 10 min              | Notify Ops; consider scaling or investigating dependency.  |
| Degraded Badge Surge | >20 degraded responses in 15 min         | Investigate root cause; correlated with frontend badges.   |

## Runbook Integration

- Link alerts to runbook sections in `INCIDENT_RUNBOOKS.md`.
- Provide quick links to recent logs dashboards.

## Implementation Steps

1. Configure health checks via monitoring stack (e.g., UptimeRobot, AWS
   CloudWatch Synthetics).
2. Add log sink to Logflare/Datadog with JSON parsing.
3. Build Grafana dashboard using metrics (availability, latency, throughput).
4. Wire alerts to PagerDuty escalation policy.
5. Document verification steps in `SYSTEM_CHECKLIST.md`.

## Validation

- Simulate EF failure (disable function) in staging and verify alert fires <5
  min.
- Trigger manual degraded response by removing endpoint var; ensure
  dashboard/badge align.
- Record results in evidence log.
