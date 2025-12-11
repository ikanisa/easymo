# easyMO on Google Cloud – Master Index

**Complete deployment guide for running easyMO on Google Cloud Run**

---

## 🚀 Quick Start (30 Minutes)

**Get easyMO running on GCP in 6 steps:**

1. **Enable APIs** (2 min)

   ```bash
   gcloud services enable artifactregistry.googleapis.com cloudbuild.googleapis.com run.googleapis.com iap.googleapis.com secretmanager.googleapis.com
   ```

2. **Create Artifact Registry** (1 min)

   ```bash
   gcloud artifacts repositories create easymo-repo --repository-format=docker --location=europe-west1
   ```

3. **Build & Push Admin Image** (5 min)

   ```bash
   gcloud builds submit --tag europe-west1-docker.pkg.dev/easymoai/easymo-repo/admin:latest --dockerfile admin-app/Dockerfile .
   ```

4. **Deploy to Cloud Run** (2 min)

   ```bash
   gcloud run deploy easymo-admin --image europe-west1-docker.pkg.dev/easymoai/easymo-repo/admin:latest --region europe-west1 --allow-unauthenticated=false
   ```

5. **Enable IAP** (3 min)
   - Cloud Console → Cloud Run → easymo-admin → Security → Enable IAP

6. **Add Users** (1 min)
   ```bash
   gcloud iap web add-iam-policy-binding --resource-type=cloud-run --service=easymo-admin --region europe-west1 --member="user:admin@ikanisa.com" --role="roles/iap.httpsResourceAccessor"
   ```

✅ **Done!** Admin app is live and secured.

---

## 📚 Documentation

### Essential Reading (Start Here)

1. **[services-overview.md](./services-overview.md)** ⭐
   - All services catalog
   - Tech stack per service
   - Deployment priority
   - **READ THIS FIRST**

2. **[docker-notes.md](./docker-notes.md)**
   - Dockerfile patterns
   - Port configuration (8080)
   - Existing vs. missing Dockerfiles
   - Multi-stage builds

3. **[artifact-registry.md](./artifact-registry.md)**
   - Registry setup
   - Build & push commands
   - Image naming conventions
   - Helper scripts

4. **[cloud-run-services.md](./cloud-run-services.md)**
   - Deployment commands per service
   - Memory/CPU configuration
   - Environment variables
   - Cost estimates

5. **[env-vars.md](./env-vars.md)**
   - Environment variables per service
   - Secret Manager setup
   - `.env.gcp.example` files
   - Security best practices

6. **[iap-admin-vendor.md](./iap-admin-vendor.md)**
   - Identity-Aware Proxy setup
   - Protect Admin + Vendor portals
   - Add/remove users
   - Vendor onboarding workflow

7. **[ci-cd.md](./ci-cd.md)**
   - GitHub Actions workflows
   - Service account setup
   - Auto-deploy on push
   - Rollback strategies

8. **[enable-apis.md](./enable-apis.md)**
   - Required GCP APIs
   - Quick enable all
   - Troubleshooting

9. **[whatsapp-webhooks.md](./whatsapp-webhooks.md)**
   - Why keep webhooks on Supabase
   - Performance & cost comparison
   - Hybrid architecture
   - Migration path if needed

---

## 🎯 Deployment Phases

### Phase 1: Core Services (Week 1)

**Goal**: Get internal tools + WhatsApp working

| Service         | Dockerfile           | Deploy Priority | IAP Required               |
| --------------- | -------------------- | --------------- | -------------------------- |
| Admin PWA       | ✅ Exists (fix PORT) | 🔴 P0           | ✅ Yes                     |
| Vendor Portal   | ⚠️ Create            | 🟠 P1           | ✅ Yes                     |
| WhatsApp Router | ✅ Exists (fix PORT) | 🔴 P0           | ❌ No (public API)         |
| Agent Core      | ⚠️ Create            | 🟠 P1           | ❌ No (service-to-service) |

**Phase 1 Checklist**:

- [ ] Fix PORT in `admin-app/Dockerfile` (3000 → 8080)
- [ ] Create `waiter-pwa/Dockerfile` (copy from admin-app)
- [ ] Fix PORT in `services/whatsapp-webhook-worker/Dockerfile` (4900 → 8080)
- [ ] Create `services/agent-core/Dockerfile` (NestJS pattern)
- [ ] Deploy all 4 services
- [ ] Enable IAP for Admin + Vendor
- [ ] Test end-to-end WhatsApp flow

