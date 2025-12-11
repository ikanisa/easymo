# easyMO Google Cloud Deployment – Complete

## ✅ What Was Created

### Documentation (8 Files)

All files in `/docs/gcp/`:

1. **README.md** - Master index with quick start
2. **services-overview.md** - Complete services catalog
3. **docker-notes.md** - Dockerfile patterns & requirements
4. **artifact-registry.md** - Container registry setup
5. **cloud-run-services.md** - Deployment commands
6. **env-vars.md** - Environment variables & secrets
7. **iap-admin-vendor.md** - Identity-Aware Proxy setup
8. **ci-cd.md** - GitHub Actions workflows
9. **enable-apis.md** - GCP APIs enablement

### Helper Scripts (4 Files)

All files in `/scripts/gcp/`:

1. **build-push.sh** - Build & push Docker images
2. **deploy-service.sh** - Deploy to Cloud Run
3. **add-vendor-iap.sh** - Add vendor to IAP
4. **create-secrets.sh** - Set up Secret Manager

---

## 📋 Deployment Roadmap

### Phase 1: Core Services (Week 1)

**Services to Deploy**:

- ✅ Admin PWA (internal staff)
- ✅ Vendor Portal (onboarded vendors)
- ✅ WhatsApp Router (Meta webhook)
- ✅ Agent Core (AI backend)

**Tasks Remaining**:

1. **Fix Existing Dockerfiles** (15 min)

   ```bash
   # admin-app/Dockerfile: Change PORT from 3000 to 8080
   # services/whatsapp-webhook-worker/Dockerfile: Change PORT from 4900 to 8080
   ```

2. **Create Missing Dockerfiles** (30 min)
   - `/waiter-pwa/Dockerfile` (copy from admin-app pattern)
   - `/services/agent-core/Dockerfile` (NestJS pattern)

   Templates provided in `docs/gcp/docker-notes.md`

3. **Enable GCP APIs** (2 min)

   ```bash
   cd /Users/jeanbosco/workspace/easymo
   gcloud services enable artifactregistry.googleapis.com cloudbuild.googleapis.com run.googleapis.com iap.googleapis.com secretmanager.googleapis.com
   ```

4. **Create Artifact Registry** (1 min)

   ```bash
   gcloud artifacts repositories create easymo-repo \
     --repository-format=docker \
     --location=europe-west1 \
     --description="Docker images for easyMO services"
   ```

5. **Build & Push Images** (20 min total)

   ```bash
   # Admin PWA
   ./scripts/gcp/build-push.sh admin admin-app/Dockerfile

   # Vendor Portal
   ./scripts/gcp/build-push.sh vendor waiter-pwa/Dockerfile

   # WhatsApp Router
   ./scripts/gcp/build-push.sh wa-router services/whatsapp-webhook-worker/Dockerfile

   # Agent Core
   ./scripts/gcp/build-push.sh agent-core services/agent-core/Dockerfile
   ```

6. **Deploy Services** (10 min total)

   ```bash
   # Admin PWA (IAP protected)
   ./scripts/gcp/deploy-service.sh easymo-admin admin false 512Mi 1 0 5

   # Vendor Portal (IAP protected)
   ./scripts/gcp/deploy-service.sh easymo-vendor vendor false 512Mi 1 0 10

   # WhatsApp Router (public API)
   ./scripts/gcp/deploy-service.sh easymo-wa-router wa-router true 512Mi 1 1 20

   # Agent Core (service-to-service)
   ./scripts/gcp/deploy-service.sh easymo-agent-core agent-core false 1Gi 2 1 10
   ```

7. **Configure IAP** (10 min)
   - Enable IAP for Admin + Vendor in GCP Console
   - Add initial users:
     ```bash
     gcloud iap web add-iam-policy-binding \
       --resource-type=cloud-run \
       --service=easymo-admin \
       --region=europe-west1 \
       --member="user:admin@ikanisa.com" \
       --role="roles/iap.httpsResourceAccessor"
     ```

8. **Test End-to-End** (15 min)
   - Access Admin PWA (should prompt for Google login)
   - Access Vendor Portal (test with vendor account)
   - Send WhatsApp message → verify routing
   - Check Agent Core health endpoint

**Total Time: ~90 minutes**

---

### Phase 2: Voice & Client (Week 2)

**Services**:

- Voice Bridge
- Client PWA (public)
- Voice Media services

**Preparation**:

1. Create `/client-pwa/Dockerfile`
2. Review PORT config in voice services
3. Deploy sequentially, test after each

---

### Phase 3: Supporting Services (Week 3+)

**Services**:

- Mobility, Ranking, Wallet, Video
- Background workers → Cloud Run Jobs

---

## 🚀 Quick Start (30 Minutes)

**If you want to deploy Admin PWA RIGHT NOW**:

```bash
# 1. Navigate to repo
cd /Users/jeanbosco/workspace/easymo

# 2. Enable APIs
gcloud config set project easymoai
gcloud services enable artifactregistry.googleapis.com cloudbuild.googleapis.com run.googleapis.com iap.googleapis.com

# 3. Create registry
gcloud artifacts repositories create easymo-repo --repository-format=docker --location=europe-west1

# 4. Fix Dockerfile PORT (admin-app/Dockerfile line 46)
# Change: ENV PORT=3000
# To: ENV PORT=8080

# 5. Build & push
gcloud auth configure-docker europe-west1-docker.pkg.dev
./scripts/gcp/build-push.sh admin admin-app/Dockerfile

# 6. Deploy
./scripts/gcp/deploy-service.sh easymo-admin admin false 512Mi 1 0 5

# 7. Enable IAP
# Go to: https://console.cloud.google.com/run?project=easymoai
# Click easymo-admin → Security → Enable IAP

# 8. Add yourself
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=easymo-admin \
  --region=europe-west1 \
  --member="user:YOUR_EMAIL@ikanisa.com" \
  --role="roles/iap.httpsResourceAccessor"

# 9. Open app
gcloud run services describe easymo-admin --region europe-west1 --format="value(status.url)"
```

