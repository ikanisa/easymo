# Environment Variables – easyMO Services

## Overview

Environment variables for each service, categorized by sensitivity and deployment method.

---

## Variable Types

### 1. Public Client Variables (Safe in Browser)

Prefix: `NEXT_PUBLIC_*` (Next.js) or `VITE_*` (Vite)

- Supabase public URL
- Supabase anon key
- Public API endpoints

⚠️ **NEVER** put service role keys or secrets in public vars!

### 2. Server-Only Variables

- Database URLs
- Service role keys
- OpenAI API keys
- WhatsApp tokens

✅ Use **Secret Manager** for these

---

## Per-Service Environment Variables

### 1. Admin PWA (`easymo-admin`)

**Public vars** (--set-env-vars):

```bash
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

**Secrets** (Secret Manager):

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...  # Admin actions only
ADMIN_SESSION_SECRET=min-16-chars-random
```

**env/easymo-admin.yaml**:

```yaml
NODE_ENV: production
NEXT_TELEMETRY_DISABLED: "1"
NEXT_PUBLIC_SUPABASE_URL: https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY: eyJhbGci...
```

---

### 2. Vendor Portal PWA (`easymo-vendor`)

**Public vars**:

```bash
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

**Secrets**:

```bash
VENDOR_SESSION_SECRET=different-from-admin-secret
```

---

### 3. Client PWA (`easymo-client`)

**Public vars only**:

```bash
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

No server secrets needed (public PWA).

---

### 4. Voice Bridge (`easymo-voice-bridge`)

**All server-side** (no public vars):

```bash
NODE_ENV=production
PORT=8080

# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...  # Secret Manager

# OpenAI
OPENAI_API_KEY=sk-proj-...  # Secret Manager

# Voice provider (if applicable)
SIP_PROVIDER_URL=https://provider.com
SIP_PROVIDER_TOKEN=token123  # Secret Manager

# Optional
LOG_LEVEL=info
ENABLE_WEBSOCKET_LOGGING=false
```

**env/easymo-voice-bridge.yaml**:

```yaml
NODE_ENV: production
PORT: "8080"
LOG_LEVEL: info
SUPABASE_URL: https://xxx.supabase.co
```

**Secrets** (Secret Manager):

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `SIP_PROVIDER_TOKEN`

---

### 5. WhatsApp Router (`easymo-wa-router`)

**Environment vars**:

```bash
NODE_ENV=production
PORT=8080

# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...  # Secret Manager

# Meta WhatsApp API
WHATSAPP_PHONE_ID=123456789012345  # Meta Phone Number ID
WHATSAPP_ACCESS_TOKEN=EAAJ...  # Secret Manager
WHATSAPP_VERIFY_TOKEN=your-verify-token-123  # Secret Manager
WHATSAPP_WEBHOOK_SECRET=webhook-secret  # Secret Manager (for signature verification)

# Redis (if used)
REDIS_URL=redis://host:6380  # Secret Manager

# Kafka (if used)
KAFKA_BROKERS=broker1:9092,broker2:9092
KAFKA_USERNAME=user  # Secret Manager
KAFKA_PASSWORD=pass  # Secret Manager
```

**env/easymo-wa-router.yaml**:

```yaml
NODE_ENV: production
PORT: "8080"
SUPABASE_URL: https://xxx.supabase.co
WHATSAPP_PHONE_ID: "123456789012345"
```

**Secrets**:

- `SUPABASE_SERVICE_ROLE_KEY`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_WEBHOOK_SECRET`
- `REDIS_URL`
- `KAFKA_USERNAME`
- `KAFKA_PASSWORD`

---

### 6. Agent Core (`easymo-agent-core`)

**Environment vars**:

```bash
NODE_ENV=production
PORT=8080

# Prisma Database (Agent-Core DB, NOT Supabase)
DATABASE_URL=postgresql://user:pass@host:5432/agentcore  # Secret Manager

# Supabase (for some lookups/data)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...  # Secret Manager

