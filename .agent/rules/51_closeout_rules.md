# Shortlist Closeout Rules

## Purpose
Define state transitions and cleanup when shortlist is delivered to the client.

## State Transition Flow

```
awaiting_vendor_replies → shortlist_ready → handed_off
```

## Closeout Sequence

When shortlist is generated and ready to send:

### Step 1: Persist Shortlist
```
UPDATE moltbot_marketplace_requests
SET shortlist = <JSON array of shortlist items>
WHERE id = <request_id>
```

### Step 2: Transition to shortlist_ready
```
UPDATE moltbot_marketplace_requests
SET state = 'shortlist_ready'
WHERE id = <request_id>
```

### Step 3: Send WhatsApp Messages
- Format shortlist into 1-2 WhatsApp messages
- Include wa.me handoff links for each vendor
- Track message delivery

### Step 4: Transition to handed_off
```
UPDATE moltbot_marketplace_requests
SET state = 'handed_off'
WHERE id = <request_id>
```

### Step 5: Cancel Pending Outreach
```
UPDATE moltbot_vendor_outreach
SET state = 'excluded', updated_at = NOW()
WHERE request_id = <request_id>
  AND state IN ('queued', 'sent')
```

## Post-Handoff Behavior

### Vendor Replies After Handoff
- Store incoming replies for analytics
- Do NOT process or add to shortlist
- Do NOT trigger further actions

### Client Messages After Handoff
- If within 5-minute window: allow follow-up questions
- After 5 minutes: treat as new request
- Create new `marketplace_request` if needed

### Scheduler Behavior
- Scheduler must check request state before processing
- Skip requests in `handed_off` or `closed` state
- Log skip reason for auditing

## Idempotency Rules

Closeout operations MUST be idempotent:

1. **State transitions**: Use conditional updates
   ```sql
   UPDATE ... SET state = 'handed_off'
   WHERE id = ? AND state = 'shortlist_ready'
   ```

2. **Outreach cancellation**: Check current state before updating
   ```sql
   UPDATE ... SET state = 'excluded'
   WHERE ... AND state IN ('queued', 'sent')
   ```

3. **Message sending**: Use idempotency keys to prevent duplicates

## Error Handling

If closeout fails at any step:
1. Log error with full context
2. Leave request in current state (do not corrupt)
3. Retry with exponential backoff (max 3 attempts)
4. If all retries fail, notify client with safe fallback message:
   > "I found some options for you, but had trouble sending them. Please try again in a few minutes."

## Audit Requirements

Log the following events:
- `shortlist.generated` — shortlist created with vendor IDs
- `shortlist.sent` — WhatsApp messages sent successfully
- `shortlist.handoff` — state transitioned to handed_off
- `shortlist.outreach_cancelled` — count of cancelled outreach records
