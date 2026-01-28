# QA Review Checklist

> **Version:** 1.0  
> **Last Updated:** 2026-01-28

---

## Weekly Review Cadence

**Frequency:** Weekly (every Monday)  
**Sample size:** 10 random completed requests  
**Reviewer:** Ops lead or designated QA

---

## Review Criteria

For each sampled request, check:

### 1. Clarification Quality
- [ ] Minimal clarifying questions asked (≤2 before outreach)
- [ ] Questions were relevant and necessary
- [ ] No redundant or confusing clarifications

### 2. Outreach Compliance
- [ ] Vendors contacted within rate caps (≤15/request, ≤20/vendor/day)
- [ ] Opted-out vendors were NOT contacted
- [ ] Batch sizes respected (default 5, max 3 batches)

### 3. Shortlist Quality
- [ ] Shortlist is evidence-based (vendors actually replied positively)
- [ ] Ranking follows policy (price, match, response time)
- [ ] No fabricated or unverified vendor claims

### 4. Handoff Quality
- [ ] Handoff message is clean and actionable
- [ ] wa.me links work correctly
- [ ] Client can directly contact vendors

### 5. Privacy & Compliance
- [ ] No PII leakage in logs or vendor messages
- [ ] Location shared only with consent
- [ ] Client phone never exposed to vendors

### 6. Calling Compliance
- [ ] No unsolicited calls made
- [ ] Call consent properly captured before any call
- [ ] Call fallback handled gracefully

---

## Issue Categorization

When issues are found, categorize them:

| Category | Description | Owner |
|----------|-------------|-------|
| **Taxonomy Gap** | Need not recognized or misclassified | Taxonomy team |
| **Prompt Improvement** | Moltbot output suboptimal but valid | AI team |
| **Parsing Bug** | Vendor reply parsed incorrectly | Backend team |
| **Policy Gating Bug** | Rate limits or consent gates bypassed | Backend team |
| **UX Issue** | Client confusion or poor message flow | Product team |

---

## Issue Tracking

Log issues to `docs/ops/qa-issues.log.md` with:
```
## [Date] Issue #N
- Request ID: xxx
- Category: [category]
- Description: [what went wrong]
- Severity: Low/Medium/High
- Action: [fix planned or deployed]
```

---

## Quality Metrics

Track weekly:
- Issues found per 10 reviews
- Issues by category (trend)
- Repeat issues (same category 2+ weeks)

Target: **<2 issues per 10 reviews** after pilot stabilizes.
