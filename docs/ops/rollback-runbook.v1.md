# Rollback Runbook v1

## Purpose
Procedures for instant rollback of AI Concierge features. Target: < 1 minute to safe state.

---

## Emergency Rollback (Full)

### When to Execute
- Critical bug in Moltbot reasoning
- Prompt injection detected
- Unsolicited calls reported
- Cost spike > 3x baseline
- Any data leak or privacy incident

### Procedure

**Step 1: Disable all AI features (< 30 seconds)**

```bash
# Via environment variables
export FEATURE_AI_CONCIERGE=false
export FEATURE_AI_CONCIERGE_CALLING=false
export FEATURE_AI_CONCIERGE_OCR=false

# Apply to running services
# Cloud Run:
gcloud run services update <service> --set-env-vars="FEATURE_AI_CONCIERGE=false,FEATURE_AI_CONCIERGE_CALLING=false,FEATURE_AI_CONCIERGE_OCR=false"

# Or via database (if using feature_flags table):
psql -c "UPDATE feature_flags SET enabled = false WHERE name LIKE 'ai_concierge%';"
```

**Step 2: Verify coded workflows active (< 30 seconds)**

```bash
# Check logs for fallback activation
grep "fallback to coded workflow" /var/log/app.log | tail -5

# Or via monitoring dashboard
# Confirm: AI request count drops to 0
# Confirm: Coded workflow count increases
```

**Step 3: Keep logging on**
- Do NOT disable logging during rollback
- Logs are critical for post-incident analysis

**Step 4: Notify stakeholders**
- Post in #incidents channel
- Page on-call if after hours

---

## Partial Rollback — Calling Only

### When to Execute
- Call quality complaints
- Consent capture failures
- Voice API outages

### Procedure

```bash
export FEATURE_AI_CONCIERGE_CALLING=false

# Cloud Run:
gcloud run services update <service> --set-env-vars="FEATURE_AI_CONCIERGE_CALLING=false"
```

**Effect**: AI reasoning and OCR continue working. Calls disabled.

---

## Partial Rollback — OCR Only

### When to Execute
- Medical prescription misreads
- High uncertainty rates (>30%)
- Gemini API outage

### Procedure

```bash
export FEATURE_AI_CONCIERGE_OCR=false

# Cloud Run:
gcloud run services update <service> --set-env-vars="FEATURE_AI_CONCIERGE_OCR=false"
```

**Effect**: AI reasoning continues. Users must type requirements manually (no image processing).

---

## Partial Rollback — Reduce Traffic

### When to Execute
- Gradual degradation observed
- Want to limit blast radius

### Procedure

```bash
export AI_CONCIERGE_PERCENT_ROLLOUT=0

# Cloud Run:
gcloud run services update <service> --set-env-vars="AI_CONCIERGE_PERCENT_ROLLOUT=0"
```

**Effect**: Only allowlisted phones use AI. All others get coded workflows.

---

## Post-Rollback Checklist

- [ ] Confirm flags are OFF in all production instances
- [ ] Verify user traffic routed to coded workflows
- [ ] Export audit pack for affected time window
- [ ] Create incident report
- [ ] Root cause analysis scheduled
- [ ] Re-enable criteria documented

---

## Recovery Procedure

### Before Re-enabling
1. Root cause identified and fixed
2. Fix deployed to staging
3. Staging validation passed
4. Team approval obtained

### Re-enable
```bash
# Start with minimal rollout
export FEATURE_AI_CONCIERGE=true
export AI_CONCIERGE_PERCENT_ROLLOUT=5

# Monitor for 1 hour
# If stable, gradually increase
```

---

## Contacts

| Role | Contact |
|------|---------|
| On-call Engineer | [Defined in PagerDuty] |
| Incident Commander | [Defined in runbook] |
| Stakeholder | [Product lead] |