---

### Phase 2: Voice & Mobility (Week 2)

**Goal**: Enable voice calls and mobility services

| Service               | Status               | Priority |
| --------------------- | -------------------- | -------- |
| Voice Bridge          | ✅ Dockerfile exists | 🟠 P1    |
| Client PWA            | ⚠️ Create Dockerfile | 🟠 P1    |
| Voice Media Server    | ✅ Ready             | 🟡 P2    |
| Voice Media Bridge    | ✅ Ready             | 🟡 P2    |
| WhatsApp Voice        | ✅ Ready             | 🟡 P2    |
| Mobility Orchestrator | ✅ Ready             | 🟡 P2    |

**Phase 2 Checklist**:

- [ ] Create `client-pwa/Dockerfile`
- [ ] Review PORT in all voice service Dockerfiles
- [ ] Deploy Voice Bridge
- [ ] Deploy Client PWA
- [ ] Deploy voice media services
- [ ] Test voice call flow

---

### Phase 3: Supporting Services (Week 3+)

**Goal**: Deploy remaining microservices and workers

| Service              | Status              | Priority |
| -------------------- | ------------------- | -------- |
| Ranking Service      | ✅ Ready            | 🟢 P3    |
| Wallet Service       | ✅ Ready            | 🟢 P3    |
| Video Orchestrator   | ✅ Ready            | 🟢 P3    |
| Buyer/Vendor/Profile | ✅ Ready            | 🟢 P3    |
| Background Workers   | Plan Cloud Run Jobs | 🟢 P3    |

---

## 🛠️ Common Tasks

### Automated Deployment (Recommended)

Use the automated deployment script for complete phased deployment:

```bash
# Deploy all services (all phases)
./scripts/gcp-deploy-all.sh

# Deploy Phase 1 only (Core services)
./scripts/gcp-deploy-all.sh --phase 1

# Deploy Phase 2 only (Voice & Media)
./scripts/gcp-deploy-all.sh --phase 2

# Deploy Phase 3 only (Supporting services)
./scripts/gcp-deploy-all.sh --phase 3

# Get help
./scripts/gcp-deploy-all.sh --help
```

**Features**:

- Automated preflight checks
- API enablement
- Artifact Registry setup
- Phased deployment (Phase 1, 2, 3)
- Colored output and error handling
- Service URL summary

### Build & Deploy a Service (Manual)

```bash
# 1. Build image
gcloud builds submit \
  --tag europe-west1-docker.pkg.dev/easymoai/easymo-repo/SERVICE_NAME:latest \
  --dockerfile PATH/TO/Dockerfile \
  .

# 2. Deploy to Cloud Run
gcloud run deploy easymo-SERVICE_NAME \
  --image europe-west1-docker.pkg.dev/easymoai/easymo-repo/SERVICE_NAME:latest \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated=false \
  --memory 512Mi \
  --cpu 1 \
  --port 8080
```

### Add User to IAP

```bash
# Admin user
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=easymo-admin \
  --region=europe-west1 \
  --member="user:admin@ikanisa.com" \
  --role="roles/iap.httpsResourceAccessor"

# Vendor user
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=easymo-vendor \
  --region=europe-west1 \
  --member="user:vendor@gmail.com" \
  --role="roles/iap.httpsResourceAccessor"
```

### View Logs

```bash
# Stream logs for a service
gcloud run services logs tail easymo-admin --region europe-west1

# View in Cloud Console
echo "https://console.cloud.google.com/run?project=easymoai"
```

### Rollback Deployment

```bash
# List revisions
gcloud run revisions list --service easymo-admin --region europe-west1

# Rollback to previous revision
gcloud run services update-traffic easymo-admin \
  --to-revisions easymo-admin-00001-abc=100 \
  --region europe-west1
```

---

## 📋 Pre-Deployment Checklist

Before deploying any service:

### Dockerfile

- [ ] Multi-stage build (builder → runner)
- [ ] Listens on `process.env.PORT || 8080`
- [ ] `NODE_ENV=production` set
- [ ] Non-root user (if applicable)
- [ ] `.dockerignore` exists

### Environment Variables

- [ ] No secrets in `NEXT_PUBLIC_*` or `VITE_*` vars
- [ ] Secrets stored in Secret Manager
- [ ] `.env.gcp.example` created (dummy values)
- [ ] Cloud Run granted access to secrets

### Service Configuration

