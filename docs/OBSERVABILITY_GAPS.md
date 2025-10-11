Observability Gaps
=================

Short-term gaps and recommended follow-ups:

- Metrics emitter: `recordMetric` is a no-op. Replace with a real client (StatsD, Prometheus, or OTEL) and configure sample rates.
- Tracing: Consider adding `@sentry/nextjs` (or OTEL) transactions via `instrumentation.ts` to capture request/DB spans.
- Log correlation: Plumb `x-request-id` across all API calls (client/server) and include in `logStructured` calls.
- Alerting: Wire synthetic check outputs to a notifier (Slack, email) and add dashboards for failure counts.
- Edge functions: Add similar logging/capture helpers for Supabase/Deno functions and align JSON shapes.

