---
description: "PHASE H — Moderation + Abuse Controls (anonymous web)."
---

# PHASE H — Moderation

## H1 — Moderation events + rate limits + block rules

Add:
- moderation_events table
- posting limits per session/IP (max posts per hour)
- moderate_or_block action path
- optional captcha enforcement notes

Triggers for moderation:
- spam bursts (>5 posts/hour)
- prohibited categories (weapons, drugs, etc.)
- harassment keywords

Actions:
- moderate: flag for review
- block: temporarily block posting for session
- escalate: notify admin

**Acceptance**:
- spam scenario blocked and logged
- moderation_events written
- blocked session cannot post

**Rollback**:
- disable enforcement; keep logging
