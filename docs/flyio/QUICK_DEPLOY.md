# Fly.io Quick Deploy Cheat Sheet

**5-Minute Reference for easyMO Deployments**

---

## 🚀 Deploy a Service (3 Commands)

```bash
# 1. Initialize
cd <service-directory>
fly launch --name <app-name> --region ams --org easymo --no-deploy

# 2. Set secrets
fly secrets set KEY1=value1 KEY2=value2 ... --app <app-name>

# 3. Deploy
fly deploy --app <app-name>
```

---

## 📦 Service Quick Reference

| Service       | Directory                         | App Name              | Port |
| ------------- | --------------------------------- | --------------------- | ---- |
| Admin PWA     | `admin-app/`                      | `easymo-admin`        | 3000 |
| Vendor Portal | `client-pwa/`                     | `easymo-vendor`       | 3000 |
| Voice Bridge  | `services/whatsapp-voice-bridge/` | `easymo-voice-bridge` | 8080 |
| WA Router     | `services/wa-router/`             | `easymo-wa-router`    | 8080 |
| Agents        | `services/agents/`                | `easymo-agents`       | 8080 |
| Agent Core    | `services/agent-core/`            | `easymo-agent-core`   | 8080 |

---

## 🔑 Common Secrets

### Frontend PWAs:

```bash
fly secrets set \
  NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG... \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbG... \
  --app easymo-admin
```

### Voice Bridge:

```bash
fly secrets set \
  OPENAI_API_KEY=sk-proj-... \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbG... \
  --app easymo-voice-bridge
```

### WhatsApp Router:

```bash
fly secrets set \
  WHATSAPP_PHONE_ID=your-id \
  WHATSAPP_ACCESS_TOKEN=EAA... \
  WHATSAPP_VERIFY_TOKEN=random-string \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbG... \
  --app easymo-wa-router
```

---

## 📊 Common Commands

```bash
# Deploy
fly deploy --app <app-name>

# Logs
fly logs --app <app-name>

# Status
fly status --app <app-name>

# Secrets
fly secrets list --app <app-name>
fly secrets set KEY=value --app <app-name>

# Scale
fly scale memory 1024 --app <app-name>
fly scale count 2 --app <app-name>

# SSH
fly ssh console --app <app-name>
```

---

**Full docs:** `docs/flyio/README.md`
