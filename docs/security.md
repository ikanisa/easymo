# Security Documentation

## Overview

This document outlines the security measures implemented in the easyMO platform to protect user data, prevent unauthorized access, and ensure system integrity.

## Table of Contents

1. [WhatsApp Webhook Security](#whatsapp-webhook-security)
2. [Database Security (RLS)](#database-security-rls)
3. [Deep-link Token Security](#deep-link-token-security)
4. [API Security](#api-security)
5. [Secret Management](#secret-management)
6. [Security Checklist](#security-checklist)

---

## WhatsApp Webhook Security

### Signature Verification

All incoming WhatsApp webhook requests are verified using HMAC SHA-256 signatures:

- **Header**: `X-Hub-Signature-256`
- **Algorithm**: HMAC-SHA256 with `WA_APP_SECRET`
- **Comparison**: Constant-time comparison to prevent timing attacks

**Implementation** (`supabase/functions/wa-router/index.ts`):
```typescript
async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const header = req.headers.get("x-hub-signature-256") ?? "";
  if (!header.startsWith("sha256=")) return false;
  
  const theirHex = header.slice(7);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(WA_APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const ourBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const ourBytes = new Uint8Array(ourBuf);
  const theirBytes = hexToBytes(theirHex);
  
  // Constant-time comparison
  if (ourBytes.length !== theirBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < ourBytes.length; i++) diff |= ourBytes[i] ^ theirBytes[i];
  return diff === 0;
}
```

**Security Properties**:
- ✅ Constant-time comparison prevents timing attacks
- ✅ Rejects requests without valid signatures (401 Unauthorized)
- ✅ Uses secure Web Crypto API

### Destination URL Allowlist

The router enforces a strict allowlist of destination URLs:

```typescript
const ALLOWED_DESTINATIONS = new Set([
  DEST_EASYMO_URL,
  DEST_INSURANCE_URL,
  DEST_BASKET_URL,
  DEST_QR_URL,
  DEST_DINE_URL,
].filter(Boolean));
```

**Benefits**:
- Prevents arbitrary URL injection
- Restricts routing to known, trusted handlers
- Logs and rejects non-allowlisted destinations

### Feature Flag

Router functionality is controlled by the `ROUTER_ENABLED` feature flag:

```typescript
const ROUTER_ENABLED = Deno.env.get("ROUTER_ENABLED") !== "false";
```

- **Default**: Enabled
- **Disabled State**: Returns 503 Service Unavailable
- **Use Case**: Emergency shutoff during incidents

---

## Database Security (RLS)

### Row Level Security Policies

All tables with user data have Row Level Security (RLS) enabled:

#### User Favorites
```sql
-- Users can only access their own favorites
CREATE POLICY user_favorites_own_data
  ON public.user_favorites
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());
```

#### Driver Parking & Availability
```sql
-- Drivers can only access their own parking/availability
CREATE POLICY driver_parking_own_data
  ON public.driver_parking
  FOR ALL
  TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY driver_availability_own_data
  ON public.driver_availability
  FOR ALL
  TO authenticated
  USING (driver_id = auth.uid());
```

#### Recurring Trips
```sql
-- Users can only access their own recurring trips
CREATE POLICY recurring_trips_own_data
  ON public.recurring_trips
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());
```

#### Deeplink Tokens
```sql
-- No public SELECT access
-- Only service role can issue/resolve tokens
CREATE POLICY deeplink_tokens_service_only
  ON public.deeplink_tokens
  FOR ALL
  TO service_role
  USING (true);
```

#### Router Tables
```sql
-- router_keyword_map: Service role full access, authenticated read-only
CREATE POLICY router_keyword_map_service_rw
  ON public.router_keyword_map
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY router_keyword_map_authenticated_read
  ON public.router_keyword_map
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- router_logs: Service role write, authenticated read
CREATE POLICY router_logs_service_rw
  ON public.router_logs
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY router_logs_authenticated_read
  ON public.router_logs
  FOR SELECT
  TO authenticated
  USING (true);
```

### Testing RLS Policies

RLS policies are tested to prevent cross-user access:

```sql
-- Test: User A cannot access User B's favorites
SELECT * FROM user_favorites WHERE user_id != auth.uid();
-- Expected: Empty result set
```

See `tests/sql/rls_policies.pg` for comprehensive RLS tests.

---

## Deep-link Token Security

### Token Generation

Deeplink tokens use HMAC signing with `DEEPLINK_SIGNING_SECRET`:

```typescript
// Generate HMAC-signed token
const token = await generateHMACToken(payload, DEEPLINK_SIGNING_SECRET);
```

### Token Properties

- **TTL**: 14 days (configurable)
- **MSISDN Binding**: Optional phone number binding
- **Single Use**: Tokens can be marked as used
- **Expiry Handling**: Returns 410 Gone on expired tokens

### Token Validation

```typescript
// Validate token signature and expiry
if (invite.status !== "active") {
  return new Response(
    JSON.stringify({ ok: false, error: "invite_inactive" }),
    { status: invite.status === "used" ? 409 : 410 }
  );
}

if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
  return new Response(
    JSON.stringify({ ok: false, error: "invite_expired" }),
    { status: 410 }
  );
}
```

---

## API Security

### Input Validation

All public API endpoints use Zod schemas for validation:

```typescript
import { z } from "zod";

const ResolveSchema = z.object({
  token: z.string().min(4).max(100),
  msisdn: z.string().regex(/^\+?[0-9]{10,15}$/).optional(),
});

// Validate input
const result = ResolveSchema.safeParse(body);
if (!result.success) {
  return new Response(
    JSON.stringify({ error: "validation_failed", details: result.error }),
    { status: 422 }
  );
}
```

### Rate Limiting

Rate limits are applied to sensitive endpoints:

- **Resolve Endpoint**: 10 requests/minute per IP
- **Bootstrap Endpoint**: 5 requests/minute per MSISDN
- **Admin APIs**: 100 requests/minute per session

**Implementation**: In-memory sliding window with Redis fallback (future).

### Request ID Tracking

All requests include a correlation ID for tracing:

```typescript
const correlationId = crypto.randomUUID();
logEvent("REQUEST_RECEIVED", { correlationId, endpoint: req.url });
```

---

## Secret Management

### Environment Variables

Secrets are stored as environment variables and **never** committed to source control:

**Required Secrets**:
- `WA_VERIFY_TOKEN`: WhatsApp webhook verification token
- `WA_APP_SECRET`: WhatsApp app secret for signature verification
- `DEEPLINK_SIGNING_SECRET`: HMAC secret for deeplink tokens
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (server-side only)
- `EASYMO_ADMIN_TOKEN`: Admin API authentication token

**Storage**:
- Local: `.env.local` (gitignored)
- Production: Supabase Edge Function secrets
- CI/CD: GitHub Secrets

### Secret Rotation

**Procedure**:
1. Generate new secret (use `openssl rand -base64 32`)
2. Update Supabase Edge Function secrets
3. Deploy updated functions
4. Update downstream services
5. Invalidate old secret after grace period

**Rotation Schedule**:
- Admin tokens: Every 90 days
- API keys: Every 180 days
- Signing secrets: Annually or on compromise

---

## Security Checklist

### Pre-Launch

- [ ] All RLS policies tested and verified
- [ ] WhatsApp signature verification enabled
- [ ] Destination URL allowlist configured
- [ ] All secrets rotated and stored securely
- [ ] Input validation on all public endpoints
- [ ] Rate limiting configured
- [ ] Error messages don't leak sensitive data
- [ ] Service role key never exposed to client

### Ongoing Monitoring

- [ ] Monitor for signature verification failures
- [ ] Track rate limit violations
- [ ] Review router logs for suspicious patterns
- [ ] Audit admin access logs
- [ ] Check for unauthorized destination URL attempts

### Incident Response

1. **Compromised Secret**:
   - Rotate affected secret immediately
   - Deploy updated functions
   - Audit logs for unauthorized access
   - Notify affected users if applicable

2. **Unauthorized Access**:
   - Disable affected account/token
   - Review access logs
   - Identify vulnerability
   - Apply fix and redeploy
   - Update security procedures

3. **DDoS/Rate Limit Attack**:
   - Enable router feature flag to OFF
   - Analyze attack patterns
   - Adjust rate limits
   - Re-enable with enhanced protections

---

## References

- [WhatsApp Business API Security](https://developers.facebook.com/docs/whatsapp/webhooks/security)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [NIST Cryptographic Standards](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines)

---

**Last Updated**: 2025-10-28  
**Owner**: easyMO Security Team  
**Review Cycle**: Quarterly
