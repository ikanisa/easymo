# EasyMO WhatsApp Webhook Microservices - Environment Variables

## Required Variables (All Services)

| Variable                    | Required | Description                           | Example                   |
| --------------------------- | -------- | ------------------------------------- | ------------------------- |
| `SUPABASE_URL`              | ✅ Yes   | Supabase project URL                  | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes   | Service role key for DB access        | `eyJ...`                  |
| `WA_VERIFY_TOKEN`           | ✅ Yes   | WhatsApp webhook verification token   | `my-secret-token`         |
| `WHATSAPP_APP_SECRET`       | ✅ Yes   | App secret for signature verification | `abc123...`               |

## Alternative Variable Names (Fallbacks)

| Primary                     | Fallback(s)                                        |
| --------------------------- | -------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY`, `WA_SUPABASE_SERVICE_ROLE_KEY` |
| `WHATSAPP_APP_SECRET`       | `WA_APP_SECRET`                                    |
| `SUPABASE_URL`              | `SERVICE_URL`                                      |

## Security Configuration

| Variable                     | Default | Description                       |
| ---------------------------- | ------- | --------------------------------- |
| `WA_ALLOW_UNSIGNED_WEBHOOKS` | `false` | **MUST be false in production**   |
| `WA_ALLOW_INTERNAL_FORWARD`  | `false` | Allow internal service forwarding |

## Service-Specific Variables

### wa-webhook-core

| Variable                    | Default | Description                   |
| --------------------------- | ------- | ----------------------------- |
| `WA_CORE_COLD_START_SLO_MS` | `1750`  | Cold start SLO threshold      |
| `WA_CORE_P95_SLO_MS`        | `1200`  | P95 latency SLO threshold     |
| `WA_ROUTER_TIMEOUT_MS`      | `4000`  | Router timeout for forwarding |

### wa-webhook-mobility

| Variable                  | Default | Description                     |
| ------------------------- | ------- | ------------------------------- |
| `WA_PHONE_ID`             | -       | WhatsApp phone number ID        |
| `WA_TOKEN`                | -       | WhatsApp access token           |
| `WA_BOT_NUMBER_E164`      | -       | Bot phone number in E164 format |
| `ENABLE_RATE_LIMITING`    | `true`  | Enable/disable rate limiting    |
| `RATE_LIMIT_WINDOW_MS`    | `60000` | Rate limit window (1 min)       |
| `RATE_LIMIT_MAX_REQUESTS` | `100`   | Max requests per window         |

### wa-webhook-insurance

| Variable                 | Default | Description                  |
| ------------------------ | ------- | ---------------------------- |
| `INSURANCE_INLINE_OCR`   | `true`  | Enable inline OCR processing |
| `INSURANCE_QUEUE_MIRROR` | `true`  | Mirror to processing queue   |

## Production Checklist

- [ ] `WA_ALLOW_UNSIGNED_WEBHOOKS` = `false`
- [ ] `WA_ALLOW_INTERNAL_FORWARD` = `false` (unless needed)
- [ ] All required variables set
- [ ] Secrets stored securely (not in code)
- [ ] Different values for staging vs production

## Validation

Use the env-validator module to check configuration at startup:

```typescript
import { assertEnvironmentValid } from "../_shared/env-validator.ts";

// At service startup
assertEnvironmentValid("wa-webhook-core");
```

## Troubleshooting

### Missing Variable Errors

If you see: `Missing required: SUPABASE_URL`

- Check that environment variables are set in Supabase dashboard
- For local development, create `.env` file in function directory

### Security Errors

If you see: `SECURITY ERROR: WA_ALLOW_UNSIGNED_WEBHOOKS cannot be true in production`

- This is intentional - unsigned webhooks are a security risk
- Only enable for local testing, never in production

### Fallback Variables

The system checks multiple variable names for compatibility:

- If `SUPABASE_URL` not found, tries `SERVICE_URL`
- If `WHATSAPP_APP_SECRET` not found, tries `WA_APP_SECRET`
- Use primary names for new deployments
