# Kill Switch Policy

## Purpose
Define the operational policy for AI Concierge kill switches — when to flip them and what happens when they're off.

## Kill Switches

| Switch | Env Var | Effect When OFF |
|--------|---------|-----------------|
| Master | `FEATURE_AI_CONCIERGE=false` | All Moltbot reasoning disabled; coded workflows handle all requests |
| Calling | `FEATURE_AI_CONCIERGE_CALLING=false` | No voice calls initiated; chat-only mode |
| OCR | `FEATURE_AI_CONCIERGE_OCR=false` | No document/image processing; user must type requirements manually |

## Default State
**All kill switches default to OFF (false).**

This means:
- Moltbot reasoning is disabled until explicitly enabled
- Calling is disabled until explicitly enabled
- OCR is disabled until explicitly enabled

## When to Flip Switches OFF

### Master Switch (`AI_CONCIERGE`)
Flip OFF immediately if:
- Moltbot produces invalid or unsafe outputs
- High latency or timeout rates
- Unexpected cost spikes
- Any prompt injection detected

### Calling Switch (`AI_CONCIERGE_CALLING`)
Flip OFF immediately if:
- Unsolicited calls reported
- Consent capture failures
- Call quality complaints
- Voice API outages

### OCR Switch (`AI_CONCIERGE_OCR`)
Flip OFF immediately if:
- Medical prescription misreads reported
- High uncertainty rates (>30% of jobs)
- Gemini API outages
- Privacy concerns with document handling

## How to Flip

### Via Environment Variable
```bash
# Disable master switch
export FEATURE_AI_CONCIERGE=false

# Disable calling
export FEATURE_AI_CONCIERGE_CALLING=false

# Disable OCR
export FEATURE_AI_CONCIERGE_OCR=false
```

### Via Database (if using feature_flags table)
```sql
UPDATE feature_flags SET enabled = false WHERE name = 'ai_concierge';
UPDATE feature_flags SET enabled = false WHERE name = 'ai_concierge_calling';
UPDATE feature_flags SET enabled = false WHERE name = 'ai_concierge_ocr';
```

## Fallback Behavior

### When Master is OFF
- WhatsApp transport continues receiving messages
- Orchestrator routes to coded workflow handlers
- Basic keyword matching for routing
- No AI reasoning, ranking, or generation

### When Calling is OFF
- All call-related tools return `{ success: false, reason: 'disabled' }`
- Consent requests still work (for later enablement)
- Chat continues normally

### When OCR is OFF
- Image messages stored but not processed
- System asks user to type requirements manually
- No Gemini/OpenAI vision calls

## Verifying Fallback Works

```typescript
import { isFeatureEnabled, FEATURE_FLAGS } from '@easymo/flags';

// Check switch state
const aiEnabled = isFeatureEnabled(FEATURE_FLAGS.AI_CONCIERGE);
const callingEnabled = isFeatureEnabled(FEATURE_FLAGS.AI_CONCIERGE_CALLING);
const ocrEnabled = isFeatureEnabled(FEATURE_FLAGS.AI_CONCIERGE_OCR);

// Use in code
if (!aiEnabled) {
  return handleWithCodedWorkflow(request);
}
```

## Escalation
If a kill switch is flipped:
1. Log the reason and timestamp
2. Notify admin channel
3. Monitor fallback performance
4. Investigate root cause before re-enabling
