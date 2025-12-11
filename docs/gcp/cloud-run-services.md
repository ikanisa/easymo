# Cloud Run Services Deployment – easyMO

## Project Configuration

- **Project**: `easymoai`
- **Region**: `europe-west1`
- **Repository**: `europe-west1-docker.pkg.dev/easymoai/easymo-repo`

---

## Deployment Commands by Service

### 1. Admin PWA (Internal Staff - IAP Protected)

```bash
gcloud run deploy easymo-admin \
  --image europe-west1-docker.pkg.dev/easymoai/easymo-repo/admin:latest \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated=false \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --port 8080 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,NEXT_TELEMETRY_DISABLED=1" \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}" \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

# After deployment, enable IAP (see iap-admin-vendor.md)
```

**Notes**:

- `--allow-unauthenticated=false`: Requires auth (IAP will be enabled)
- Min instances 0: Cost savings (cold starts acceptable for internal tool)
- Max instances 5: Reasonable for ~50 staff users

---

### 2. Vendor Portal PWA (Onboarded Vendors - IAP Protected)

```bash
gcloud run deploy easymo-vendor \
  --image europe-west1-docker.pkg.dev/easymoai/easymo-repo/vendor:latest \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated=false \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --port 8080 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,NEXT_TELEMETRY_DISABLED=1" \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}" \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
```

**Notes**:

- Max instances 10: More vendors than internal staff
- Also requires IAP configuration

---

### 3. Client PWA (Public End Users)

```bash
gcloud run deploy easymo-client \
  --image europe-west1-docker.pkg.dev/easymoai/easymo-repo/client:latest \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated=true \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 50 \
  --port 8080 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,NEXT_TELEMETRY_DISABLED=1" \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}" \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
```

**Notes**:

- `--allow-unauthenticated=true`: Public access
- Min instances 1: Always warm (avoid cold starts for users)
- Max instances 50: Handle traffic spikes

---

### 4. Voice Bridge (SIP ↔ WhatsApp ↔ OpenAI)

```bash
gcloud run deploy easymo-voice-bridge \
  --image europe-west1-docker.pkg.dev/easymoai/easymo-repo/voice-bridge:latest \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated=true \
  --memory 1Gi \
  --cpu 2 \
  --min-instances 1 \
  --max-instances 10 \
  --port 8080 \
  --timeout 900 \
  --concurrency 10 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "SUPABASE_URL=${SUPABASE_URL}" \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}" \
  --set-env-vars "OPENAI_API_KEY=${OPENAI_API_KEY}"
```

**Notes**:

- Higher memory/CPU: Real-time audio processing
- Longer timeout (900s = 15 min): Voice calls can be long
- Concurrency 10: WebSocket connections per instance
- Always warm (min 1): Critical for voice calls

---

### 5. WhatsApp Router (Meta Webhook)

```bash
gcloud run deploy easymo-wa-router \
  --image europe-west1-docker.pkg.dev/easymoai/easymo-repo/wa-router:latest \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated=true \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 20 \
  --port 8080 \
  --timeout 60 \
  --concurrency 100 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "WHATSAPP_VERIFY_TOKEN=${WHATSAPP_VERIFY_TOKEN}" \
  --set-env-vars "WHATSAPP_ACCESS_TOKEN=${WHATSAPP_ACCESS_TOKEN}" \
  --set-env-vars "SUPABASE_URL=${SUPABASE_URL}" \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}"
```

**Notes**:

- Public endpoint (Meta webhooks), but verify signatures in code
- High concurrency: Many simultaneous WhatsApp messages
- Always warm: Avoid delays in message processing

---

### 6. Agent Core (Call Center Backend)

```bash
gcloud run deploy easymo-agent-core \
  --image europe-west1-docker.pkg.dev/easymoai/easymo-repo/agent-core:latest \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated=false \
  --memory 1Gi \
  --cpu 2 \
  --min-instances 1 \
  --max-instances 10 \
  --port 8080 \
  --timeout 300 \
  --concurrency 20 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "DATABASE_URL=${DATABASE_URL}" \
  --set-env-vars "SUPABASE_URL=${SUPABASE_URL}" \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}" \
  --set-env-vars "OPENAI_API_KEY=${OPENAI_API_KEY}"
```

