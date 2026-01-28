# Secrets Map v1

## Purpose
Centralized documentation of all secrets required for the AI Concierge system.

> [!CAUTION]
> **Never commit actual secrets to version control.**  
> Store in deploy platform secret manager (Cloud Run Secret Manager, Netlify Environment Variables, etc.)

---

## WhatsApp (Meta Business API)

| Secret | Description | Scope |
|--------|-------------|-------|
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token | Backend |
| `WHATSAPP_APP_SECRET` | App secret for signature validation | Backend |
| `WHATSAPP_ACCESS_TOKEN` | Permanent system user token | Backend |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID for sending | Backend |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA ID | Backend |

**Rotation**: Tokens should be rotated annually or on security incident.

---

## Supabase

| Secret | Description | Scope |
|--------|-------------|-------|
| `SUPABASE_URL` | Project API URL | Frontend + Backend |
| `SUPABASE_ANON_KEY` | Public anon key (RLS enforced) | Frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS (dangerous) | Backend only |
| `SUPABASE_JWT_SECRET` | JWT signing secret | Backend |

> [!WARNING]
> `SUPABASE_SERVICE_ROLE_KEY` must **never** be exposed to frontend code.  
> Use only in Edge Functions or server-side code.

---

## Moltbot (AI Brain)

| Secret | Description | Scope |
|--------|-------------|-------|
| `MOLTBOT_BASE_URL` | Moltbot API endpoint | Backend |
| `MOLTBOT_BEARER_TOKEN` | Auth token for Moltbot calls | Backend |

---

## OCR / AI Providers

| Secret | Description | Scope |
|--------|-------------|-------|
| `GEMINI_API_KEY` | Google Gemini API key (primary OCR) | Backend |
| `OPENAI_API_KEY` | OpenAI API key (fallback OCR) | Backend |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID for Gemini | Backend |

---

## Security Tokens

| Secret | Description | Scope |
|--------|-------------|-------|
| `ADMIN_SESSION_SECRET` | Session encryption (≥64 chars) | Backend |
| `EASYMO_ADMIN_TOKEN` | Admin API authentication | Backend |
| `BRIDGE_SHARED_SECRET` | Inter-service auth | Backend |
| `QR_TOKEN_SECRET` | QR code signing | Backend |

---

## Observability

| Secret | Description | Scope |
|--------|-------------|-------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry collector | Backend |
| `ALERT_WEBHOOK_URL` | Alerting destination (Slack/etc) | Backend |

---

## Storage Best Practices

### Development
- Use `.env.local` (gitignored)
- Never commit `.env` files with real values

### Staging / Production
- Use platform secret manager:
  - **Cloud Run**: Secret Manager
  - **Netlify**: Environment Variables (sensitive)
  - **Supabase Edge Functions**: Secrets in Dashboard

### Rotation Policy
| Secret Type | Rotation Frequency |
|-------------|-------------------|
| API Keys | Annually |
| Session Secrets | Quarterly |
| Service Tokens | On incident or annually |

---

## Audit Requirements

1. Log all secret access (not values, just access events)
2. Alert on unusual access patterns
3. Maintain access control list for who can view/modify secrets