# OpenAI
OPENAI_API_KEY=sk-proj-...  # Secret Manager
OPENAI_ORGANIZATION_ID=org-...  # Optional

# Agent configuration
AGENT_ENABLED=true
MAX_CONCURRENT_AGENTS=10

# Observability
LOG_LEVEL=info
SENTRY_DSN=https://...  # Secret Manager (optional)
```

**env/easymo-agent-core.yaml**:

```yaml
NODE_ENV: production
PORT: "8080"
AGENT_ENABLED: "true"
MAX_CONCURRENT_AGENTS: "10"
LOG_LEVEL: info
SUPABASE_URL: https://xxx.supabase.co
```

**Secrets**:

- `DATABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `SENTRY_DSN`

---

## Secret Manager Setup

### Create secrets

```bash
# Supabase Service Role Key
echo -n "eyJhbGciOi..." | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY \
  --replication-policy="automatic" \
  --data-file=-

# OpenAI API Key
echo -n "sk-proj-..." | gcloud secrets create OPENAI_API_KEY \
  --replication-policy="automatic" \
  --data-file=-

# WhatsApp Access Token
echo -n "EAAJ..." | gcloud secrets create WHATSAPP_ACCESS_TOKEN \
  --replication-policy="automatic" \
  --data-file=-

# WhatsApp Verify Token
echo -n "verify-token-123" | gcloud secrets create WHATSAPP_VERIFY_TOKEN \
  --replication-policy="automatic" \
  --data-file=-

# Database URL
echo -n "postgresql://..." | gcloud secrets create DATABASE_URL \
  --replication-policy="automatic" \
  --data-file=-

# Redis URL
echo -n "redis://..." | gcloud secrets create REDIS_URL \
  --replication-policy="automatic" \
  --data-file=-
```

### Grant Cloud Run access to secrets

```bash
# Get Cloud Run service account email
PROJECT_NUMBER=$(gcloud projects describe easymoai --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant secret accessor role
gcloud secrets add-iam-policy-binding SUPABASE_SERVICE_ROLE_KEY \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding OPENAI_API_KEY \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding WHATSAPP_ACCESS_TOKEN \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

# Repeat for all secrets...
```

### Use secrets in Cloud Run

```bash
gcloud run deploy easymo-wa-router \
  --image IMAGE \
  --set-env-vars "NODE_ENV=production,PORT=8080" \
  --set-secrets "SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest" \
  --set-secrets "WHATSAPP_ACCESS_TOKEN=WHATSAPP_ACCESS_TOKEN:latest" \
  --set-secrets "WHATSAPP_VERIFY_TOKEN=WHATSAPP_VERIFY_TOKEN:latest"
```

---

## .env.gcp.example Files

Create these in each service for reference (DO NOT commit real values):

### `/admin-app/.env.gcp.example`

```bash
# Public (embedded in client bundle)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# Server-only (Secret Manager in production)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
ADMIN_SESSION_SECRET=min-16-chars-random
```

### `/waiter-pwa/.env.gcp.example`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
VENDOR_SESSION_SECRET=different-secret
```

### `/services/voice-bridge/.env.gcp.example`

```bash
NODE_ENV=production
PORT=8080
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
OPENAI_API_KEY=sk-proj-...
LOG_LEVEL=info
```

### `/services/whatsapp-webhook-worker/.env.gcp.example`

```bash
NODE_ENV=production
PORT=8080
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
WHATSAPP_PHONE_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAJ...
WHATSAPP_VERIFY_TOKEN=your-verify-token
WHATSAPP_WEBHOOK_SECRET=webhook-secret
REDIS_URL=redis://host:6380
KAFKA_BROKERS=broker:9092
```

### `/services/agent-core/.env.gcp.example`

```bash
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://user:pass@host:5432/agentcore
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
OPENAI_API_KEY=sk-proj-...
AGENT_ENABLED=true
MAX_CONCURRENT_AGENTS=10
LOG_LEVEL=info
```

---

## Environment Variables Checklist

Before deploying each service:

- [ ] Created `.env.gcp.example` in service directory
- [ ] Separated public vs. secret variables
- [ ] Created secrets in Secret Manager for sensitive data
- [ ] Granted Cloud Run service account access to secrets
- [ ] Tested locally with `.env.local` (NOT committed)
- [ ] Verified no `VITE_*` or `NEXT_PUBLIC_*` vars contain secrets
- [ ] Updated deployment commands with `--set-env-vars` and `--set-secrets`

---

## Helper Script: Create All Secrets

**scripts/gcp-create-secrets.sh**:

```bash
#!/bin/bash
set -e

