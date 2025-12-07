# Environment Variables - easyMO Fly.io Deployment

**Date:** 2025-12-07  
**Purpose:** Comprehensive guide to environment variable management for Fly.io

---

## 🎯 Overview

All easyMO services use environment variables for configuration (12-factor app). This guide documents:
- Required variables per service
- How to set them in Fly.io
- Security best practices
- Example values (non-sensitive)

---

## 🔐 Security Principles

1. **NEVER commit real secrets to Git**
2. Use `fly secrets set` for sensitive data
3. Use `[env]` in `fly.toml` only for non-sensitive config
4. Different secrets for staging vs production
5. Rotate secrets regularly

---

## 📋 Common Variables (All Services)

### Supabase (Database & Auth)
```bash
# Public URL (can be in fly.toml [env])
SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co

# Service role key (MUST be secret)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Anon key (public, but set as secret for consistency)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# For Next.js (build-time, prefix with NEXT_PUBLIC_)
NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Node.js Runtime
```bash
# Environment (can be in fly.toml)
NODE_ENV=production

# Port (can be in fly.toml)
PORT=8080

# Log level (can be in fly.toml)
LOG_LEVEL=info
```

---

## 1️⃣ Admin PWA (`easymo-admin`)

### fly.toml [env] Section
```toml
[env]
  NODE_ENV = 'production'
  PORT = '3000'
  NEXT_TELEMETRY_DISABLED = '1'
```

### Secrets to Set
```bash
fly secrets set \
  NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG... \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbG... \
  --app easymo-admin
```

### Optional Secrets
```bash
# Sentry (error tracking)
fly secrets set SENTRY_DSN=https://... --app easymo-admin

# Google Maps (if used in admin)
fly secrets set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza... --app easymo-admin
```

### .env.fly.example
```bash
# Public (build-time)
NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Private (runtime)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional
SENTRY_DSN=https://your-sentry-dsn
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-gmaps-key
```

---

## 2️⃣ Vendor Portal (`easymo-vendor`)

### Same as Admin PWA
Use identical configuration to Admin PWA.

---

## 3️⃣ WhatsApp Voice Bridge (`easymo-voice-bridge`)

### fly.toml [env] Section
```toml
[env]
  NODE_ENV = 'production'
  PORT = '8080'
  LOG_LEVEL = 'info'
  OPENAI_ORG_ID = 'org-4Kr7lOqpDhJErYgyGzwgSduN'
  OPENAI_PROJECT_ID = 'proj_BL7HHgepm76lhElLqmfOckIU'
  OPENAI_REALTIME_MODEL = 'gpt-4-realtime-preview'
  SUPABASE_URL = 'https://lhbowpbcpwoiparwnwgt.supabase.co'
```

### Secrets to Set
```bash
fly secrets set \
  OPENAI_API_KEY=your-openai-key \
  SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key \
  --app easymo-voice-bridge
```

### Optional Secrets
```bash
# SIP provider (if used)
fly secrets set \
  SIP_USERNAME=your-sip-username \
  SIP_PASSWORD=your-sip-password \
  SIP_DOMAIN=sip.provider.com \
  --app easymo-voice-bridge

# Monitoring
fly secrets set SENTRY_DSN=https://... --app easymo-voice-bridge
```

### .env.fly.example
```bash
# Runtime (non-sensitive, in fly.toml)
NODE_ENV=production
PORT=8080
LOG_LEVEL=info
OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN
OPENAI_PROJECT_ID=proj_BL7HHgepm76lhElLqmfOckIU
OPENAI_REALTIME_MODEL=gpt-4-realtime-preview
SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co

# Secrets (via fly secrets set)
OPENAI_API_KEY=sk-proj-...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Optional
SIP_USERNAME=your-sip-username
SIP_PASSWORD=your-sip-password
SIP_DOMAIN=sip.provider.com
SENTRY_DSN=https://...
```

---

## 4️⃣ WhatsApp Router (`easymo-wa-router`)

### fly.toml [env] Section
```toml
[env]
  NODE_ENV = 'production'
  PORT = '8080'
  LOG_LEVEL = 'info'
  SUPABASE_URL = 'https://lhbowpbcpwoiparwnwgt.supabase.co'
```

### Secrets to Set
```bash
fly secrets set \
  WHATSAPP_PHONE_ID=your-whatsapp-phone-id \
  WHATSAPP_ACCESS_TOKEN=EAAYourWhatsAppAccessToken \
  WHATSAPP_VERIFY_TOKEN=your-random-verify-token \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbG... \
  --app easymo-wa-router
```

### .env.fly.example
```bash
# Runtime (non-sensitive)
NODE_ENV=production
PORT=8080
LOG_LEVEL=info
SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co

# Secrets (via fly secrets set)
# Meta WhatsApp Cloud API credentials
WHATSAPP_PHONE_ID=your-phone-id
WHATSAPP_ACCESS_TOKEN=EAA...
WHATSAPP_VERIFY_TOKEN=random-string-you-choose

# Supabase
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Optional
SENTRY_DSN=https://...
```

### ⚠️ CRITICAL: Meta WhatsApp Cloud API

**easyMO uses Meta WhatsApp Cloud API directly, NOT Twilio.**

Get credentials from:
1. Go to https://business.facebook.com/
2. Create WhatsApp Business App
3. Get Phone Number ID and Access Token
4. Set webhook URL: `https://easymo-wa-router.fly.dev/webhook`
5. Set verify token (any random string you choose)

**DO NOT** introduce or reference Twilio anywhere.

