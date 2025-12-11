# easyMO Fly.io Deployment - Complete Guide

**Date:** 2025-12-07  
**Status:** Implementation Ready  
**Region:** `ams` (Amsterdam) - optimal for Rwanda/SSA

---

## 🎯 Executive Summary

easyMO is migrating critical services from Supabase Edge Functions to Fly.io for better control,
performance, and scaling. This guide covers the complete deployment process.

### Services Deploying to Fly.io

| Service         | Fly App Name          | Priority | Status               |
| --------------- | --------------------- | -------- | -------------------- |
| Admin PWA       | `easymo-admin`        | HIGH     | ✅ Dockerfile ready  |
| Vendor Portal   | `easymo-vendor`       | HIGH     | ⏳ Needs creation    |
| Voice Bridge    | `easymo-voice-bridge` | CRITICAL | ✅ Deployed          |
| WhatsApp Router | `easymo-wa-router`    | CRITICAL | ⏳ Migration needed  |
| Call Center AGI | `easymo-agents`       | CRITICAL | ⏳ Extraction needed |
| Agent Core      | `easymo-agent-core`   | MEDIUM   | ⏳ Needs fly.toml    |

---

## 📚 Documentation Structure

All Fly.io documentation is in `docs/flyio/`:

1. **`services-overview.md`** - Complete service inventory and architecture
2. **`docker-notes.md`** - Docker configuration for all services
3. **`apps.md`** - Fly apps and `fly.toml` configurations (this file continues below)
4. **`env-vars.md`** - Environment variable management
5. **`README.md`** - Quick start and overview

---

## 🚀 Quick Start

### Prerequisites

```bash
# Install Fly.io CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Verify
fly version
```

### Deploy Admin PWA (First Service)

```bash
cd admin-app

# Initialize (creates fly.toml)
fly launch --no-deploy \
  --name easymo-admin \
  --region ams \
  --org easymo

# Set secrets
fly secrets set \
  NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  --app easymo-admin

# Deploy
fly deploy --app easymo-admin

# Check status
fly status --app easymo-admin
fly logs --app easymo-admin
```

---

## 📋 Fly.io App Configurations

### 1. Admin PWA (`easymo-admin`)

**fly.toml** (create in `admin-app/fly.toml`):

```toml
app = 'easymo-admin'
primary_region = 'ams'

[build]
  dockerfile = 'Dockerfile'

[env]
  NODE_ENV = 'production'
  PORT = '3000'
  NEXT_TELEMETRY_DISABLED = '1'

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'off'
  auto_start_machines = true
  min_machines_running = 1
  processes = ['app']

  [http_service.concurrency]
    type = 'requests'
    hard_limit = 250
    soft_limit = 200

[[vm]]
  cpu_kind = 'shared'
  cpus = 1
  memory_mb = 512
```

**Secrets to set:**

```bash
fly secrets set \
  NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG... \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbG... \
  --app easymo-admin
```

**Access:**

```bash
# Get URL
fly info --app easymo-admin

# Custom domain (optional)
fly certs add admin.easymo.rw --app easymo-admin
```

---

### 2. Vendor Portal (`easymo-vendor`)

**fly.toml** (create in `client-pwa/fly.toml` or vendor-specific directory):

```toml
app = 'easymo-vendor'
primary_region = 'ams'

[build]
  dockerfile = 'Dockerfile'

[env]
  NODE_ENV = 'production'
  PORT = '3000'
  NEXT_TELEMETRY_DISABLED = '1'

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'off'
  auto_start_machines = true
  min_machines_running = 1
  processes = ['app']

  [http_service.concurrency]
    type = 'requests'
    hard_limit = 250
    soft_limit = 200

[[vm]]
  cpu_kind = 'shared'
  cpus = 1
  memory_mb = 512
```

**Secrets:** Same as Admin PWA

---

### 3. Voice Bridge (`easymo-voice-bridge`)

