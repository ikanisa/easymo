# RLS Posture — Moltbot Concierge System

## Purpose
Define the Row-Level Security posture for all Moltbot-related tables.

## Global Posture
- **RLS enabled globally** on all moltbot tables
- **Service role only** access pattern for sensitive tables
- No direct client (anon/authenticated) access to moltbot backend tables

## Table Access Matrix

| Table | RLS Enabled | Client Access | Service Role |
|-------|-------------|---------------|--------------|
| `moltbot_conversations` | ✅ | ❌ Denied | ✅ Full |
| `moltbot_conversation_messages` | ✅ | ❌ Denied | ✅ Full |
| `moltbot_marketplace_requests` | ✅ | ❌ Denied | ✅ Full |
| `moltbot_ocr_jobs` | ✅ | ❌ Denied | ✅ Full |
| `moltbot_vendor_outreach` | ✅ | ❌ Denied | ✅ Full |
| `moltbot_call_consents` | ✅ | ❌ Denied | ✅ Full |
| `moltbot_call_attempts` | ✅ | ❌ Denied | ✅ Full |
| `moltbot_audit_events` | ✅ | ❌ Denied | ✅ Full |

## Enforcement

### DO:
- Always use `SUPABASE_SERVICE_ROLE_KEY` for backend operations
- Keep service role key in server-side code only
- Audit all database writes via `moltbot_audit_events`

### DON'T:
- Never expose service role key to frontend/client code
- Never create anon/authenticated policies on moltbot tables
- Never bypass RLS with `force: true` outside migrations

## Dashboard Access
- Admin dashboards access data via **server endpoints**, not direct table queries
- Server endpoints validate admin role before returning sensitive data
- Dashboard never receives raw PII; always masked/redacted

## Future Considerations
- If client-side read access is ever needed (e.g., order status), create separate **view tables** with explicit RLS policies
- Never retroactively relax RLS on existing moltbot tables