**Notes**:

- Requires auth: Service-to-service calls only
- Higher resources: AI agent orchestration
- DATABASE_URL: Separate Prisma DB for agent state

---

## Phase 2 Services (Deploy after Phase 1 stable)

### Voice Media Server

```bash
gcloud run deploy easymo-voice-media \
  --image europe-west1-docker.pkg.dev/easymoai/easymo-repo/voice-media:latest \
  --region europe-west1 \
  --allow-unauthenticated=false \
  --memory 1Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 5 \
  --port 8080 \
  --timeout 900
```

### Mobility Orchestrator

```bash
gcloud run deploy easymo-mobility \
  --image europe-west1-docker.pkg.dev/easymoai/easymo-repo/mobility:latest \
  --region europe-west1 \
  --allow-unauthenticated=false \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --port 8080 \
  --timeout 60
```

### Ranking Service

```bash
gcloud run deploy easymo-ranking \
  --image europe-west1-docker.pkg.dev/easymoai/easymo-repo/ranking:latest \
  --region europe-west1 \
  --allow-unauthenticated=false \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --port 8080 \
  --timeout 120
```

### Wallet Service

```bash
gcloud run deploy easymo-wallet \
  --image europe-west1-docker.pkg.dev/easymoai/easymo-repo/wallet:latest \
  --region europe-west1 \
  --allow-unauthenticated=false \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --port 8080 \
  --timeout 60
```

---

## Helper Scripts

### Deploy Single Service (`scripts/gcp-deploy-service.sh`)

```bash
#!/bin/bash
set -e

SERVICE_NAME=$1
IMAGE_NAME=$2
ALLOW_UNAUTH=${3:-false}
MEMORY=${4:-512Mi}
CPU=${5:-1}
MIN_INSTANCES=${6:-0}
MAX_INSTANCES=${7:-5}

if [ -z "$SERVICE_NAME" ] || [ -z "$IMAGE_NAME" ]; then
  echo "Usage: ./scripts/gcp-deploy-service.sh <service-name> <image-name> [allow-unauth] [memory] [cpu] [min] [max]"
  echo "Example: ./scripts/gcp-deploy-service.sh easymo-admin admin false 512Mi 1 0 5"
  exit 1
fi

REGION=europe-west1
PROJECT_ID=easymoai
REPO=easymo-repo

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE_NAME}:latest"

echo "Deploying ${SERVICE_NAME}..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE} \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated=${ALLOW_UNAUTH} \
  --memory ${MEMORY} \
  --cpu ${CPU} \
  --min-instances ${MIN_INSTANCES} \
  --max-instances ${MAX_INSTANCES} \
  --port 8080 \
  --timeout 300

echo "✅ ${SERVICE_NAME} deployed successfully!"
gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format="value(status.url)"
```

Usage:

```bash
./scripts/gcp-deploy-service.sh easymo-admin admin false 512Mi 1 0 5
./scripts/gcp-deploy-service.sh easymo-client client true 512Mi 1 1 50
```

---

## Environment Variables Management

### Option 1: Use --set-env-vars (for few vars)

```bash
gcloud run deploy SERVICE \
  --set-env-vars "KEY1=value1,KEY2=value2"
```

### Option 2: Use --env-vars-file (recommended)

Create `env/easymo-admin.yaml`:

```yaml
NODE_ENV: production
NEXT_TELEMETRY_DISABLED: "1"
NEXT_PUBLIC_SUPABASE_URL: https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY: eyJhbG...
```

Deploy:

```bash
gcloud run deploy easymo-admin \
  --image IMAGE \
  --env-vars-file env/easymo-admin.yaml
```

### Option 3: Use Secret Manager (for sensitive data)

Create secret:

```bash
echo -n "your-secret-key" | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --data-file=-
```

