# Rollout Runbook v1

## Purpose
Phased rollout strategy for AI Concierge features. Each phase has explicit entry/exit criteria and monitoring requirements.

---

## Phase 0 — Local Simulation

**Environment**: Development

### Entry Criteria
- All unit tests passing
- Feature flags OFF by default verified

### Activities
- Mock WhatsApp transport (no real messages)
- Mock vendor database with test data
- Verify dedupe, stop, and shortlist logic
- Test all state transitions

### Exit Criteria
- [ ] All tool contracts validated
- [ ] OCR pipeline tested with sample images
- [ ] Calling workflow tested with mocks
- [ ] No critical issues in logs

---

## Phase 1 — Staging with Internal Testers

**Environment**: Staging

### Entry Criteria
- Phase 0 complete
- Staging credentials configured (separate WhatsApp number)

### Configuration
```bash
FEATURE_AI_CONCIERGE=true
FEATURE_AI_CONCIERGE_OCR=true
FEATURE_AI_CONCIERGE_CALLING=false  # Keep OFF

AI_CONCIERGE_ALLOWLIST_PHONES=+250780000001,+250780000002
AI_CONCIERGE_PERCENT_ROLLOUT=0  # Allowlist only
```

### Activities
- Internal team tests real WhatsApp flow
- OCR tested with real prescriptions/invoices
- Vendor outreach to test vendors only
- Monitor error rates and latencies

### Exit Criteria
- [ ] ≥10 successful request flows
- [ ] OCR accuracy ≥90% on test set
- [ ] No prompt injection detected
- [ ] Time-to-shortlist ≤6 minutes

---

## Phase 2 — Limited Production Pilot

**Environment**: Production

### Entry Criteria
- Phase 1 complete
- Rollback runbook reviewed by team
- Alert channels configured

### Configuration
```bash
FEATURE_AI_CONCIERGE=true
FEATURE_AI_CONCIERGE_OCR=true
FEATURE_AI_CONCIERGE_CALLING=false  # Still OFF

AI_CONCIERGE_ALLOWLIST_PHONES=  # Clear allowlist
AI_CONCIERGE_PERCENT_ROLLOUT=5  # 5% of traffic
```

### Constraints
- Maximum 50 users in pilot
- Maximum 10 vendors contacted per request
- Manual review of first 20 shortlists

### Monitoring
- [ ] Error rate < 5%
- [ ] Time-to-shortlist p95 ≤ 6 minutes
- [ ] Vendor reply rate monitored
- [ ] Zero unsolicited calls

### Exit Criteria
- [ ] ≥100 successful shortlists
- [ ] NPS or satisfaction feedback positive
- [ ] No critical incidents in 7 days

---

## Phase 3 — Expand

**Environment**: Production

### Entry Criteria
- Phase 2 success metrics met
- Calling consent flow tested in staging

### Configuration
```bash
FEATURE_AI_CONCIERGE=true
FEATURE_AI_CONCIERGE_OCR=true
FEATURE_AI_CONCIERGE_CALLING=true  # Enable after consent proven

AI_CONCIERGE_PERCENT_ROLLOUT=25  # Gradual increase
```

### Expansion Schedule
| Week | Rollout % | Calling |
|------|-----------|---------|
| 1 | 25% | ON |
| 2 | 50% | ON |
| 3 | 75% | ON |
| 4 | 100% | ON |

### Monitoring (all phases)
- Error rate
- Time-to-shortlist (p50, p95)
- Vendor reply rate
- Moltbot rejection rate
- OCR failure rate
- Call failure rate
- Cost per request

---

## Rollback Triggers

Immediately rollback if:
- Error rate > 10%
- Time-to-shortlist p95 > 10 minutes
- Any unsolicited call reported
- Prompt injection detected
- Cost spike > 2x baseline

See [rollback-runbook.v1.md](file:///Users/jeanbosco/workspace/easymo/docs/ops/rollback-runbook.v1.md) for procedures.
