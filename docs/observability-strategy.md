# Observability & Monitoring Strategy

## Overview

Comprehensive observability guide for production readiness, including structured logging, metrics, dashboards, alerts, and error tracking.

## Table of Contents

1. [Structured Logging](#structured-logging)
2. [Metrics & Counters](#metrics--counters)
3. [Dashboard Specifications](#dashboard-specifications)
4. [Alerting Strategy](#alerting-strategy)
5. [Distributed Tracing](#distributed-tracing)
6. [Performance Monitoring](#performance-monitoring)

---

## Structured Logging

### Log Format Standard

All services MUST emit JSON-formatted logs:

```json
{
  "timestamp": "2025-10-28T12:00:00.000Z",
  "level": "info",
  "event": "MESSAGE_ROUTED",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "service": "wa-router",
  "keyword": "insurance",
  "destinationUrl": "https://...insurance",
  "status": 200,
  "responseTime": 145
}
```

### PII Masking

**Critical**: Mask all PII before logging:

```typescript
// Phone numbers
maskMSISDN("+250788123456") → "****3456"

// Locations
maskLocation({ lat: -2.123456, lon: 30.123456 }) → "~-2, ~30"

// Tokens
maskToken("ABC123XYZ") → "AB****YZ"
```

### Correlation IDs

Every request gets a UUID that flows through all services:

```typescript
const correlationId = crypto.randomUUID();

// Log all events with same ID
logStructuredEvent("REQUEST_RECEIVED", { correlationId });
logStructuredEvent("SIGNATURE_VERIFIED", { correlationId });
logStructuredEvent("MESSAGE_ROUTED", { correlationId });
```

---

## Metrics & Counters

### Key Metrics

#### Router Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `router.requests.total` | Counter | Total requests received |
| `router.signature.verified` | Counter | Signature verifications (success/failure) |
| `router.routed.total` | Counter | Messages routed by keyword |
| `router.unmatched.total` | Counter | Messages with no route |
| `router.duplicate.total` | Counter | Duplicate messages blocked |
| `router.duration.ms` | Histogram | Request processing time |
| `router.destination.status` | Counter | Destination response codes |

#### Deeplink Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `deeplink.issued.total` | Counter | Tokens generated |
| `deeplink.resolved.total` | Counter | Tokens resolved |
| `deeplink.expired.total` | Counter | Expired token attempts |
| `deeplink.rate_limited.total` | Counter | Rate limit hits |

#### Matching Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `matching.requests.total` | Counter | Match requests |
| `matching.candidates.gauge` | Gauge | Candidates found |
| `matching.matched.total` | Counter | Successful matches |
| `matching.favorites_used.total` | Counter | Favorites used |

---

## Dashboard Specifications

### Dashboard 1: Router Health

**Panels**:

1. **Request Rate** (requests/second over last hour)
2. **Success Rate** (% of routed messages)
3. **Keyword Distribution** (pie chart)
4. **p95 Latency** (line chart, warn > 500ms)
5. **Signature Failures** (rate per hour)
6. **Duplicate Messages** (count)

**Alert Thresholds**:
- Success rate < 95% → Warning
- Success rate < 90% → Critical
- p95 latency > 1000ms → Critical

---

### Dashboard 2: Business KPIs

**Panels**:

1. **Daily Active Users** (unique MSISDNs)
2. **Messages per Hour** (bar chart)
3. **Top 5 Keywords** (horizontal bar)
4. **Deeplink Conversion** (% resolved / issued)
5. **Match Success Rate** (% matched / requested)

---

### Dashboard 3: Infrastructure

**Panels**:

1. **Database Connections** (active count, warn > 400)
2. **Edge Function Instances** (active count)
3. **Error Rate** (% errors per service)
4. **Database Query p95** (latency in ms)

---

## Alerting Strategy

### Critical Alerts (P0)

#### High Error Rate
```yaml
Condition: error_rate > 10% for 5 minutes
Action: Page on-call immediately
```

#### Router Down
```yaml
Condition: request_rate == 0 for 2 minutes
Action: Page on-call immediately
```

#### DB Connection Pool Exhausted
```yaml
Condition: active_connections > 450
Action: Page on-call immediately
```

### Warning Alerts (P1)

#### High Response Time
```yaml
Condition: p95_latency > 1000ms for 5 minutes
Action: Slack notification
```

#### High Unmatched Rate
```yaml
Condition: unmatched_rate > 20% for 10 minutes
Action: Slack notification
```

---

## Distributed Tracing

### Request Flow Example

```
[User] → [WhatsApp] → [wa-router] → [insurance-handler] → [DB] → [WhatsApp API]
   ↓          ↓            ↓                ↓              ↓          ↓
correlationId flows through all services
```

### Trace Query

Find all logs for a specific request:

```sql
SELECT * FROM logs
WHERE correlationId = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY timestamp ASC;
```

---

## Performance Monitoring

### SLOs (Service Level Objectives)

| Service | Metric | Target | Measurement |
|---------|--------|--------|-------------|
| Router | Availability | 99.9% | Uptime/month |
| Router | p95 Latency | < 300ms | Per request |
| Deeplink | Availability | 99.5% | Uptime/month |
| Matching | p95 Latency | < 500ms | Per match |

### Performance Targets

- **Router**: < 200ms average, < 500ms p95
- **Deeplink**: < 100ms average, < 250ms p95
- **Matching**: < 300ms average, < 500ms p95
- **Database**: < 50ms average, < 100ms p95

---

## Implementation Checklist

### Pre-Launch

- [x] Structured logging in all services
- [x] Correlation IDs implemented
- [x] PII masking in logs
- [ ] Metrics instrumented
- [ ] Dashboards created
- [ ] Alerts configured
- [ ] Error tracking (Sentry) wired

### Post-Launch

- [ ] Daily dashboard review
- [ ] Weekly alert tuning
- [ ] Monthly SLO review

---

**Last Updated**: 2025-10-28  
**Owner**: easyMO DevOps Team  
**Review Cycle**: Quarterly
