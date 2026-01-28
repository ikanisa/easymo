---
description: "Matching and notification caps for web marketplace"
---

# Rule 102 — Web Matching Caps

## Match Suggestion Limits

### Per-Post Caps
- **Maximum suggestions**: 10 per post
- Backend enforces cap before writing to `match_suggestions`
- If Moltbot returns >10, truncate to top 10 by score

### Score Adjustment Bounds
- Moltbot can adjust baseline scores by **±15% maximum**
- Enforced by backend clamp:
  ```typescript
  const clampedScore = Math.max(
    baseline * 0.85,
    Math.min(baseline * 1.15, moltbotScore)
  );
  ```
- Log adjustments that exceed bounds to `audit_events`

### Explainability Requirement
- Every match suggestion MUST have `reasons` array
- Minimum 1 reason per suggestion
- Reason format:
  ```json
  {
    "code": "category_match",
    "description": "Both posts are in electronics category",
    "score_delta": 0.15
  }
  ```

## Notification Caps

### Per-Post Limits
- **Maximum notifications**: 10 per post
- Dedupe by `(post_id, target_id)` uniqueness
- Never send duplicate notifications

### Channel Rules
- **Web**: always allowed
- **WhatsApp**: only if target opted in
- **Email**: only if verified vendor with email

## Discovery Call Budgets

### Per-Post Limits
- **Web search**: max 2 calls per post
- **Maps places**: max 2 calls per post
- **Social profiles**: max 2 calls per post

### Budget Enforcement
- Track calls in `audit_events` with type `discovery.call`
- Block further calls if budget exceeded
- Log blocked calls for monitoring

## Audit Requirements
- Log all cap enforcements
- Log all score clamps
- Log all budget exhaustions
- Include `reason: "cap_enforced"` in audit payload
