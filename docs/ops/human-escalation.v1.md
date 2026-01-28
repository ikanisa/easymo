# Human Escalation Procedure

> **Version:** 1.0  
> **Last Updated:** 2026-01-28

---

## When to Escalate

Escalate to human admin when:

| Trigger | Description |
|---------|-------------|
| **OCR Unclear** | OCR extraction failed or low-confidence, and client cannot clarify after 2 attempts |
| **No Replies** | High-value request with 0 vendor replies after max batches exhausted |
| **Invalid Moltbot** | Repeated invalid Moltbot outputs (3+ consecutive failures) |
| **Vendor Complaint** | Vendor reports spam, harassment, or incorrect information |
| **Client Complaint** | Client reports wrong shortlist, privacy concern, or service issue |
| **Consent Violation** | Suspected calling without proper consent capture |

---

## Escalation Process

### Step 1: Flag Request
Set `marketplace_requests.status = 'needs_admin'` with reason in metadata.

### Step 2: Notify Admin
Send alert via configured channel (Slack/email) with:
- Request ID
- Client phone (masked)
- Escalation reason
- Request summary

### Step 3: Admin Review
Admin reviews request context, conversation history, and vendor replies.

---

## Admin Actions

| Action | When to Use |
|--------|-------------|
| **Choose vendors manually** | Automated selection failed or inappropriate |
| **Send manual message** | Override Moltbot for sensitive communication |
| **Disable calling** | Consent issue or vendor complaint about calls |
| **Close request** | Irrecoverable or satisfied externally |
| **Refund/compensate** | Service failure with verified impact |

---

## Admin Access Endpoints

```
POST /admin/requests/{id}/assign-vendor
POST /admin/requests/{id}/send-message
POST /admin/requests/{id}/disable-calling
POST /admin/requests/{id}/close
```

All admin actions logged to `moltbot_audit_events` with `actor_type = 'admin'`.

---

## Escalation SLAs

| Priority | Response Time | Resolution Time |
|----------|---------------|-----------------|
| High (complaint) | 1 hour | 4 hours |
| Medium (no replies) | 4 hours | 24 hours |
| Low (OCR unclear) | 24 hours | 48 hours |

---

## De-escalation

After admin resolves:
1. Update request status to appropriate terminal state
2. Log resolution in audit events
3. Send client notification if appropriate
4. Close escalation ticket
