# External Discovery Cost Controls

## Purpose
Prevent runaway web/maps/social discovery calls and keep budgets predictable.

## Rules
- External discovery MUST be gated by feature flags:
  - EXTERNAL_DISCOVERY_ENABLED
  - MAPS_ENRICHMENT_ENABLED
  - SOCIAL_DISCOVERY_ENABLED
- Per-request budgets (defaults):
  - DISCOVERY_MAX_CALLS_PER_REQUEST = 2
  - MAPS_MAX_CALLS_PER_REQUEST = 2
  - DISCOVERY_MAX_RESULTS = 10
- If budgets are exceeded, discovery must be skipped and an audit event logged.
- Never loop discovery; run once per request unless explicitly retried by a human.

## Required artifacts
- Audit event when discovery is blocked by budget.
- Configuration values documented in code (feature flags / budgets).

## Escalation
If budgets are exceeded repeatedly or costs spike unexpectedly, stop automation and notify maintainers.