Reference in deployment:

```bash
gcloud run deploy SERVICE \
  --set-secrets "SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest"
```

**Best practice**: Use Secret Manager for:

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `DATABASE_URL`
- `WHATSAPP_ACCESS_TOKEN`

See [env-vars.md](./env-vars.md) for full details.

---

## Service URLs

After deployment, get service URLs:

```bash
# Single service
gcloud run services describe easymo-admin \
  --region europe-west1 \
  --format="value(status.url)"

# All services
gcloud run services list --region europe-west1 --format="table(name,status.url)"
```

Example outputs:

```
easymo-admin        https://easymo-admin-xxx-ew.a.run.app
easymo-vendor       https://easymo-vendor-xxx-ew.a.run.app
easymo-client       https://easymo-client-xxx-ew.a.run.app
easymo-wa-router    https://easymo-wa-router-xxx-ew.a.run.app
```

---

## Custom Domains (Optional)

Map custom domains:

```bash
# Add domain mapping
gcloud run domain-mappings create \
  --service easymo-admin \
  --domain admin.easymo.rw \
  --region europe-west1

# Verify DNS records
gcloud run domain-mappings describe \
  --domain admin.easymo.rw \
  --region europe-west1
```

Configure DNS:

```
Type: CNAME
Name: admin
Value: ghs.googlehosted.com
```

---

## Monitoring & Logs

### View logs

```bash
# Stream logs
gcloud run services logs tail easymo-admin --region europe-west1

# View in Cloud Logging
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=easymo-admin" \
  --limit 50 \
  --format json
```

### Metrics

View in Cloud Console:

- **URL**: https://console.cloud.google.com/run?project=easymoai
- Metrics: Request count, latency, error rate, instance count

---

## Update Service

### Update image only

```bash
gcloud run services update easymo-admin \
  --image europe-west1-docker.pkg.dev/easymoai/easymo-repo/admin:latest \
  --region europe-west1
```

### Update env vars

```bash
gcloud run services update easymo-admin \
  --update-env-vars "NEW_VAR=value" \
  --region europe-west1
```

### Update traffic (blue/green)

```bash
# Deploy new revision without traffic
gcloud run deploy easymo-admin \
  --image IMAGE:v2 \
  --no-traffic \
  --tag v2

# Gradually shift traffic
gcloud run services update-traffic easymo-admin \
  --to-revisions v2=10 \
  --region europe-west1

# Full cutover
gcloud run services update-traffic easymo-admin \
  --to-latest \
  --region europe-west1
```

---

## Rollback

```bash
# List revisions
gcloud run revisions list --service easymo-admin --region europe-west1

# Rollback to previous revision
gcloud run services update-traffic easymo-admin \
  --to-revisions easymo-admin-00002-abc=100 \
  --region europe-west1
```

---

## Delete Service

```bash
gcloud run services delete easymo-admin --region europe-west1
```

---

## Cost Estimation

**Pricing** (europe-west1):

- CPU: $0.00002400/vCPU-second
- Memory: $0.00000250/GiB-second
- Requests: $0.40/million

**Example**: Admin PWA (512Mi, 1 CPU, ~1000 requests/day, ~10s avg)

- CPU: 1000 × 10s × 0.00002400 = $0.24/day
- Memory: 1000 × 10s × 0.5GB × 0.00000250 = $0.0125/day
- Requests: negligible
- **Total**: ~$7.50/month (with always-free tier, likely $0-2/month)

---

## Next Steps

1. Deploy Phase 1 services (Admin, Vendor, WA Router, Agent Core)
2. Configure IAP for Admin + Vendor (see [iap-admin-vendor.md](./iap-admin-vendor.md))
3. Test services with real traffic
4. Set up monitoring alerts
5. Deploy Phase 2 services

See:

- [env-vars.md](./env-vars.md) - Environment configuration
- [iap-admin-vendor.md](./iap-admin-vendor.md) - IAP setup
- [ci-cd.md](./ci-cd.md) - Automate deployments
