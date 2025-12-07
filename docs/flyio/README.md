# easyMO Fly.io Deployment - Quick Start

**Date:** 2025-12-07  
**Status:** Implementation Ready  

---

## 🎯 What is This?

Complete guide for deploying easyMO services to **Fly.io** - a modern platform-as-a-service for running containerized applications globally.

### Why Fly.io?

- ✅ Global edge network (low latency to Rwanda/SSA)
- ✅ Auto-scaling and cost optimization
- ✅ Simple deployment (`fly deploy`)
- ✅ Built-in monitoring and logging
- ✅ Better control than Supabase Edge Functions for complex services
- ✅ Direct integration with existing infrastructure

---

## 📚 Documentation Structure

All Fly.io documentation is in `docs/flyio/`:

| File | Purpose |
|------|---------|
| **README.md** (this file) | Quick start and overview |
| **services-overview.md** | Complete service inventory and architecture |
| **docker-notes.md** | Docker configuration for all services |
| **apps.md** | Fly apps and `fly.toml` configurations |
| **env-vars.md** | Environment variable management |

---

## 🚀 Quick Start (5 Minutes)

### 1. Install Fly CLI
```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Verify
fly version
```

### 2. Login
```bash
fly auth login
```

### 3. Deploy Your First Service (Admin PWA)
```bash
cd admin-app

# Deploy
fly launch --name easymo-admin --region ams --org easymo

# Set secrets
fly secrets set \
  NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  --app easymo-admin

# Check status
fly status --app easymo-admin
fly logs --app easymo-admin
```

### 4. Access Your App
```bash
# Get URL
fly info --app easymo-admin
# Opens: https://easymo-admin.fly.dev
```

---

## 📦 Services Deploying to Fly.io

| Service | App Name | Status | Priority |
|---------|----------|--------|----------|
| **Admin PWA** | `easymo-admin` | ✅ Dockerfile ready | HIGH |
| **Vendor Portal** | `easymo-vendor` | ⏳ Needs setup | HIGH |
| **Voice Bridge** | `easymo-voice-bridge` | ✅ Already deployed | CRITICAL |
| **WhatsApp Router** | `easymo-wa-router` | ⏳ Migration needed | CRITICAL |
| **Call Center AGI** | `easymo-agents` | ⏳ Extraction needed | CRITICAL |
| **Agent Core** | `easymo-agent-core` | ⏳ Needs fly.toml | MEDIUM |

**Region:** `ams` (Amsterdam) - Optimal for Rwanda/SSA

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│            FLY.IO CLUSTER (ams)              │
│                                              │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ easymo-admin │  │ easymo-vendor│        │
│  │  Next.js PWA │  │  Next.js PWA │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ easymo-voice │  │  easymo-wa-  │        │
│  │   -bridge    │  │   router     │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ easymo-      │  │ easymo-agent │        │
│  │  agents      │  │    -core     │        │
│  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│         SUPABASE (unchanged)                 │
│  - PostgreSQL                                │
│  - Auth                                      │
│  - Storage                                   │
│  - Remaining Edge Functions                  │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│         EXTERNAL SERVICES                    │
│  - Meta WhatsApp Cloud API                   │
│  - OpenAI (Realtime, Agents, Responses)      │
│  - MTN Rwanda SMS                            │
└─────────────────────────────────────────────┘
```

---

## 🔑 Key Concepts

### Apps
Each service is a separate Fly app with its own:
- `fly.toml` configuration
- Secrets (env vars)
- Scaling settings
- URL (e.g., `easymo-admin.fly.dev`)

### Machines
Fly runs your app in lightweight VMs called "machines":
- Start/stop automatically
- Scale based on load
- Configurable CPU/memory

### Regions
- **Primary:** `ams` (Amsterdam)
- **Backups:** Can deploy to multiple regions for HA

---

## 🛠️ Common Commands

### Deployment
```bash
cd <service-directory>
fly deploy --app <app-name>
```

### Logs
```bash
fly logs --app <app-name>           # Real-time
fly logs --app <app-name> -n 1000    # Last 1000 lines
```

### Secrets
```bash
fly secrets list --app <app-name>
fly secrets set KEY=value --app <app-name>
fly secrets unset KEY --app <app-name>
```

### Scaling
```bash
fly scale memory 1024 --app <app-name>  # MB
fly scale count 2 --app <app-name>      # Instances
```

### Status & Info
```bash
fly status --app <app-name>
fly info --app <app-name>
fly dashboard <app-name>
```

### SSH Access
```bash
fly ssh console --app <app-name>
```

---

## 🔐 Security

### Environment Variables

**Public (can be in `fly.toml`):**
- `NODE_ENV=production`
- `PORT=8080`
- `SUPABASE_URL=https://...`