**fly.toml** (already exists at `services/whatsapp-voice-bridge/fly.toml`):

**Update it to:**

```toml
app = 'easymo-voice-bridge'
primary_region = 'ams'

[build]
  dockerfile = 'Dockerfile'

[env]
  NODE_ENV = 'production'
  PORT = '8080'
  LOG_LEVEL = 'info'
  OPENAI_ORG_ID = 'org-4Kr7lOqpDhJErYgyGzwgSduN'
  OPENAI_PROJECT_ID = 'proj_BL7HHgepm76lhElLqmfOckIU'
  OPENAI_REALTIME_MODEL = 'gpt-4-realtime-preview'
  SUPABASE_URL = 'https://lhbowpbcpwoiparwnwgt.supabase.co'

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0
  processes = ['app']

  [http_service.concurrency]
    type = 'connections'
    hard_limit = 25
    soft_limit = 20

[[vm]]
  cpu_kind = 'shared'
  cpus = 2
  memory_mb = 1024
```

**Secrets:**

```bash
fly secrets set \
  OPENAI_API_KEY=sk-proj-... \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbG... \
  --app easymo-voice-bridge
```

**Special Notes:**

- Needs UDP for WebRTC
- Higher memory for audio processing
- Auto-stop when idle to save costs

---

### 4. WhatsApp Router (`easymo-wa-router`)

**fly.toml** (create in `services/wa-router/fly.toml` if migrating):

```toml
app = 'easymo-wa-router'
primary_region = 'ams'

[build]
  dockerfile = 'Dockerfile'

[env]
  NODE_ENV = 'production'
  PORT = '8080'
  LOG_LEVEL = 'info'
  SUPABASE_URL = 'https://lhbowpbcpwoiparwnwgt.supabase.co'

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = 'off'
  auto_start_machines = true
  min_machines_running = 1
  processes = ['app']

  [http_service.concurrency]
    type = 'requests'
    hard_limit = 100
    soft_limit = 80

  [[http_service.checks]]
    grace_period = "5s"
    interval = "30s"
    method = "GET"
    timeout = "5s"
    path = "/health"

[[vm]]
  cpu_kind = 'shared'
  cpus = 1
  memory_mb = 512
```

**Secrets:**

```bash
fly secrets set \
  WHATSAPP_PHONE_ID=your-phone-id \
  WHATSAPP_ACCESS_TOKEN=EAA... \
  WHATSAPP_VERIFY_TOKEN=your-verify-token \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbG... \
  --app easymo-wa-router
```

**Webhook URL:**

```
https://easymo-wa-router.fly.dev/webhook
```

Configure this in Meta WhatsApp Business dashboard.

**IMPORTANT:** Uses **Meta WhatsApp Cloud API**, NOT Twilio

---

### 5. Call Center AGI (`easymo-agents`)

**fly.toml** (create in `services/agents/fly.toml`):

```toml
app = 'easymo-agents'
primary_region = 'ams'

[build]
  dockerfile = 'Dockerfile'

[env]
  NODE_ENV = 'production'
  PORT = '8080'
  LOG_LEVEL = 'info'
  OPENAI_ORG_ID = 'org-4Kr7lOqpDhJErYgyGzwgSduN'
  OPENAI_PROJECT_ID = 'proj_BL7HHgepm76lhElLqmfOckIU'
  OPENAI_REALTIME_MODEL = 'gpt-4-realtime-preview'
  SUPABASE_URL = 'https://lhbowpbcpwoiparwnwgt.supabase.co'

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = 'off'
  auto_start_machines = true
  min_machines_running = 1
  processes = ['app']

  [http_service.concurrency]
    type = 'connections'
    hard_limit = 50
    soft_limit = 40

  [[http_service.checks]]
    grace_period = "10s"
    interval = "60s"
    method = "GET"
    timeout = "10s"
    path = "/health"

[[vm]]
  cpu_kind = 'shared'
  cpus = 2
  memory_mb = 2048
```

