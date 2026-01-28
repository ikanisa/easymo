---
description: "Anonymous web security posture: auth, rate limits, RLS, captcha recommendation"
---

# Rule 100 — Anonymous Web Security

## Anonymous Sign-In Posture

### Authentication
- Use Supabase Anonymous Sign-Ins for web sessions
- No email/phone required
- On first load: `signInAnonymously()` creates session
- Store `anon_user_id` in `web_sessions` table

### Rate Limiting
- Per IP: max 50 requests/minute
- Per session: max 20 posts/hour
- Burst protection: block if >10 requests in 5 seconds
- Log rate limit violations to `audit_events`

### Captcha Recommendation
- Enable captcha for anonymous sign-ins to reduce abuse
- Implement at sign-in or first post action
- Use turnstile or similar lightweight captcha

### RLS Enforcement
- Anonymous user can only CRUD their own rows
- Never allow cross-session reads for drafts
- Public reads limited to:
  - `status='published'` listings
  - Sanitized fields only (no session_id exposure)
  - Verified vendor information

## Enforcement Rules

### Blocked Operations
- Direct `vendor_id` updates by anonymous users → server-only
- Cross-session post edits → RLS blocks
- Bulk data exports → rate limited

### Audit Requirements
- Log every anonymous session creation
- Log every post status change
- Log rate limit violations
- Log moderation actions

## Related Rules
- `101_web_listings_verification.md` — verified vendor distinction
- `102_web_matching_caps.md` — suggestion limits
