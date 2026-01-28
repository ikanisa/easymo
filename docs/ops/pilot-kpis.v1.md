# Pilot KPIs

> **Version:** 1.0  
> **Last Updated:** 2026-01-28

---

## Key Performance Indicators

### Client Experience

| KPI | Description | Target | Measurement |
|-----|-------------|--------|-------------|
| **Time to First Clarification** | Seconds from inbound to first Moltbot question | <30s | Median |
| **Time to Shortlist** | Minutes from request to shortlist delivery | <15 min | Median |
| **Handoff Rate** | % of requests reaching `handed_off` status | >70% | Weekly |
| **Client Satisfaction** | Post-handoff feedback score (if collected) | >4.0/5 | Average |

---

### Vendor Operations

| KPI | Description | Target | Measurement |
|-----|-------------|--------|-------------|
| **Vendor Reply Rate** | % of contacted vendors who reply | >40% | Weekly |
| **Outreach Count/Request** | Avg vendors contacted per request | <10 | Mean |
| **Vendor Opt-Out Rate** | % of vendors opting out | <5% | Cumulative |
| **Positive Response Rate** | % of replies with stock=yes | >30% | Weekly |

---

### OCR & AI

| KPI | Description | Target | Measurement |
|-----|-------------|--------|-------------|
| **OCR Confidence Distribution** | % of extractions with confidence >0.8 | >80% | Weekly |
| **OCR Retry Rate** | % of OCR jobs requiring retry | <10% | Weekly |
| **Moltbot Valid Output Rate** | % of Moltbot calls producing valid JSON | >95% | Weekly |

---

### Escalation & Compliance

| KPI | Description | Target | Measurement |
|-----|-------------|--------|-------------|
| **Call Escalation Rate** | % of requests triggering call | <5% | Weekly |
| **Human Escalation Rate** | % of requests requiring admin | <10% | Weekly |
| **PII Incident Rate** | # of PII leakage incidents | 0 | Cumulative |
| **Consent Violation Rate** | # of unsolicited call violations | 0 | Cumulative |

---

### Cost Efficiency

| KPI | Description | Target | Measurement |
|-----|-------------|--------|-------------|
| **AI Cost/Request** | Avg token cost per request | <$0.05 | Mean |
| **Outreach Cost/Request** | WhatsApp message cost per request | <$0.20 | Mean |
| **Total Cost/Handoff** | End-to-end cost per successful handoff | <$0.50 | Mean |

---

## Dashboard Requirements

Track these KPIs in a weekly dashboard (manual or automated):

1. **Summary cards:** Key metrics with week-over-week change
2. **Trend charts:** 4-week rolling trends for core metrics
3. **Alerts:** Highlight any metric outside target bounds

---

## Review Cadence

- **Daily:** Spot-check critical metrics (escalation, violations)
- **Weekly:** Full KPI review in improvement meeting
- **Monthly:** Executive summary with trend analysis
