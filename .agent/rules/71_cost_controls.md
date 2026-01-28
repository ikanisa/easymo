# AI Cost Controls

## Purpose
Prevent runaway AI costs and ensure predictable response times.

## Token Budgets (Per Request)

### Moltbot Calls
- **Maximum**: 8 calls per request
- **Typical**: 2-4 calls
- **Exceed action**: Stop AI, send fallback message

### OCR Calls
- **Maximum**: 2 calls per request
- **Typical**: 1 call (one image)
- **Exceed action**: Queue for human review

### Vendor Outreach
- **Maximum batches**: 3
- **Maximum vendors**: 15 (across all batches)
- **Batch size**: 5 vendors per batch
- **Exceed action**: Stop outreach, use top responders

## Time Budgets

### Target Time-to-Shortlist
- **Target**: ≤ 6 minutes
- **Warning**: > 4 minutes (log warning)
- **Critical**: > 6 minutes (send progress update to client)

### Maximum Processing Time
- **Hard limit**: 10 minutes
- **Exceed action**: 
  1. Send apology message to client
  2. Offer handoff options (call, email)
  3. Mark request as `error` with `timeout` reason

## Budget Enforcement

### Check Points
1. Before every Moltbot call → `checkMoltbotBudget()`
2. Before every OCR job → `checkOcrBudget()`
3. Before every vendor batch → `checkVendorOutreachBudget()`
4. Every 60 seconds during processing → `checkTimeToShortlistBudget()`

### Budget Exceeded Response

```typescript
type BudgetExceededAction = 
  | { action: 'fallback'; message: string }
  | { action: 'handoff'; options: string[] }
  | { action: 'queue_human'; reason: string };
```

## Fallback Messages

### Moltbot Budget Exceeded
```
We're having trouble processing your request automatically. 
A team member will review it shortly. 
Alternatively, you can call us directly: [support_number]
```

### OCR Budget Exceeded
```
We couldn't fully process the images you sent. 
Please try sending a clearer photo, or describe what you need in text.
```

### Time Budget Exceeded
```
Your request is taking longer than expected. 
We'll continue working on it, but here are some quick options:
1. Call our hotline: [support_number]
2. We'll send you updates as vendors respond
```

## Budget Event Types

Log these events:
- `moltbot.budget_check` — every check
- `moltbot.budget_exceeded` — when limit hit
- `ocr.budget_exceeded`
- `vendor.batch_limit_reached`
- `request.time_budget_warning`
- `request.time_budget_exceeded`

## Cost Monitoring

### Daily Alerts
- Total Moltbot calls > 1000 → review
- Average calls per request > 4 → investigate
- OCR failure rate > 10% → check image quality patterns

### Monthly Review
- Review top 10% most expensive requests
- Identify optimization opportunities
- Adjust budgets if needed
