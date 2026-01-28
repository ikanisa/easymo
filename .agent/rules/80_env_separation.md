# Environment Separation Rule

## Purpose
Define strict environment separation to prevent cross-environment contamination and ensure safe rollouts.

## Environments

| Environment | Purpose | Risk Level |
|-------------|---------|------------|
| `development` | Local development + unit tests | Low |
| `staging` | Integration testing + UAT | Medium |
| `production` | Live users + real data | High |

## Isolation Requirements

### 1. WhatsApp Credentials
Each environment MUST have its own:
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`

> [!CAUTION]
> **Never point dev/staging to production WhatsApp phone numbers.**  
> Using production WhatsApp in non-production environments risks sending test messages to real users.

### 2. Supabase
Each environment MUST have:

| Option | Description |
|--------|-------------|
| Separate projects | Different `SUPABASE_URL` per env (recommended) |
| Schema separation | Same project, different schemas (e.g., `dev.*`, `staging.*`, `public.*`) |

Credentials per environment:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

### 3. Moltbot / AI Endpoints
Each environment MUST have:
- `MOLTBOT_BASE_URL` pointing to env-specific endpoint
- `MOLTBOT_BEARER_TOKEN` scoped to that environment

### 4. Feature Flags
All AI features default OFF in all environments:
```
FEATURE_AI_CONCIERGE=false
FEATURE_AI_CONCIERGE_CALLING=false
FEATURE_AI_CONCIERGE_OCR=false
```

Enable only after explicit approval per environment.

## Environment Detection

```typescript
const ENV = process.env.NODE_ENV || 'development';

function isProduction(): boolean {
  return ENV === 'production';
}

function isStaging(): boolean {
  return ENV === 'staging';
}

function isDevelopment(): boolean {
  return ENV === 'development' || ENV === 'test';
}
```

## Deployment Mapping

| Environment | Deploy Target | Branch |
|-------------|---------------|--------|
| development | Local / Preview | feature/* |
| staging | Staging Cloud Run / Netlify Preview | develop |
| production | Production Cloud Run / Netlify Main | main |

## Verification Checklist

Before deploying to any environment:
- [ ] Confirm WhatsApp phone number matches environment
- [ ] Confirm Supabase URL matches environment
- [ ] Confirm feature flags are at expected state
- [ ] Confirm logging points to correct observability stack
