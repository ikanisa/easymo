Observability Gaps
==================

## Resolved in Phase 6

- **Metrics emitter**: `recordMetric` posts JSON payloads to `METRICS_DRAIN_URL`. Deploy your collector at that address (Redpanda Console, OTEL collector, etc.) and ensure it returns 2xx.
- **Synthetic checks**: The GitHub Action `Synthetic Admin Checks` wraps `tools/monitoring/admin/synthetic-checks.ts` and fails fast when `/api/*` endpoints regress.
- **Log forwarding**: `logStructured` now mirrors events to `LOG_DRAIN_URL`, enabling external aggregation.

## Remaining Follow-Ups

- **Tracing**: Add distributed tracing (OpenTelemetry or `@sentry/nextjs` transactions) for cross-service latency visibility.
- **End-to-end correlation**: Propagate `x-request-id` from browser → Supabase → downstream services so dashboards can link spans/logs.
- **Edge function parity**: Port the logging/metrics helpers to Supabase/Deno functions so payloads share a schema with the admin panel.
