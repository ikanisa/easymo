# Service Level Objectives (SLOs)

## Availability SLOs

### Core Service Availability

| Metric                   | Target    | Measurement  |
| ------------------------ | --------- | ------------ |
| Uptime                   | 99.9%     | Monthly      |
| Max consecutive downtime | 5 minutes | Per incident |
| Health check success     | 99.95%    | Hourly       |

**Calculation:**

```
Availability = (Total Minutes - Downtime Minutes) / Total Minutes × 100
```

**Exclusions:**

- Scheduled maintenance (with 24h notice)
- Force majeure events
- Third-party outages (Meta, Supabase)

### Per-Service Availability

| Service              | Target Uptime |
| -------------------- | ------------- |
| wa-webhook-core      | 99.9%         |
| wa-webhook-profile   | 99.5%         |
| wa-webhook-mobility  | 99.5%         |
| wa-webhook-insurance | 99.5%         |

## Latency SLOs

### Response Time Objectives

| Percentile | Target   | Applies To   |
| ---------- | -------- | ------------ |
| P50        | < 200ms  | All requests |
| P90        | < 500ms  | All requests |
| P95        | < 800ms  | All requests |
| P99        | < 1500ms | All requests |

### Cold Start Objectives

| Metric         | Target   |
| -------------- | -------- |
| Cold start P50 | < 500ms  |
| Cold start P99 | < 2000ms |

## Error Rate SLOs

### Error Budget

| Period  | Error Budget                |
| ------- | --------------------------- |
| Monthly | 0.1% (43.2 minutes @ 99.9%) |
| Weekly  | 0.1% (10.08 minutes)        |

### Error Rate Thresholds

| Metric         | Target | Alert Threshold |
| -------------- | ------ | --------------- |
| 5xx Error Rate | < 0.1% | > 0.5%          |
| 4xx Error Rate | < 5%   | > 10%           |
| Timeout Rate   | < 0.5% | > 1%            |

## Throughput SLOs

### Capacity Requirements

| Metric                 | Minimum | Target  |
| ---------------------- | ------- | ------- |
| Requests per second    | 50 rps  | 100 rps |
| Concurrent connections | 100     | 500     |
| Messages per minute    | 500     | 1000    |

## Recovery SLOs

### Recovery Time Objectives (RTO)

| Severity | Target RTO |
| -------- | ---------- |
| SEV1     | 15 minutes |
| SEV2     | 1 hour     |
| SEV3     | 4 hours    |
| SEV4     | 24 hours   |

### Recovery Point Objectives (RPO)

| Data Type        | Target RPO  |
| ---------------- | ----------- |
| User data        | 0 (no loss) |
| Transaction data | 0 (no loss) |
| Session state    | 1 hour      |

## Error Budget Policy

### Budget Consumption

| Remaining Budget | Action                               |
| ---------------- | ------------------------------------ |
| > 50%            | Normal operations                    |
| 25-50%           | Increased monitoring                 |
| 10-25%           | Feature freeze, focus on reliability |
| < 10%            | All hands on reliability             |

### Budget Reset

- Error budget resets on the 1st of each month
- Unused budget does not roll over

_Last Updated: 2025-12-02_ _Review Frequency: Quarterly_
