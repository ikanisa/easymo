# Vendor Rate Limits Policy

> Rule: 96_vendor_rate_limits  
> Category: Outreach Safety

---

## Purpose

Prevent vendor spam and ensure fair, controlled outreach during pilot operations.

---

## Per-Vendor Limits

| Constraint | Value | Rationale |
|------------|-------|-----------|
| **Max outreach/day** | 20 | Prevent vendor fatigue |
| **Cooldown between messages** | 5 minutes | Avoid burst messaging |
| **"Busy" reply exclusion** | 2 hours | Respect vendor availability |
| **Opted-out exclusion** | Permanent | Compliance with opt-out |

---

## Per-Request Limits

| Constraint | Value | Rationale |
|------------|-------|-----------|
| **Max vendors/request** | 15 | Focus on quality matches |
| **Max batches/request** | 3 | Prevent over-expansion |
| **Default batch size** | 5 | Balanced coverage |

---

## Enforcement

1. **Before any outreach:**
   - Check `vendors.is_opted_out = false`
   - Check vendor not contacted in last 5 minutes
   - Check vendor daily outreach count < 20
   - Check vendor not in "busy" exclusion window

2. **Before expanding batch:**
   - Check batch count < 3
   - Check total vendors contacted < 15

3. **On "busy" reply:**
   - Set vendor exclusion for 2 hours
   - Log exclusion in vendor_outreach_log

---

## Rate-Limit Bypass

Rate limits may ONLY be bypassed by:
- Admin manual override with logged justification
- Emergency flag set in request metadata

All bypasses logged to `moltbot_audit_events` with reason.

---

## Monitoring

Track weekly:
- Vendors hitting daily cap
- Requests hitting batch limit
- "Busy" exclusion frequency

Adjust limits if >20% of requests hit caps.
