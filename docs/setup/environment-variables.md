# Environment Variables

Use `.env` for local development. Keep secrets server-side.

## Public vs Server-only
- Public variables must use `NEXT_PUBLIC_*` (Next.js) or `VITE_*` (Vite).
- Server-only variables must never use public prefixes.

## Minimal Local Set (Admin App + Edge Functions)

Public:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_ENVIRONMENT_LABEL (optional)

Server-only:
- SUPABASE_SERVICE_ROLE_KEY
- EASYMO_ADMIN_TOKEN
- ADMIN_SESSION_SECRET

WhatsApp webhooks:
- WA_VERIFY_TOKEN
- WHATSAPP_APP_SECRET
- WA_PHONE_ID
- WA_TOKEN (or WHATSAPP_ACCESS_TOKEN)

## Security Flags
- WA_ALLOW_UNSIGNED_WEBHOOKS=false (must be false in production)
- WA_ALLOW_INTERNAL_FORWARD=false (only enable if explicitly needed)

## Legacy Fallbacks (for older services)
- SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY, WA_SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_URL: SERVICE_URL
- WHATSAPP_APP_SECRET: WA_APP_SECRET

## Validation

```bash
# Basic env checks
pnpm env:check

# Full validation (aliases env:check)
pnpm env:validate
```

The build also runs guard scripts (for example, blocking server secrets in public vars).

## Profiles (deploy-only checks)

`pnpm env:check` supports profiles to enforce additional requirements:

```bash
# Core checks (default)
EASYMO_ENV_PROFILE=core pnpm env:check

# Add admin + WhatsApp + AI checks
EASYMO_ENV_PROFILE=admin,whatsapp,ai pnpm env:check
```
