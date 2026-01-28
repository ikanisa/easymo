# Contract Enforcement — Moltbot Output Validation

## Purpose
Ensure all Moltbot outputs are validated against the schema before execution.
This rule protects against malformed outputs, injection attempts, and runaway AI.

---

## Validation Flow

```
Moltbot Output
     │
     ▼
┌─────────────────────┐
│ validateMoltbotOutput() │
└─────────────────────┘
     │
     ├── Valid ──────────────────────────► Execute Plan
     │
     └── Invalid ─────┐
                      │
                      ▼
              ┌──────────────────┐
              │ Log Rejection    │
              │ Notify Client    │
              │ Use Fallback     │
              └──────────────────┘
```

---

## Validation Rules

### Required Structure
Every Moltbot output MUST:
1. Be a valid JSON object (not string, array, or null)
2. Have a `type` field with one of: `ask_client`, `vendor_outreach_plan`, `shortlist`, `escalate`
3. Include all required fields for that type (per `output-contract.v1.json`)
4. Pass all field-level validations (lengths, ranges, formats)

### Limit Enforcement
These limits are enforced during validation:

| Field | Limit | Action if exceeded |
|-------|-------|-------------------|
| `batch_size` | max 5 | Reject output |
| `max_vendors` | max 15 | Reject output |
| `vendor_questions` | max 4 | Reject output |
| `shortlist.items` | max 5 | Truncate to 5 |
| `question_text` length | max 500 chars | Truncate |

---

## Rejection Handling

When validation fails:

### 1. Audit Log
```typescript
await supabase.from('moltbot_audit_log').insert({
  event_type: 'output_rejected',
  request_id: context.requestId,
  raw_output: sanitize(output),
  rejection_reason: validationResult.error,
  timestamp: now(),
});
```

### 2. Safe Fallback Message
Send to client:
```
"I'm processing your request. A team member will follow up shortly."
```

### 3. Fallback Workflow
If Moltbot fails 3x in a row for same request:
1. Set `AI_CONCIERGE_ENABLED = false` for this request
2. Route to coded workflow
3. Alert ops for review

---

## Consecutive Failure Tracking

Track failures per request:

```typescript
const key = `moltbot_failures:${requestId}`;
const count = await redis.incr(key);
await redis.expire(key, 3600); // 1 hour TTL

if (count >= 3) {
  await activateKillSwitch(requestId);
}
```

---

## Implementation Reference

Validation function location:
- `packages/types/src/moltbot-types.ts` → `validateMoltbotOutput()`

Orchestrator integration:
- `src/orchestrator/index.ts` → calls `validateMoltbotOutput()` before tool execution

---

## Testing Requirements

Unit tests must cover:
- Valid outputs accepted
- Invalid outputs rejected with specific error messages
- Limit-exceeding outputs rejected
- Consecutive failure triggers kill switch

See: `tests/unit/moltbot-tool-registry.test.ts`