**Secrets:**

```bash
fly secrets set \
  OPENAI_API_KEY=sk-proj-... \
  GEMINI_API_KEY=AIza... \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbG... \
  --app easymo-agents
```

**Special Notes:**

- High memory for AI processing
- Persistent connections to OpenAI
- Always-on (min_machines_running = 1)

---

## 🔧 Common Operations

### Deploy Updates

```bash
cd <service-directory>
fly deploy --app <app-name>
```

### View Logs

```bash
fly logs --app <app-name>           # Real-time
fly logs --app <app-name> -n 1000    # Last 1000 lines
```

### Scale Resources

```bash
# Scale memory
fly scale memory 1024 --app easymo-agents

# Scale VMs
fly scale count 2 --app easymo-wa-router

# Scale CPU
fly scale vm shared-cpu-2x --app easymo-voice-bridge
```

### SSH into Machine

```bash
fly ssh console --app <app-name>
```

### Restart App

```bash
fly apps restart <app-name>
```

---

## 🔐 Security

### Secrets Management

```bash
# List secrets
fly secrets list --app <app-name>

# Set secret
fly secrets set KEY=value --app <app-name>

# Unset secret
fly secrets unset KEY --app <app-name>
```

### Access Control

```bash
# List team members
fly orgs show easymo

# Add member
fly orgs invite member@example.com --org easymo

# Remove member
fly orgs remove member@example.com --org easymo
```

---

## 📊 Monitoring

### Health Checks

All services implement `/health` endpoint:

```typescript
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "service-name", timestamp: Date.now() });
});
```

### Metrics

```bash
# View metrics
fly dashboard <app-name>

# Check status
fly status --app <app-name>
```

---

## 💰 Cost Optimization

### Auto-Scaling Configuration

```toml
[http_service]
  auto_stop_machines = 'stop'      # Stop when idle
  auto_start_machines = true        # Start on request
  min_machines_running = 0          # Scale to zero
```

**Use for:**

- Development/staging environments
- Low-traffic services
- Background workers

**Don't use for:**

- Critical user-facing services (easymo-wa-router, easymo-admin)
- Services with persistent connections (easymo-agents)

### Resource Sizing

Start small, scale up as needed:

- **Development:** `shared-cpu-1x`, 256MB
- **Production:** `shared-cpu-1x`, 512MB minimum
- **High-traffic:** `shared-cpu-2x`, 1GB+

---

## 🚨 Troubleshooting

### Deployment Fails

```bash
# Check build logs
fly logs --app <app-name>

# Verify Dockerfile
docker build -t test .

# Check secrets
fly secrets list --app <app-name>
```

### App Won't Start

```bash
# Check logs
fly logs --app <app-name>

# Common issues:
# - Missing environment variables
# - Port binding (must bind to 0.0.0.0)
# - Database connection errors
```

### Slow Response

```bash
# Check metrics
fly status --app <app-name>

# Scale up
fly scale memory 1024 --app <app-name>
fly scale count 2 --app <app-name>
```

---

## 📁 File Checklist

For each service deploying to Fly.io:

- [ ] `Dockerfile` - Multi-stage, optimized
- [ ] `fly.toml` - App configuration
- [ ] `.dockerignore` - Exclude unnecessary files
- [ ] `.env.fly.example` - Example environment variables
- [ ] `/health` endpoint - Health check
- [ ] README update - Fly.io deployment instructions

---

## 🎯 Next Steps

1. ✅ Created services overview
2. ✅ Documented Docker configurations
3. ✅ Created fly.toml templates
4. ⏳ **Next:** Create environment variables guide
5. ⏳ Set up CI/CD with GitHub Actions
6. ⏳ Deploy staging instances
7. ⏳ Test end-to-end flows
8. ⏳ Production cutover

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-07  
**Next Action:** Create `env-vars.md` and begin staging deployments