---

## 5️⃣ Call Center AGI (`easymo-agents`)

### fly.toml [env] Section
```toml
[env]
  NODE_ENV = 'production'
  PORT = '8080'
  LOG_LEVEL = 'info'
  OPENAI_ORG_ID = 'org-4Kr7lOqpDhJErYgyGzwgSduN'
  OPENAI_PROJECT_ID = 'proj_BL7HHgepm76lhElLqmfOckIU'
  OPENAI_REALTIME_MODEL = 'gpt-4-realtime-preview'
  SUPABASE_URL = 'https://lhbowpbcpwoiparwnwgt.supabase.co'
```

### Secrets to Set
```bash
fly secrets set \
  OPENAI_API_KEY=sk-proj-... \
  GEMINI_API_KEY=AIza... \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbG... \
  --app easymo-agents
```

### Optional Secrets
```bash
# Additional AI providers
fly secrets set \
  ANTHROPIC_API_KEY=sk-ant-... \
  --app easymo-agents

# Monitoring
fly secrets set \
  SENTRY_DSN=https://... \
  --app easymo-agents
```

### .env.fly.example
```bash
# Runtime (non-sensitive)
NODE_ENV=production
PORT=8080
LOG_LEVEL=info
OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN
OPENAI_PROJECT_ID=proj_BL7HHgepm76lhElLqmfOckIU
OPENAI_REALTIME_MODEL=gpt-4-realtime-preview
SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co

# Secrets (via fly secrets set)
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIza...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Optional
ANTHROPIC_API_KEY=sk-ant-...
SENTRY_DSN=https://...
```

---

## 6️⃣ Agent Core (`easymo-agent-core`)

### fly.toml [env] Section
```toml
[env]
  NODE_ENV = 'production'
  PORT = '8080'
  LOG_LEVEL = 'info'
```

### Secrets to Set
```bash
fly secrets set \
  DATABASE_URL=postgresql://user:password@host:5432/database \
  REDIS_URL=redis://host:6379 \
  KAFKA_BROKERS=broker1:9092,broker2:9092 \
  --app easymo-agent-core
```

### .env.fly.example
```bash
# Runtime
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

# Secrets
DATABASE_URL=postgresql://user:password@host:5432/database
REDIS_URL=redis://host:6379
KAFKA_BROKERS=broker1:9092,broker2:9092
```

---

## 7️⃣ SMS Webhook (`easymo-sms-webhook`)

### Secrets to Set
```bash
fly secrets set \
  MTN_SMS_API_KEY=your-mtn-api-key \
  MTN_SMS_API_SECRET=your-mtn-api-secret \
  MTN_SMS_SENDER_ID=EasyMO \
  SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbG... \
  --app easymo-sms-webhook
```

---

## 🛠️ Secret Management Commands

### List All Secrets (shows names only, not values)
```bash
fly secrets list --app easymo-admin
```

### Set Multiple Secrets at Once
```bash
fly secrets set \
  KEY1=value1 \
  KEY2=value2 \
  KEY3=value3 \
  --app <app-name>
```

### Set from File
```bash
# Create .env.production (DO NOT commit!)
cat > .env.production << 'EOF'
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
OPENAI_API_KEY=sk-proj-...
EOF

# Import (Fly doesn't support this directly, use script)
cat .env.production | while IFS= read -r line; do
  fly secrets set "$line" --app <app-name>
done

# Delete file after
rm .env.production
```

### Unset Secret
```bash
fly secrets unset KEY_NAME --app <app-name>
```

### Rotate Secrets
```bash
# Set new value (app restarts automatically)
fly secrets set OPENAI_API_KEY=new-key --app easymo-agents

# Verify in logs
fly logs --app easymo-agents
```

---

## 🔒 Security Best Practices

### 1. Never Log Secrets
```typescript
// ❌ BAD
console.log('API Key:', process.env.OPENAI_API_KEY);

// ✅ GOOD
console.log('API Key configured:', !!process.env.OPENAI_API_KEY);
```

### 2. Validate Required Env Vars on Startup
```typescript
const requiredEnvVars = [
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
```

### 3. Use Different Secrets Per Environment
```bash
# Staging
fly secrets set OPENAI_API_KEY=sk-staging-... --app easymo-agents-staging

# Production
fly secrets set OPENAI_API_KEY=sk-prod-... --app easymo-agents
```

### 4. Audit Secret Access
```bash
# Check who has access
fly orgs show easymo

# Review secret changes in activity log
fly dashboard easymo
```

---

## 📝 Creating .env.fly.example Files

For each service, create `.env.fly.example` with dummy values:

```bash
# Example for voice-bridge
cd services/whatsapp-voice-bridge

cat > .env.fly.example << 'EOF'
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN
OPENAI_PROJECT_ID=proj_BL7HHgepm76lhElLqmfOckIU
OPENAI_REALTIME_MODEL=gpt-4-realtime-preview

# Supabase
SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Runtime
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

# Optional: SIP Provider
SIP_USERNAME=your-sip-username
SIP_PASSWORD=your-sip-password
SIP_DOMAIN=sip.provider.com
EOF

# Commit this file (it has no real secrets)
git add .env.fly.example
```

---

## 🎯 Next Steps

1. ✅ Document all environment variables
2. ⏳ Create `.env.fly.example` for each service
3. ⏳ Set up CI/CD to auto-deploy
4. ⏳ Create staging and production secret sets
5. ⏳ Test deployments

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-07  
**Status:** Complete
