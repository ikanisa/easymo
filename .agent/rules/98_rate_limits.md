# Rate Limiting Rules

## Purpose

Define rate limits to prevent abuse, spam, and resource exhaustion.

---

## Per-Client Limits

| Limit | Value | Action on Exceed |
|-------|-------|------------------|
| Inbound messages/minute | 20 | Cooldown 5 minutes |
| Active requests | 5 | Reject new requests |
| OCR jobs/request | 2 | Reject additional |

### Implementation

```typescript
// Check before processing inbound message
const recentCount = await countRecentMessages(clientPhone, 60); // last 60s
if (recentCount >= 20) {
    await writeAuditEvent({
        event_type: 'client.rate_limit_exceeded',
        actor: 'client',
        input: { client_phone: clientPhone, count: recentCount },
    });
    throw new RateLimitError('Too many messages');
}
```

---

## Per-Vendor Limits

| Limit | Value | Action on Exceed |
|-------|-------|------------------|
| Outreach/day | 20 | Skip vendor |
| Cooldown between outreaches | 5 minutes | Delay send |
| Messages per hour | 10 | Queue for later |

### Rationale

- Prevent vendor fatigue
- Avoid WhatsApp rate limits
- Ensure fair distribution

---

## Per-Request Limits (Moltbot)

| Limit | Value | Enforced In |
|-------|-------|-------------|
| Moltbot calls | 8 | Orchestrator loop counter |
| OCR calls | 2 | OCR job creation |
| Max vendors in plan | 15 | `enforceToolCaps()` |
| Max batch size | 5 | `enforceToolCaps()` |
| Max batches | 3 | `enforceToolCaps()` |

### Implementation

```typescript
// src/security/injectionGuards.ts
export function enforceToolCaps(plan: VendorOutreachPlan): VendorOutreachPlan {
    return {
        ...plan,
        vendor_ids: plan.vendor_ids.slice(0, 15),
        batch_size: Math.min(plan.batch_size, 5),
        max_batches: Math.min(plan.max_batches ?? 3, 3),
    };
}
```

---

## Global Limits

| Limit | Value | Action |
|-------|-------|--------|
| Concurrent requests/phone | 3 | Queue excess |
| AI token budget/minute | 100K | Pause AI calls |
| WhatsApp API calls/minute | 80 | Backpressure |

---

## Kill Switch Triggers

Automatically disable AI features when:

1. Rate limit exceeded 3x in 1 minute
2. Moltbot returns invalid output 3x consecutively
3. Cost budget exceeded
4. Consent violation attempted

```typescript
// Set kill switch
await supabase.from('feature_flags').update({
    enabled: false,
    disabled_reason: 'rate_limit_exceeded',
    disabled_until: new Date(Date.now() + 15 * 60 * 1000), // 15 min
}).eq('flag_name', 'AI_CONCIERGE_ENABLED');
```

---

## Monitoring

Track these metrics:

| Metric | Alert Threshold |
|--------|-----------------|
| `rate_limit_exceeded_total` | > 50/hour |
| `client_blocked_total` | > 10/hour |
| `vendor_daily_limit_hit` | > 20 vendors/day |
| `moltbot_loop_exhausted` | > 5/hour |

---

## Exempt Scenarios

Rate limits MAY be bypassed for:
- Admin-initiated test requests (with audit)
- System health checks
- Scheduled batch operations (with approval)

Always log bypasses to audit trail.
