# Environment Variables - Quick Reference

## Security Rules

### ✅ DO
- Use `.env.local` for local development (already in `.gitignore`)
- Use Secret Manager for production secrets
- Use `NEXT_PUBLIC_*` or `VITE_*` ONLY for non-sensitive, client-safe values
- Keep service role keys server-side only
- Generate strong secrets (32+ chars) for session secrets

### ❌ DON'T
- ❌ Commit `.env` or `.env.local` to git
- ❌ Use `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` (exposes secret to browser!)
- ❌ Use `VITE_ADMIN_TOKEN` (exposes secret to browser!)
- ❌ Hardcode API keys in source code
- ❌ Set `NEXT_PUBLIC_USE_MOCKS=true` in production

## Variable Naming Conventions

| Prefix | Scope | Examples | Security |
|--------|-------|----------|----------|
| `NEXT_PUBLIC_*` | Next.js client | `NEXT_PUBLIC_SUPABASE_URL` | Public only |
| `VITE_*` | Vite client | `VITE_API_BASE_URL` | Public only |
| No prefix | Server-only | `SUPABASE_SERVICE_ROLE_KEY` | Can be secret |

## Required Variables

### Minimal Working Configuration

```bash
# .env.local (local development)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
EASYMO_ADMIN_TOKEN=your-admin-token
ADMIN_SESSION_SECRET=min-32-characters-secret
```

### Cloud Run / App Engine

```bash
# Public env vars (set via --set-env-vars)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Secrets (store in Secret Manager, reference via --update-secrets)
SUPABASE_SERVICE_ROLE_KEY=<from-secret-manager>
EASYMO_ADMIN_TOKEN=<from-secret-manager>
ADMIN_SESSION_SECRET=<from-secret-manager>
```

## Optional Variables by Feature

### WhatsApp Messaging
```bash
WHATSAPP_ACCESS_TOKEN=<meta-access-token>
WHATSAPP_PHONE_NUMBER_ID=<phone-id>
WHATSAPP_SEND_ENDPOINT=https://your-project.supabase.co/functions/v1/wa-webhook-core
```

### AI Features (OpenAI)
```bash
OPENAI_API_KEY=sk-...
ENABLE_OPENAI_REALTIME=false
```

### AI Features (Google)
```bash
GOOGLE_AI_API_KEY=AIza...
GOOGLE_MAPS_API_KEY=AIza...
GOOGLE_SEARCH_API_KEY=AIza...
GOOGLE_SEARCH_ENGINE_ID=<engine-id>
```

### Microservices
```bash
NEXT_PUBLIC_AGENT_CORE_URL=http://localhost:3001
NEXT_PUBLIC_VOICE_BRIDGE_API_URL=http://localhost:3002
NEXT_PUBLIC_WALLET_SERVICE_URL=http://localhost:3006
```

## Platform-Specific Setup

### Local Development
```bash
# 1. Copy example
cp .env.example .env.local

# 2. Edit .env.local with your values
# 3. Never commit .env.local
```

### Cloud Run
```bash
# Deploy with env vars
gcloud run deploy easymo-admin-app \
  --source . \
  --region us-central1 \
  --set-env-vars NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
  --update-secrets SUPABASE_SERVICE_ROLE_KEY=supabase-service-role:latest
```

### App Engine
```yaml
# app.yaml
env_variables:
  NEXT_PUBLIC_SUPABASE_URL: "https://xxx.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "your-anon-key"

# Use Secret Manager for sensitive values
```

### Netlify
```bash
# Via Netlify UI: Site settings → Environment variables
# Or via Netlify CLI:
netlify env:set NEXT_PUBLIC_SUPABASE_URL https://xxx.supabase.co
netlify env:set SUPABASE_SERVICE_ROLE_KEY <secret-value>
```

## Verification

```bash
# Check configuration
./verify-cloudrun-config.sh

# Security validation (prebuild)
node scripts/assert-no-service-role-in-client.mjs
```

## Common Issues

### Build fails with "SECURITY VIOLATION"
**Problem:** Service role key in `NEXT_PUBLIC_*` or `VITE_*` variable

**Solution:** Remove prefix from sensitive variables
```bash
# ❌ Wrong
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=secret

# ✅ Correct
SUPABASE_SERVICE_ROLE_KEY=secret
```

### "Supabase client credentials are missing"
**Problem:** Missing required environment variables

**Solution:** Ensure both URL and anon key are set:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Session secret too short
**Problem:** `ADMIN_SESSION_SECRET` less than 32 characters

**Solution:** Generate a longer secret:
```bash
openssl rand -hex 32
```

## Complete Documentation

- Full list: See `.env.example` in repo root
- Cloud Run: See `CLOUD_RUN_DEPLOYMENT.md`
- Ground rules: See `docs/GROUND_RULES.md`