**Private (must use `fly secrets set`):**
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `WHATSAPP_ACCESS_TOKEN`
- Any API keys, passwords, tokens

### Access Control
Managed at organization level:
```bash
fly orgs show easymo
fly orgs invite member@example.com --org easymo
```

---

## 💰 Cost Optimization

### Auto-Scaling
```toml
[http_service]
  auto_stop_machines = 'stop'      # Stop when idle
  auto_start_machines = true        # Start on request
  min_machines_running = 0          # Scale to zero
```

### Resource Sizing
- **Development:** `shared-cpu-1x`, 256MB (~$2/month)
- **Production:** `shared-cpu-1x`, 512MB (~$5/month)
- **High-traffic:** `shared-cpu-2x`, 1-2GB (~$15/month)

**Free tier:** ~$5/month in credits

---

## 📊 Monitoring

### Built-in
- Metrics dashboard: `fly dashboard <app-name>`
- Real-time logs: `fly logs --app <app-name>`
- Health checks in `fly.toml`

### External
- **Sentry:** Error tracking (set `SENTRY_DSN`)
- **DataDog/New Relic:** APM (optional)

---

## 🚨 Troubleshooting

### App Won't Deploy
```bash
# Check build logs
fly logs --app <app-name>

# Verify Dockerfile locally
docker build -t test .

# Check secrets
fly secrets list --app <app-name>
```

### App Crashes on Start
```bash
# View crash logs
fly logs --app <app-name>

# Common issues:
# 1. Missing environment variable
# 2. Port binding (must use 0.0.0.0)
# 3. Database connection failed
```

### Slow Performance
```bash
# Check metrics
fly status --app <app-name>

# Scale up
fly scale memory 1024 --app <app-name>
fly scale count 2 --app <app-name>
```

---

## 📖 Detailed Guides

For more details, see:

1. **[services-overview.md](./services-overview.md)** - Architecture and service inventory
2. **[docker-notes.md](./docker-notes.md)** - Docker configurations
3. **[apps.md](./apps.md)** - Fly app setup and `fly.toml` configs
4. **[env-vars.md](./env-vars.md)** - Environment variable management

---

## 🎯 Deployment Checklist

### Phase 1: Setup (✅ Complete)
- [x] Document services
- [x] Create Docker configurations
- [x] Define fly.toml templates
- [x] Document environment variables

### Phase 2: Deploy Staging (⏳ Next)
- [ ] Deploy `easymo-admin`
- [ ] Deploy `easymo-vendor`
- [ ] Deploy `easymo-voice-bridge`
- [ ] Deploy `easymo-wa-router`
- [ ] Deploy `easymo-agents`
- [ ] Test end-to-end flows

### Phase 3: CI/CD (⏳ Pending)
- [ ] Create GitHub Actions workflow
- [ ] Set up `FLY_API_TOKEN` secret
- [ ] Auto-deploy on `main` branch push

### Phase 4: Production (⏳ Pending)
- [ ] Create production apps
- [ ] Set production secrets
- [ ] Configure custom domains
- [ ] Set up monitoring/alerts
- [ ] Cutover traffic

---

## 🔗 Resources

### Fly.io Documentation
- [Fly.io Docs](https://fly.io/docs/)
- [Fly.io CLI Reference](https://fly.io/docs/flyctl/)
- [Fly.io Pricing](https://fly.io/docs/about/pricing/)

### easyMO Resources
- [Main README](../../README.md)
- [Architecture Docs](../../docs/)
- [Supabase Deployment](../../SUPABASE_DEPLOYMENT.md)

---

## ⚠️ Important Notes

### WhatsApp Integration
**easyMO uses Meta WhatsApp Cloud API directly, NOT Twilio.**
- Get credentials from Meta Business Manager
- Webhook URL: `https://easymo-wa-router.fly.dev/webhook`
- Never reference or introduce Twilio

### Auth & Access
- **Admin PWA:** Internal staff only
- **Vendor Portal:** Invited vendors only (NO public signup)
- Both use Supabase Auth with role enforcement

### Voice Bridge
- Requires UDP support for WebRTC
- Needs low latency region
- Always-on for production (no auto-stop)

---

## 🆘 Need Help?

### Check Logs First
```bash
fly logs --app <app-name>
```

### Common Issues
1. **Missing secrets:** `fly secrets list --app <app-name>`
2. **Build fails:** Check `Dockerfile` and dependencies
3. **Port binding:** Ensure app listens on `0.0.0.0:${PORT}`

### Get Support
- Fly.io Community: https://community.fly.io
- Internal team Slack: #infrastructure

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-07  
**Status:** Ready for Phase 2 Deployment  
**Next Action:** Begin staging deployments
