# Environment Variables Reference

This document provides a comprehensive guide to all environment variables used in the EasyMO platform, including their purpose, required values, and security considerations.

## Table of Contents

- [Overview](#overview)
- [Variable Categories](#variable-categories)
- [Server-Side vs Public Variables](#server-side-vs-public-variables)
- [Core Configuration](#core-configuration)
- [Supabase Configuration](#supabase-configuration)
- [Authentication & Security](#authentication--security)
- [WhatsApp Integration](#whatsapp-integration)
- [AI & OpenAI Services](#ai--openai-services)
- [Database Configuration](#database-configuration)
- [Feature Flags](#feature-flags)
- [Observability & Monitoring](#observability--monitoring)
- [Service-Specific Variables](#service-specific-variables)
- [Best Practices](#best-practices)

---

## Overview

EasyMO uses environment variables for configuration management across different environments (development, staging, production). Variables are stored in:

- **`.env`**: Shared defaults for local development (committed to repo with placeholders)
- **`.env.local`**: Local overrides (gitignored, not committed)
- **`.env.example`**: Template with all variables documented (committed to repo)
- **GitHub Secrets**: Production secrets for CI/CD
- **Supabase Project Settings**: Edge function secrets

**Security Rules:**
- ✅ **NEVER** commit actual secrets to version control
- ✅ **ALWAYS** use placeholder values (e.g., `CHANGEME_*`) in `.env.example`
- ✅ **NEVER** expose server-side secrets with `NEXT_PUBLIC_` or `VITE_` prefixes
- ✅ **ALWAYS** validate secrets are not in client bundles using prebuild checks

---

## Variable Categories

| Category | Prefix | Purpose | Security Level |
|----------|--------|---------|----------------|
| Public Client | `NEXT_PUBLIC_`, `VITE_` | Browser-accessible values | Public |
| Server-Only | No prefix or service-specific | Backend secrets | Private |
| Supabase | `SUPABASE_` | Database and auth | Private (except anon key) |
| Admin | `ADMIN_`, `EASYMO_ADMIN_` | Admin API access | Private |
| WhatsApp | `WA_`, `WHATSAPP_` | Meta/WhatsApp integration | Private |
| Feature Flags | `FEATURE_` | Toggle features on/off | Public (numeric) |
| OpenAI | `OPENAI_` | AI services | Private |

---

## Server-Side vs Public Variables

### Server-Side Only (NEVER use NEXT_PUBLIC_ or VITE_ prefix)

These variables contain **sensitive data** and must **NEVER** be exposed to the client:

```bash
# ✅ CORRECT - Server-side only
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
ADMIN_TOKEN=secret-admin-token
WA_APP_SECRET=your-whatsapp-secret
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
MOMO_API_KEY=...
BRIDGE_SHARED_SECRET=...
```

**Where to use:**
- Supabase Edge Functions
- Node.js services (NestJS, Express)
- API routes
- Server-side rendering
- Build-time scripts

---

### Public Variables (Safe to expose with NEXT_PUBLIC_ or VITE_ prefix)

These variables are **non-sensitive** and safe to include in client bundles:

```bash
# ✅ CORRECT - Public configuration
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...  # Anon key is designed to be public
NEXT_PUBLIC_ENVIRONMENT_LABEL=Production
NEXT_PUBLIC_APP_URL=https://admin.easymo.example
VITE_ENABLE_AGENT_CHAT=false
```

**Where to use:**
- React components
- Client-side API calls
- Browser configurations
- UI feature toggles

---

### ❌ NEVER DO THIS

```bash
# ❌ WRONG - Exposing secrets with public prefix
NEXT_PUBLIC_SERVICE_ROLE_KEY=eyJhbGc...  # Security violation!
VITE_ADMIN_TOKEN=secret  # Security violation!
NEXT_PUBLIC_DATABASE_URL=postgresql://...  # Security violation!
```

**Prebuild checks will fail** if you attempt to expose secrets this way.

---

## Core Configuration

### Application Settings

```bash
# Environment label (development, staging, production)
APP_ENV=development
IN_PRODUCTION=false

# Server port for local development
PORT=8080

# Node.js memory limit
NODE_OPTIONS=--max_old_space_size=4096

# Base URLs
ADMIN_BASE_URL=https://admin.easymo.example
DEEPLINK_BASE_URL=https://links.easymo.example
```

---

## Supabase Configuration

### Public Configuration (Client-Side)

```bash
# Supabase project details (non-sensitive)
VITE_SUPABASE_PROJECT_ID=vacltfdslodqybxojytc
VITE_SUPABASE_URL=https://vacltfdslodqybxojytc.supabase.co
VITE_API_BASE=${VITE_SUPABASE_URL}/functions/v1

# Public anon key (designed to be exposed)
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SUPABASE_URL=${VITE_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
```

**Note:** The Supabase anon key is **intentionally public**. It's designed to be used client-side and protected by Row Level Security (RLS) policies.

---

### Private Configuration (Server-Side Only)

```bash
# ⚠️ NEVER expose these with NEXT_PUBLIC_ or VITE_ prefix
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=${VITE_SUPABASE_URL}
SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}

# Database connection string (server-side only)
SUPABASE_DB_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres

# JWT secret for token verification
SUPABASE_JWT_SECRET=your-jwt-secret
```

**Usage:**
- Edge functions
- Admin operations that bypass RLS
- Database migrations
- Server-side database queries

---

## Authentication & Security

### Admin Access

```bash
# Admin API token (server-side only)
EASYMO_ADMIN_TOKEN=your-admin-token
ADMIN_TOKEN=${EASYMO_ADMIN_TOKEN}
VITE_ADMIN_TOKEN=${EASYMO_ADMIN_TOKEN}  # Used for server-side calls only

# Session management
ADMIN_SESSION_SECRET=at-least-16-characters-long
ADMIN_SESSION_SECRET_FALLBACK=fallback-secret-for-rotation
ADMIN_SESSION_COOKIE_NAME=admin_session
ADMIN_SESSION_MAX_AGE_DAYS=30
ADMIN_SESSION_TTL_SECONDS=43200

# Admin access credentials (JSON array)
ADMIN_ACCESS_CREDENTIALS='[{"actorId":"00000000-0000-0000-0000-000000000001","email":"info@ikanisa.com","password":"MoMo!!0099","username":"Admin"}]'

# Admin actor IDs
ADMIN_ALLOW_ANY_ACTOR=false
ADMIN_DEFAULT_ACTOR_ID=00000000-0000-0000-0000-000000000001
NEXT_PUBLIC_DEFAULT_ACTOR_ID=${ADMIN_DEFAULT_ACTOR_ID}
```

---

### Secrets & Tokens

```bash
# Various security secrets (all server-side only)
BRIDGE_SHARED_SECRET=secret-for-voice-bridge
QR_TOKEN_SECRET=secret-for-qr-codes
QR_SALT=salt-for-qr-generation
DEEPLINK_SIGNING_SECRET=secret-for-deeplink-signing

# QR token settings
QR_TOKEN_TTL_SECONDS=172800  # 48 hours

# CORS configuration
CORS_ALLOWED_ORIGINS=https://admin.easymo.example
DEEPLINK_ALLOWED_ORIGINS=https://admin.easymo.example
```

---

## WhatsApp Integration

### Meta/WhatsApp API Configuration

```bash
# ⚠️ All WhatsApp credentials are server-side only
WA_PHONE_ID=your-phone-number-id
WA_TOKEN=your-access-token
WA_APP_SECRET=your-app-secret
WA_VERIFY_TOKEN=your-verify-token
WA_BOT_NUMBER_E164=+2507XXXXXXX

# Business account
META_WABA_BUSINESS_ID=your-business-id

# API configuration
WHATSAPP_API_URL=https://graph.facebook.com/v20.0
WHATSAPP_API_BASE_URL=${WHATSAPP_API_URL}
WHATSAPP_API_TOKEN=your-access-token
WHATSAPP_ACCESS_TOKEN=${WHATSAPP_API_TOKEN}
WHATSAPP_PHONE_NUMBER_ID=${WA_PHONE_ID}

# Send endpoint
WHATSAPP_SEND_ENDPOINT=https://your-sender-endpoint
WHATSAPP_SEND_TIMEOUT_MS=10000
WHATSAPP_SEND_RETRIES=2
```

---

### WhatsApp Service Configuration

```bash
# Webhook settings
WA_WEBHOOK_MAX_BYTES=262144
WA_HTTP_TIMEOUT_MS=10000
WA_HTTP_MAX_RETRIES=1
WA_HTTP_RETRY_DELAY_MS=200
WA_HTTP_STATUS_RETRIES=2
WA_HTTP_STATUS_RETRY_DELAY_MS=400

# Logging and debugging
WA_INBOUND_LOG_SAMPLE_RATE=0.05
WA_INBOUND_DEBUG_SNAPSHOT=false
WA_INBOUND_SNAPSHOT_LIMIT_BYTES=500000

# Data retention
WA_EVENTS_TTL_DAYS=30
WA_WEBHOOK_LOGS_TTL_DAYS=14
WA_RETENTION_INTERVAL_MS=21600000

# Allowed MSISDN prefixes (comma-separated, optional)
WA_ALLOWED_MSISDN_PREFIXES=

# Template configuration
WHATSAPP_TEMPLATE_DEFAULT_LANGUAGE=en
WHATSAPP_SYSTEM_USER_ID=
WHATSAPP_TEMPLATE_NAMESPACE=
```

---

### WhatsApp Public Configuration

```bash
# Public endpoints (can be exposed if needed)
NEXT_PUBLIC_WHATSAPP_SEND_ENDPOINT=${WHATSAPP_SEND_ENDPOINT}
NEXT_PUBLIC_WHATSAPP_SEND_API=${WHATSAPP_SEND_ENDPOINT}
```

---

## AI & OpenAI Services

### OpenAI Configuration

```bash
# ⚠️ API keys are server-side only
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_AGENT_ID=optional-agent-id

# Realtime API (for voice)
OPENAI_REALTIME_URL=wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview
OPENAI_REALTIME_API_KEY=${OPENAI_API_KEY}

# Models
OPENAI_VISION_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
```

---

### OCR Configuration

```bash
# OCR processing
OCR_MAX_ATTEMPTS=3
OCR_MAX_MENU_CATEGORIES=50
OCR_MAX_MENU_ITEMS=500
OCR_QUEUE_SCAN_LIMIT=5

# Storage bucket for OCR results
OCR_RESULT_BUCKET=ocr-json-cache

# Insurance OCR webhooks (server-side only)
INSURANCE_OCR_METRICS_WEBHOOK_URL=https://your-webhook
INSURANCE_OCR_METRICS_TOKEN=your-token
```

---

### Web Search Configuration

```bash
# Web search provider: 'bing' or 'serpapi'
SEARCH_API_PROVIDER=bing

# ⚠️ API keys are server-side only
SEARCH_API_KEY=your-unified-key
BING_SEARCH_API_KEY=your-bing-key
SERPAPI_KEY=your-serpapi-key
```

---

### Google Drive Integration

```bash
# ⚠️ Server-side only
GOOGLE_DRIVE_API_KEY=your-api-key
GOOGLE_DRIVE_SA_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_DRIVE_SA_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

---

## Database Configuration

### Agent-Core Database

```bash
# ⚠️ Server-side only
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agent_core
```

**Usage:**
- Prisma migrations
- Service connections
- Local development

---

### Redis Configuration

```bash
# ⚠️ Server-side only
REDIS_URL=redis://localhost:6379
```

**Usage:**
- Session storage
- Rate limiting
- Caching
- Pub/sub messaging

---

### Kafka Configuration

```bash
# ⚠️ Server-side only
KAFKA_BROKERS=localhost:29092
KAFKA_CLIENT_ID=service-name
```

**Service-specific topics:**
```bash
# Voice-Bridge
CONTACT_TOPIC=voice.contact.events
MEDIA_TOPIC=voice.media.events

# WhatsApp Bot
INBOUND_TOPIC=whatsapp.inbound
OUTBOUND_TOPIC=whatsapp.outbound

# Broker Orchestrator
WHATSAPP_TOPIC=whatsapp.inbound
VOICE_CONTACT_TOPIC=voice.contact.events
SIP_TOPIC=voice.sip.events
BROKER_OUTBOUND_TOPIC=broker.outbound
RETRY_TOPIC=broker.retry
```

---

## Feature Flags

Feature flags control feature availability and default to **OFF** in production.

### Format

```bash
# Binary flags (0 = off, 1 = on)
FEATURE_<MODULE>_<CAPABILITY>=0

# Boolean flags
<MODULE>_<CAPABILITY>_ENABLED=false
```

### Agent Features

```bash
# Agent chat capability
FEATURE_AGENT_CHAT=0
ENABLE_AGENT_CHAT=false
VITE_ENABLE_AGENT_CHAT=false

# Payment collection
FEATURE_AGENT_COLLECTPAYMENT=0

# Warm transfer
FEATURE_AGENT_WARMTRANSFER=0
```

---

### Marketplace Features

```bash
# Marketplace services
FEATURE_MARKETPLACE_RANKING=0
FEATURE_MARKETPLACE_VENDOR=0
FEATURE_MARKETPLACE_BUYER=0
FEATURE_WALLET_SERVICE=0

# Dual constraint matching
DUAL_CONSTRAINT_MATCHING_ENABLED=false
FEATURE_FLAG_DUALCONSTRAINTMATCHING_ENABLED=0
NEXT_PUBLIC_DUAL_CONSTRAINT_MATCHING_ENABLED=false

# Basket confirmation
BASKET_CONFIRMATION_ENABLED=false
FEATURE_FLAG_BASKET_CONFIRMATION_ENABLED=0
NEXT_PUBLIC_BASKET_CONFIRMATION_ENABLED=false
```

---

### Assistant Features

```bash
# Assistant toggle
NEXT_PUBLIC_ASSISTANT_ENABLED=false
```

---

## Observability & Monitoring

### Logging

```bash
# Log level (debug, info, warn, error)
LOG_LEVEL=info

# Log drains (server-side only)
LOG_DRAIN_URL=https://your-log-drain
METRICS_DRAIN_URL=https://your-metrics-drain
```

---

### Sentry Error Tracking

```bash
# Sentry DSN (can be public)
SENTRY_DSN=https://public@sentry.example/1
SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_DSN=${SENTRY_DSN}
```

**Note:** Sentry DSN can be public as it's designed for client-side error reporting.

---

### Health Checks

```bash
# Health check endpoints
HEALTH_URL=${VITE_API_BASE}/admin-health

# GitHub synthetic checks (repository secrets)
ADMIN_BASE_URL_CHECK=https://admin.easymo.example
ADMIN_API_TOKEN_CHECK=${EASYMO_ADMIN_TOKEN}
SUPABASE_API_BASE_CHECK=${SUPABASE_API_BASE}
```

---

### Alert Webhooks

```bash
# ⚠️ Server-side only
ALERT_WEBHOOK_URL=https://your-alert-webhook
ALERT_WEBHOOK_TIMEOUT_MS=5000
```

---

## Service-Specific Variables

### Agent-Core Service

```bash
PORT=3002
LOG_LEVEL=info
AGENT_CORE_AUTH_TOKEN=internal-token
AGENT_CORE_RATE_MAX=60
AGENT_CORE_RATE_WINDOW_MS=60000
AGENT_CORE_URL=http://localhost:4000
AGENT_CORE_INTERNAL_TOKEN=internal-admin-token
AGENT_INTERNAL_TENANT_ID=a4a8cf2d-0a4f-446c-8bf2-28509641158f
```

---

### Voice-Bridge Service

```bash
PORT=4100
LOG_LEVEL=info
VOICE_BRIDGE_API_URL=http://localhost:4100
TWILIO_MEDIA_AUTH_TOKEN=your-twilio-token
COMPLIANCE_PROMPT=This call may be monitored for quality.
OPT_OUT_PATTERN=\b(STOP|END|CANCEL|QUIT)\b
```

---

### Wallet Service

```bash
PORT=4400
LOG_LEVEL=info
WALLET_SERVICE_URL=http://localhost:4400
WALLET_API_KEY=your-wallet-api-key
DEFAULT_TENANT_ID=${AGENT_INTERNAL_TENANT_ID}
COMMISSION_ACCOUNT_ID=c6e2c9b9-0b32-46e8-90d6-1b3edc1820f8
PLATFORM_ACCOUNT_ID=5c8c42d7-9b5a-4f2a-a730-1b15219a0b3b
```

---

### Ranking Service

```bash
PORT=4500
LOG_LEVEL=info
MARKETPLACE_RANKING_URL=http://localhost:4500
DEFAULT_TENANT_ID=${AGENT_INTERNAL_TENANT_ID}
EASYMO_ADMIN_API_BASE=${VITE_API_BASE}
```

---

### Vendor Service

```bash
PORT=4600
LOG_LEVEL=info
MARKETPLACE_VENDOR_URL=http://localhost:4600
DEFAULT_TENANT_ID=${AGENT_INTERNAL_TENANT_ID}
```

---

### Buyer Service

```bash
PORT=4700
LOG_LEVEL=info
MARKETPLACE_BUYER_URL=http://localhost:4700
DEFAULT_TENANT_ID=${AGENT_INTERNAL_TENANT_ID}
```

---

### SIP Ingress

```bash
PORT=4200
LOG_LEVEL=info
EVENT_TOPIC=voice.sip.events
SIGNATURE_SECRET=your-sip-signature-secret
```

---

### Broker Orchestrator

```bash
LOG_LEVEL=info
```

---

### WhatsApp Bot Service

```bash
PORT=4300
LOG_LEVEL=info
META_VERIFY_TOKEN=your-verify-token
META_PAGE_TOKEN=your-page-token
OPT_OUT_PATTERN=\bSTOP\b
```

---

## Storage & Buckets

```bash
# Storage bucket names (public configuration)
MENU_MEDIA_BUCKET=menu-source-files
KYC_STORAGE_BUCKET=kyc-documents
INSURANCE_MEDIA_BUCKET=insurance-docs
AGENT_DOCS_BUCKET=agent-docs
VOUCHERS_BUCKET=vouchers
DEEPLINKS_PUBLIC_BUCKET=deeplinks-public

# Import limits
AGENT_DOCS_IMPORT_MAX_PER_HOUR=500
AGENT_DOCS_IMPORT_MAX_PER_REQUEST=50
AGENT_DOCS_IMPORT_MAX_PER_DAY=2000

# Signed URL TTL
KYC_SIGNED_URL_TTL_SECONDS=604800  # 7 days

# Public storage endpoints (can be exposed)
NEXT_PUBLIC_VOUCHER_PREVIEW_ENDPOINT=
NEXT_PUBLIC_STORAGE_HEALTHCHECK_BUCKET=
```

---

## Notification & Reminders

### Cart Reminders

```bash
CART_REMINDER_CRON_ENABLED=true
CART_REMINDER_CRON=*/10 * * * *
CART_REMINDER_MINUTES=20
CART_REMINDER_LANGUAGE=en
CART_REMINDER_BATCH_SIZE=25
```

---

### Order Pending Reminders

```bash
ORDER_PENDING_REMINDER_CRON_ENABLED=true
ORDER_PENDING_REMINDER_CRON=*/5 * * * *
ORDER_PENDING_REMINDER_MINUTES=15
ORDER_PENDING_REMINDER_LANGUAGE=en
ORDER_PENDING_REMINDER_BATCH_SIZE=25
```

---

### Basket Reminders

```bash
BASKETS_REMINDER_CRON_ENABLED=false
BASKETS_REMINDER_BATCH_SIZE=20
BASKETS_REMINDER_MAX_PER_HOUR=30
```

---

### Notification Worker

```bash
NOTIFICATION_WORKER_CRON_ENABLED=false
NOTIFY_MAX_RETRIES=5
NOTIFY_DEFAULT_DELAY_SECONDS=0
NOTIFY_BACKOFF_BASE_SECONDS=30
NOTIFY_MAX_BACKOFF_SECONDS=900
NOTIFY_WORKER_LEASE_SECONDS=180
```

---

## WhatsApp Templates

```bash
# Template names (public configuration)
TEMPLATE_ORDER_CREATED_VENDOR=order_created_vendor
TEMPLATE_ORDER_PENDING_VENDOR=order_pending_vendor
TEMPLATE_ORDER_PAID_CUSTOMER=order_paid_customer
TEMPLATE_ORDER_SERVED_CUSTOMER=order_served_customer
TEMPLATE_ORDER_CANCELLED_CUSTOMER=order_cancelled_customer
TEMPLATE_CART_REMINDER_CUSTOMER=cart_reminder_customer
INSURANCE_ADMIN_TEMPLATE=insurance_admin_review
INSURANCE_ADMIN_TEMPLATE_LANG=en
INSURANCE_TEMPLATE_VENDOR=insurance_vendor_update
```

---

## Mobile Money (MoMo)

```bash
# ⚠️ Server-side only
MOMO_SMS_HMAC_SECRET=your-hmac-secret
MOMO_API_KEY=your-api-key
MOMO_SECRET=your-secret

# MoMo allocator settings
MOMO_ALLOCATOR_BATCH_SIZE=10
MOMO_ALLOCATOR_REQUIRE_TXN_ID=true
MOMO_ALLOCATOR_MIN_CONFIDENCE=0.6

# SMS configuration
MOMO_SMS_ALLOWED_IPS=
MOMO_SMS_DEFAULT_SOURCE=EASYMO
```

---

## Deeplinks & Baskets

```bash
# Basket deeplink URLs (public)
BASKET_DEEPLINK_BASE_URL=${DEEPLINK_BASE_URL}/basket
NEXT_PUBLIC_BASKET_DEEPLINK_BASE_URL=${BASKET_DEEPLINK_BASE_URL}
```

---

## WhatsApp Flows

```bash
# ⚠️ Server-side only
FLOW_DATA_CHANNEL_TOKEN=your-flow-token
FLOW_ENCRYPTION_PRIVATE_KEY=your-private-key
FLOW_ENCRYPTION_PUBLIC_KEY=your-public-key
ADMIN_FLOW_WA_ID=your-admin-flow-id
```

---

## Best Practices

### 1. Security First

✅ **DO:**
- Keep secrets in `.env.local` (gitignored)
- Use `CHANGEME_*` placeholders in `.env.example`
- Run `node scripts/assert-no-service-role-in-client.mjs` before commits
- Store production secrets in GitHub Secrets or Supabase Project Settings
- Use different secrets for each environment

❌ **DON'T:**
- Commit actual secrets to version control
- Use `NEXT_PUBLIC_` or `VITE_` prefix for secrets
- Share secrets in chat or email
- Reuse secrets across environments
- Hardcode secrets in code

---

### 2. Environment Management

**Local Development:**
```bash
# 1. Copy example file
cp .env.example .env

# 2. Create local overrides
cp .env.example .env.local

# 3. Fill in your values
# Edit .env.local with your actual credentials
```

**CI/CD:**
- Set secrets in GitHub repository settings
- Use environment-specific secret sets
- Rotate secrets regularly

**Production:**
- Use Supabase Project Settings for Edge Function secrets
- Use environment variables in your hosting platform
- Enable secret scanning

---

### 3. Validation

**Startup Checks:**
```typescript
// Validate required environment variables on startup
const required = ['DATABASE_URL', 'SUPABASE_URL', 'ADMIN_TOKEN'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
```

**Type Safety:**
```typescript
// Use Zod for runtime validation
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.string().regex(/^\d+$/).transform(Number),
  FEATURE_AGENT_CHAT: z.enum(['0', '1']).transform(v => v === '1'),
});

const env = envSchema.parse(process.env);
```

---

### 4. Documentation

When adding new environment variables:

1. **Add to `.env.example`** with placeholder value
2. **Document in this file** under appropriate section
3. **Add validation** in application startup
4. **Update README** if it affects setup
5. **Inform team** of new requirements

---

### 5. Rotation

Rotate secrets regularly:

- API keys: Every 90 days
- Tokens: Every 90 days
- Database passwords: Every 180 days
- Webhook secrets: When compromised

**Process:**
1. Generate new secret
2. Update in all environments
3. Deploy changes
4. Revoke old secret
5. Document in changelog

---

## Troubleshooting

### Variable Not Loading

```bash
# Check if variable is set
echo $VARIABLE_NAME

# Check .env file
cat .env | grep VARIABLE_NAME

# Restart application to pick up changes
pnpm dev
```

---

### Value Not Accessible in Client

```bash
# Add NEXT_PUBLIC_ or VITE_ prefix for client access
# But ONLY for non-sensitive values!
NEXT_PUBLIC_API_URL=https://api.example.com
```

---

### Prebuild Security Check Fails

```bash
# Run check to see violations
node scripts/assert-no-service-role-in-client.mjs

# Remove PUBLIC prefix from secrets
# Move to server-side only variables
```

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for more issues and solutions.

---

## Related Documentation

- [GROUND_RULES.md](./GROUND_RULES.md) - Security and observability requirements
- [CI_WORKFLOWS.md](./CI_WORKFLOWS.md) - CI/CD environment variables
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues
- [.env.example](../.env.example) - Complete template file

---

**Last Updated**: 2025-10-29  
**Maintained by**: EasyMO Platform Team
