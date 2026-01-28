# Alerting Rules

## Purpose
Detect and respond to system anomalies before they impact users.

## Alert Thresholds

### OCR Failure Rate
- **Warning**: > 10% daily failure rate
- **Critical**: > 25% daily failure rate
- **Window**: Rolling 24 hours
- **Action**: Check image quality patterns, provider status

### Moltbot Rejection Rate
- **Warning**: > 5% daily rejection rate
- **Critical**: > 15% daily rejection rate
- **Window**: Rolling 24 hours
- **Action**: Review rejected outputs, check prompt drift

### Vendor Reply Rate
- **Warning**: < 15% reply rate after 4 hours
- **Critical**: < 5% reply rate after 4 hours
- **Window**: Per request type, rolling 7 days
- **Action**: Review vendor selection, check message deliverability

### Call Failures
- **Warning**: > 10% failure rate in 1 hour
- **Critical**: > 30% failure rate in 1 hour
- **Window**: Rolling 1 hour
- **Action**: Check provider status, pause calling if needed

### Budget Exceeded Rate
- **Warning**: > 5% of requests hit Moltbot budget
- **Critical**: > 15% of requests hit any budget
- **Window**: Rolling 24 hours
- **Action**: Review complex requests, consider budget adjustment

### Time-to-Shortlist
- **Warning**: P95 > 5 minutes
- **Critical**: P99 > 8 minutes
- **Window**: Rolling 6 hours
- **Action**: Review slow requests, check vendor response times

## Alert Severity Levels

### INFO
- Budget utilization > 50%
- New vendor onboarded
- Feature flag toggled

### WARNING
- Threshold approaching
- Degraded but operational
- Requires attention within hours

### CRITICAL
- Threshold exceeded
- User impact likely
- Requires immediate attention

### EMERGENCY
- Multiple critical alerts
- System-wide degradation
- All hands on deck

## Alert Routing

| Severity | Channel | Response Time |
|----------|---------|---------------|
| INFO | #alerts-info (Slack) | Review daily |
| WARNING | #alerts-production (Slack) | < 4 hours |
| CRITICAL | PagerDuty + Slack | < 30 minutes |
| EMERGENCY | PagerDuty (escalate) | < 5 minutes |

## Alert Format

```yaml
alert:
  name: string
  severity: INFO | WARNING | CRITICAL | EMERGENCY
  summary: string (short, actionable)
  description: string (details, context)
  runbook_url: string (link to resolution steps)
  labels:
    service: moltbot | ocr | vendor | calling
    component: string
```

## Required Runbooks

Each CRITICAL alert must have a runbook:
1. What triggered the alert
2. How to investigate
3. How to mitigate immediately
4. How to resolve permanently
5. How to verify resolution

## Alert Suppression

### Suppression Windows
- During maintenance windows
- During known provider outages
- During traffic spikes (Black Friday, etc.)

### Auto-Resolve
- OCR failure alert auto-resolves when rate drops below warning
- Time-based alerts auto-resolve after 15 minutes below threshold

## Escalation Policy

1. **5 minutes**: Alert fires → on-call notified
2. **15 minutes**: No ack → secondary on-call notified
3. **30 minutes**: No ack → engineering manager notified
4. **60 minutes**: No ack → VP Engineering notified + incident declared
