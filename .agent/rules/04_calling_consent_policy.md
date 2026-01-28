# Calling Consent Policy

## Purpose
Ensure voice calls are never unsolicited and always have explicit consent.

## Core Principle
**Default to chat. Calling is escalation, not primary.**

## Allowed Call Targets

### Vendor Calls
Purpose: Quickly confirm availability/price when chat is slow or unclear.

### Client Calls
Purpose: Clarify complex requirements or handle urgent requests.

## Allowed Triggers

### Vendor Call Triggers (at least one must be true)
1. `urgency=true` AND no vendor reply within 3 minutes
2. Vendor reply is ambiguous AND client is waiting (confidence < 0.6)
3. High-value/high-risk item where misunderstanding is likely

### Client Call Triggers (at least one must be true)
1. Client explicitly asked: "call me"
2. Client previously opted in for calls AND request needs rapid clarification
3. OCR uncertainty on critical fields AND client prefers call (captured consent)

## Consent Requirements

### Consent Record Must Include:
- `request_id`
- `phone`
- `status`: `requested` | `granted` | `denied` | `expired`
- `scope`: `call_vendor` | `call_client` | `either`
- `expires_at`: default 24 hours from grant

### Consent Must Be:
- **Explicit**: User replies YES or taps approval button
- **Scoped**: Tied to specific request and call type
- **Time-bounded**: Expires after defined period

## Hard "NO CALL" Rules
- No consent in DB → **never call**
- Consent status = `denied` or `expired` → **never call**
- Request state = `handed_off` → **never call**
- `CALLING_ENABLED=false` → **never call**

## Medical/Prescription Calls
- Never "diagnose" over the phone
- Calls only to clarify illegible prescription text
- Only if client explicitly consented

## Fallback on Failure
If call fails or is declined:
- Send chat message: "Call didn't go through. I'll continue via chat."
- Continue with normal workflow

## Cooldown
- Max 1 call attempt per 10 minutes per request
- Prevents repeated call attempts

## Escalation
If calling logic causes confusion or complaints:
1. Disable `CALLING_ENABLED` immediately
2. Review consent captures for that request
3. Document and improve triggers