- [ ] Memory/CPU appropriate for workload
- [ ] Min/max instances set correctly
- [ ] Timeout configured (default 300s)
- [ ] Concurrency set (if applicable)
- [ ] Health endpoint exists (`/health` or `/healthz`)

### Security

- [ ] `--allow-unauthenticated=false` for internal apps
- [ ] IAP enabled for Admin + Vendor
- [ ] Webhook signatures verified (WhatsApp, etc.)
- [ ] RLS policies enabled in Supabase

---

## 🚨 Troubleshooting

### "Permission denied" errors

```bash
# Grant yourself permissions
gcloud projects add-iam-policy-binding easymoai \
  --member="user:YOUR_EMAIL" \
  --role="roles/owner"
```

### "API not enabled"

```bash
# Enable missing API
gcloud services enable API_NAME
```

### "Image not found"

```bash
# Authenticate Docker
gcloud auth configure-docker europe-west1-docker.pkg.dev

# Verify image exists
gcloud artifacts docker images list europe-west1-docker.pkg.dev/easymoai/easymo-repo
```

### Service won't start

```bash
# Check logs
gcloud run services logs tail SERVICE_NAME --region europe-west1

# Common issues:
# - PORT not 8080
# - Missing env vars
# - Health check failing
# - Insufficient memory
```

---

## 💰 Cost Estimates

**Phase 1 (4 services, low traffic)**:

- Cloud Run: ~$10-20/month
- Artifact Registry: ~$1/month (10 GB)
- Secret Manager: ~$0.50/month
- **Total: ~$12-22/month**

**Phase 2+3 (12+ services, medium traffic)**:

- Cloud Run: ~$30-60/month
- Artifact Registry: ~$2/month
- Secret Manager: ~$1/month
- **Total: ~$33-63/month**

**Free tier**:

- 2 million requests/month free
- 360,000 GB-seconds free
- 180,000 vCPU-seconds free

Low traffic services will likely stay in free tier!

---

## 📞 Support

**GCP Console**: https://console.cloud.google.com/?project=easymoai

**Quick Links**:

- Cloud Run: https://console.cloud.google.com/run?project=easymoai
- Artifact Registry: https://console.cloud.google.com/artifacts?project=easymoai
- IAP: https://console.cloud.google.com/security/iap?project=easymoai
- Secret Manager: https://console.cloud.google.com/security/secret-manager?project=easymoai
- Logs: https://console.cloud.google.com/logs?project=easymoai

**Documentation**:

- Cloud Run: https://cloud.google.com/run/docs
- IAP: https://cloud.google.com/iap/docs

---

## 🎓 Learning Path

**New to GCP?** Follow this order:

1. Read [services-overview.md](./services-overview.md) (understand what we're deploying)
2. Read [docker-notes.md](./docker-notes.md) (understand Dockerfiles)
3. Follow Quick Start above (deploy one service)
4. Read [iap-admin-vendor.md](./iap-admin-vendor.md) (secure it)
5. Read [ci-cd.md](./ci-cd.md) (automate it)
6. Deploy remaining Phase 1 services
7. Set up monitoring & alerts

**Estimated time**: 1-2 days for complete Phase 1 deployment.

---

## 🎯 Success Criteria

### Phase 1 Complete When:

- ✅ Admin PWA accessible at https://easymo-admin-xxx.a.run.app
- ✅ Only authorized users can access (IAP working)
- ✅ Vendor Portal accessible to onboarded vendors
- ✅ WhatsApp messages routed correctly
- ✅ Agent Core responding to requests
- ✅ All services logging to Cloud Logging

### Phase 2 Complete When:

- ✅ Voice calls working end-to-end
- ✅ Client PWA accessible publicly
- ✅ Mobility services operational

### Phase 3 Complete When:

- ✅ All microservices deployed
- ✅ Background workers migrated to Cloud Run Jobs
- ✅ Monitoring & alerts configured
- ✅ Cost optimized (unused services scaled to 0)

---

## 📝 Next Actions

**To start deployment NOW**:

1. Run Quick Start commands above
2. Fix Dockerfiles (see Phase 1 checklist in [docker-notes.md](./docker-notes.md))
3. Deploy Phase 1 services
4. Enable IAP
5. Test end-to-end

**Questions? Check**:

- Individual doc files for deep dives
- Troubleshooting section above
- GCP Console for service status

---

**Last Updated**: 2025-12-07  
**Project**: easymoai  
**Billing Account**: 01D051-E1A6B9-CC9562  
**Region**: europe-west1
