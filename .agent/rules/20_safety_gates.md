# Safety Gates — Moltbot Tool Registry

## Purpose
Define mandatory safety gates for the Moltbot orchestration layer.
These gates protect against runaway AI, resource exhaustion, and consent violations.

---

## Feature Flags

All AI capabilities are gated behind feature flags. **Default: OFF.**

| Flag | Default | Controls |
|------|---------|----------|
| `AI_CONCIERGE_ENABLED` | `false` | Moltbot decision loop |
| `OCR_ENABLED` | `false` | Image/document processing |
| `CALLING_ENABLED` | `false` | WhatsApp voice calls |

### Implementation
- Flags stored in `feature_flags` table
- Checked at start of every orchestrator run
- If flag missing or error → use safe default (OFF)

---

## Hard Limits (Non-Negotiable)

### Vendor Outreach
| Limit | Value | Enforced In |
|-------|-------|-------------|
| `batch_size` | max 5 | `validateMoltbotOutput()` |
| `max_vendors` | max 15 | `validateMoltbotOutput()` |
| Double-ping prevention | 1 per (request, vendor) | DB unique constraint |

### OCR
| Limit | Value | Enforced In |
|-------|-------|-------------|
| Confidence threshold | 0.7 | OCR pipeline (ask_client below) |
| Max jobs per request | 3 | Application logic |

### Rate Limits
| Limit | Value | Enforced In |
|-------|-------|-------------|
| Messages per minute | 10 | WhatsApp transport |
| Moltbot calls per request | 20 | Orchestrator |

---

## Consent Gate — Calling

**Rule:** `start_call` tool MUST fail if:
1. No consent record exists
2. Consent state is not `granted`
3. Consent `expires_at` has passed

### Implementation (in `tools/index.ts`)
```typescript
async function toolStartCall(supabase, consentId) {
  const { data } = await supabase
    .from('moltbot_call_consents')
    .select('state, expires_at')
    .eq('id', consentId)
    .single();

  if (!data) throw new Error('Consent not found');
  if (data.state !== 'granted') throw new Error('Consent not granted');
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    throw new Error('Consent expired');
  }

  // Proceed with call...
}
```

---

## Output Contract Validation

Any Moltbot output that fails validation triggers:
1. Audit log with rejection reason
2. Safe fallback message to client
3. No tools executed

Valid output types:
- `ask_client`
- `vendor_outreach_plan` (with limits enforced)
- `shortlist`
- `escalate`

---

## Kill Switch

If any of these conditions occur, immediately switch to coded workflow:
1. `AI_CONCIERGE_ENABLED` = false
2. Moltbot returns invalid output 3x in a row
3. Rate limit exceeded
4. Consent violation attempted

Kill switch state persisted in `feature_flags` with TTL.