---

## 📖 Documentation Index

**Start Here**:

1. [docs/gcp/README.md](./docs/gcp/README.md) - Quick start & master index
2. [docs/gcp/services-overview.md](./docs/gcp/services-overview.md) - All services catalog

**Setup Guides**: 3. [docs/gcp/docker-notes.md](./docs/gcp/docker-notes.md) - Dockerfile
requirements 4. [docs/gcp/artifact-registry.md](./docs/gcp/artifact-registry.md) - Container
registry 5. [docs/gcp/cloud-run-services.md](./docs/gcp/cloud-run-services.md) - Deployments

**Configuration**: 6. [docs/gcp/env-vars.md](./docs/gcp/env-vars.md) - Environment variables 7.
[docs/gcp/iap-admin-vendor.md](./docs/gcp/iap-admin-vendor.md) - IAP security

**Automation**: 8. [docs/gcp/ci-cd.md](./docs/gcp/ci-cd.md) - GitHub Actions 9.
[docs/gcp/enable-apis.md](./docs/gcp/enable-apis.md) - GCP APIs

---

## 🎯 Success Criteria

### Phase 1 Complete When:

- ✅ Admin PWA live at https://easymo-admin-xxx.a.run.app
- ✅ IAP working (only authorized users can access)
- ✅ Vendor Portal accessible to vendors
- ✅ WhatsApp messages routed to Supabase Edge Functions
- ✅ Agent Core responding to API requests
- ✅ All services logging to Cloud Logging

### Metrics:

- **Build time**: ~5 min per service
- **Deploy time**: ~2 min per service
- **Total Phase 1**: ~90 minutes
- **Monthly cost**: $10-20 (low traffic)

---

## 💡 Key Decisions Made

1. **Region**: europe-west1 (Belgium) - Closest to East Africa
2. **Authentication**: IAP for internal apps (Admin, Vendor)
3. **Secrets**: Secret Manager for all sensitive data
4. **Deployments**: Manual first, then GitHub Actions
5. **Supabase**: Remains as DB; Edge Functions stay on Supabase
6. **No Twilio**: WhatsApp uses Meta Cloud API only

---

## 📞 Support Resources

**GCP Console**: https://console.cloud.google.com/?project=easymoai

**Quick Links**:

- Cloud Run: https://console.cloud.google.com/run?project=easymoai
- Artifact Registry: https://console.cloud.google.com/artifacts?project=easymoai
- IAP: https://console.cloud.google.com/security/iap?project=easymoai
- Secrets: https://console.cloud.google.com/security/secret-manager?project=easymoai

**Troubleshooting**:

- Check [docs/gcp/README.md](./docs/gcp/README.md) "Troubleshooting" section
- View service logs: `gcloud run services logs tail SERVICE_NAME --region europe-west1`

---

## ✨ What's Different from Fly/Netlify?

| Aspect                | Previous (Fly/Netlify)      | New (GCP Cloud Run)                    |
| --------------------- | --------------------------- | -------------------------------------- |
| **Admin/Vendor Auth** | App-level only              | IAP + App-level (defense in depth)     |
| **Secrets**           | ENV vars                    | Secret Manager (encrypted, rotatable)  |
| **Scaling**           | Manual config               | Automatic (0 to 50+ instances)         |
| **Deployments**       | fly deploy / netlify deploy | gcloud run deploy (or GitHub Actions)  |
| **Cost**              | Fixed pricing               | Pay-per-use (can be $0 with free tier) |
| **Monitoring**        | Limited                     | Cloud Logging + Monitoring built-in    |

---

## 🎓 Next Steps

**Immediate** (Today):

1. Fix Dockerfiles (PORT changes)
2. Create missing Dockerfiles
3. Deploy Admin PWA (test IAP)

**This Week** (Phase 1): 4. Deploy all 4 core services 5. Test end-to-end flows 6. Set up GitHub
Actions

**Next Week** (Phase 2): 7. Deploy Voice + Client services 8. Migrate more traffic to GCP 9. Set up
monitoring alerts

---

## 📊 Project Status

- **GCP Project**: easymoai ✅
- **Billing Account**: 01D051-E1A6B9-CC9562 ✅
- **Organization**: ikanisa.com ✅
- **Documentation**: Complete (9 files) ✅
- **Helper Scripts**: Complete (4 files) ✅
- **Dockerfiles**:
  - Existing: 10+ ✅
  - Need Fixes: 2 (admin, wa-router) ⚠️
  - Need Creation: 2 (vendor, agent-core) ⚠️
- **APIs Enabled**: Ready to enable ⏳
- **Services Deployed**: 0/4 Phase 1 services ⏳

---

## 🎉 You're Ready!

Everything is prepared for deployment. Follow the roadmap above or use the quick start guide.

**Questions?** Check the docs or reach out.

**Good luck! 🚀**

---

**Created**: 2025-12-07  
**Project**: easymoai  
**Region**: europe-west1  
**Status**: Ready for Phase 1 Deployment
