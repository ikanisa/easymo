---
description: "Secure Supabase usage for the concierge system: service-role boundaries, RLS posture, PII redaction, admin-only access patterns, and safe vendor search."
---

# Workflow 15 — Supabase Security

## Goal
Make Supabase safe for automation-heavy WhatsApp concierge:
- Server-side services use service role keys only
- Client apps never receive privileged keys
- Sensitive tables protected
- Auditability preserved without leaking PII

## Outputs
1) Security posture document
2) RLS policies (or explicit server-only decision)
3) PII redaction rules + utilities
4) Admin access pattern
5) Tests for forbidden access

## Step 1 — Decide initial posture
Create `.agent/rules/90_rls_posture.md`:

### Recommended posture:
- Keep RLS enabled globally
- Sensitive tables accessed only by service role (not client apps)
- Dashboard uses server endpoints, not direct table reads

## Step 2 — Classify tables by sensitivity
Create `docs/security/data-classification.md`:

### Highly sensitive (server-only):
- `conversation_messages`
- `ocr_jobs`
- `call_consents`, `call_attempts`
- `audit_events`

### Medium sensitivity (server-only in v1):
- `marketplace_requests`
- `vendor_outreach`

### Low sensitivity (can be public later):
- `vendors` (business name, categories)

## Step 3 — PII redaction utilities
Create `src/security/redact.ts`:

```typescript
function maskPhone(phone: string): string;
function redactRawPayload(payload: object): object;
function safeLog(obj: object): object;
```

Hard rule:
- Logs contain masked phones only
- Full phones only in DB

## Step 4 — RLS policies
Create migration if enabling RLS:

For sensitive tables:
- Enable RLS
- No public access
- Only service role accesses them

For `vendors`:
- Deny all client access for now
- Use backend APIs

## Step 5 — Secure vendor search patterns
Create `.agent/rules/91_secure_vendor_search.md`:

Rules:
- `search_vendors` runs server-side only
- Never return full vendor phone to Moltbot (mask in planning)
- Only final shortlist to client includes vendor phone

## Step 6 — Admin access pattern
Create `docs/security/admin-access.md`:

Recommended:
- Admin dashboard uses backend endpoints
- Admin auth via JWT/SSO
- Admin endpoints enforce role checks

## Step 7 — Tests
1. Direct client access to sensitive tables forbidden
2. Redaction masks phones and strips secrets
3. search_vendors never returns client phone
