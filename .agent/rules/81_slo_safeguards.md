# SLO Safeguards

## Purpose
Define Service Level Objectives (SLOs) and safeguards for the AI Concierge system.

---

## SLO Targets

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Shortlist time | 90% ≤ 6 minutes | p95 > 8 minutes |
| Webhook dedupe | 99% correctly deduped | > 1% duplicates |
| Unsolicited calls | 0% | Any occurrence |
| OCR accuracy | 90% confidence | > 30% low confidence |
| Error rate | < 5% | > 10% |

---

## Shortlist Time SLO

**Definition**: Time from request creation to shortlist delivery.

**Target**: 90th percentile ≤ 6 minutes

**Measurement**:
```sql
SELECT 
  PERCENTILE_CONT(0.9) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (shortlist_generated_at - created_at))
  ) / 60 as p90_minutes
FROM moltbot_requests
WHERE state = 'handed_off'
  AND created_at > NOW() - INTERVAL '24 hours';
```

**Safeguards**:
- If p95 > 8 minutes: Alert on-call
- If p95 > 10 minutes: Consider rollback

---

## Webhook Dedupe SLO

**Definition**: Percentage of webhook events correctly deduplicated.

**Target**: 99% correctly deduped

**Measurement**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE is_duplicate) * 100.0 / COUNT(*) as duplicate_rate
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '1 hour';
```

**Safeguards**:
- If duplicate_rate > 1%: Alert + investigate
- If duplicate_rate > 5%: Possible infrastructure issue

---

## Zero Unsolicited Calls SLO

**Definition**: No calls made without explicit consent.

**Target**: 0% unsolicited calls

**Measurement**:
```sql
SELECT COUNT(*)
FROM moltbot_calls c
LEFT JOIN moltbot_call_consents cc ON c.phone = cc.phone AND c.request_id = cc.request_id
WHERE cc.consent_given IS NOT TRUE
  AND c.created_at > NOW() - INTERVAL '24 hours';
```

**Safeguards**:
- If ANY unsolicited call: Immediate incident
- Auto-disable calling: `FEATURE_AI_CONCIERGE_CALLING=false`

---

## Budget Safeguards

### Token Budget
- Max tokens per request: 10,000
- Max tokens per hour per user: 50,000
- Alert threshold: > 80% of limit

### Time Budget
- Max Moltbot response time: 30 seconds
- Timeout action: Return fallback response

### Cost Budget
- Daily cost ceiling: $100 (configurable)
- Alert at: 80% of ceiling
- Action at 100%: Disable AI features

---

## Alerting Configuration

```yaml
# alertmanager config snippet
groups:
  - name: ai_concierge_slos
    rules:
      - alert: ShortlistTimeSLOBreach
        expr: moltbot_shortlist_time_p95_minutes > 8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Shortlist time p95 exceeds 8 minutes"

      - alert: UnsolicitedCall
        expr: moltbot_unsolicited_calls_total > 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Unsolicited call detected - immediate action required"

      - alert: HighOCRFailureRate
        expr: moltbot_ocr_low_confidence_rate > 0.3
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "OCR low confidence rate exceeds 30%"
```

---

## Circuit Breakers

| Condition | Action |
|-----------|--------|
| Error rate > 10% for 5 min | Reduce rollout to 0% |
| p95 latency > 15 sec for 5 min | Reduce rollout to allowlist only |
| Cost > daily ceiling | Disable AI features |
| Unsolicited call | Disable calling immediately |

---

## Review Cadence

- **Daily**: Review SLO dashboard
- **Weekly**: SLO report to stakeholders
- **Monthly**: Adjust targets based on data