# Load from local .env.secrets (NOT committed)
if [ ! -f .env.secrets ]; then
  echo "Error: .env.secrets file not found"
  echo "Create .env.secrets with actual secret values"
  exit 1
fi

source .env.secrets

# Create secrets
echo "Creating GCP secrets..."

echo -n "$SUPABASE_SERVICE_ROLE_KEY" | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY \
  --replication-policy="automatic" --data-file=- || echo "Already exists"

echo -n "$OPENAI_API_KEY" | gcloud secrets create OPENAI_API_KEY \
  --replication-policy="automatic" --data-file=- || echo "Already exists"

echo -n "$WHATSAPP_ACCESS_TOKEN" | gcloud secrets create WHATSAPP_ACCESS_TOKEN \
  --replication-policy="automatic" --data-file=- || echo "Already exists"

echo -n "$WHATSAPP_VERIFY_TOKEN" | gcloud secrets create WHATSAPP_VERIFY_TOKEN \
  --replication-policy="automatic" --data-file=- || echo "Already exists"

echo -n "$DATABASE_URL" | gcloud secrets create DATABASE_URL \
  --replication-policy="automatic" --data-file=- || echo "Already exists"

echo "✅ Secrets created!"

# Grant access to Cloud Run service account
PROJECT_NUMBER=$(gcloud projects describe easymoai --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for SECRET in SUPABASE_SERVICE_ROLE_KEY OPENAI_API_KEY WHATSAPP_ACCESS_TOKEN WHATSAPP_VERIFY_TOKEN DATABASE_URL; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"
done

echo "✅ Cloud Run service account granted access!"
```

**.env.secrets** (example, DO NOT commit):

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
OPENAI_API_KEY=sk-proj-...
WHATSAPP_ACCESS_TOKEN=EAAJ...
WHATSAPP_VERIFY_TOKEN=verify-token-123
DATABASE_URL=postgresql://user:pass@host:5432/db
```

Usage:

```bash
chmod +x scripts/gcp-create-secrets.sh
./scripts/gcp-create-secrets.sh
```

---

## Update Secrets

```bash
# Update secret value
echo -n "new-value" | gcloud secrets versions add SECRET_NAME --data-file=-

# Cloud Run will use latest version automatically (or pin with :version)
```

---

## View Secrets

```bash
# List secrets
gcloud secrets list

# View secret metadata (not value)
gcloud secrets describe SUPABASE_SERVICE_ROLE_KEY

# Access secret value (requires permissions)
gcloud secrets versions access latest --secret="SUPABASE_SERVICE_ROLE_KEY"
```

---

## Security Best Practices

1. **Never commit secrets** to Git (add `.env.secrets`, `.env.local` to `.gitignore`)
2. **Use Secret Manager** for all sensitive data
3. **Rotate secrets** regularly (e.g., WHATSAPP_ACCESS_TOKEN monthly)
4. **Audit secret access** via Cloud Logging
5. **Separate secrets** per environment (dev, staging, prod)

---

## Next Steps

1. Create `.env.gcp.example` files for each service
2. Store real secrets in Secret Manager
3. Update deployment commands with `--set-secrets`
4. Test deployments
5. Set up secret rotation alerts

See:

- [cloud-run-services.md](./cloud-run-services.md) - Deployment commands
- [ci-cd.md](./ci-cd.md) - Automate with GitHub Actions
