# EasyMO Google Cloud Platform Deployment

Complete guide for deploying EasyMO services to Google Cloud Run.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Service Architecture](#service-architecture)
- [Detailed Setup](#detailed-setup)
- [CI/CD](#cicd)
- [Monitoring & Logging](#monitoring--logging)
- [Troubleshooting](#troubleshooting)

## Overview

EasyMO deploys multiple services to Google Cloud Run:

| Service                  | Type        | IAP    | Image                  |
| ------------------------ | ----------- | ------ | ---------------------- |
| **easymo-admin**         | Next.js PWA | ✅ Yes | `admin:latest`         |
| **easymo-voice-bridge**  | Node.js API | ❌ No  | `voice-bridge:latest`  |
| **easymo-voice-gateway** | Node.js API | ❌ No  | `voice-gateway:latest` |

**Architecture**: Hybrid approach

- **Supabase Edge Functions**: WhatsApp webhooks (low latency)
- **Google Cloud Run**: Admin tools, Voice services (scalability)
- **Shared Database**: Supabase PostgreSQL

## Prerequisites

### Required Tools

```bash
# Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Docker
# Install from https://docs.docker.com/get-docker/

# Git
git --version
```

### Required Accounts

- ✅ Google Cloud account with billing enabled
- ✅ GitHub account (for CI/CD)
- ✅ Supabase account (already configured)

### Required Secrets

| Secret                      | Purpose              | Where to Get                  |
| --------------------------- | -------------------- | ----------------------------- |
| `GCP_SA_KEY`                | Service account JSON | Google Cloud Console → IAM    |
| `SUPABASE_URL`              | Database URL         | Supabase Dashboard            |
| `SUPABASE_ANON_KEY`         | Public API key       | Supabase Dashboard → Settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API key        | Supabase Dashboard → Settings |
| `OPENAI_API_KEY`            | OpenAI API           | OpenAI Dashboard              |

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/ikanisa/easymo.git
cd easymo
```

### 2. Configure Google Cloud

```bash
# Set project
export PROJECT_ID="easymoai"
export REGION="europe-west1"

# Authenticate
gcloud auth login
gcloud config set project $PROJECT_ID

# Enable APIs
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  iap.googleapis.com \
  secretmanager.googleapis.com
```

### 3. Create Artifact Registry

```bash
gcloud artifacts repositories create easymo-repo \
  --repository-format=docker \
  --location=$REGION \
  --description="Docker images for easyMO services"

# Configure Docker
gcloud auth configure-docker $REGION-docker.pkg.dev
```

### 4. Deploy All Services

```bash
# Automated deployment
chmod +x scripts/gcp/deploy-all-services.sh
./scripts/gcp/deploy-all-services.sh
```

### 5. Configure IAP for Admin

```bash
# Enable IAP
gcloud iap web enable \
  --resource-type=cloud-run \
  --service=easymo-admin \
  --region=$REGION

# Add admin user
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=easymo-admin \
  --region=$REGION \
  --member="user:admin@ikanisa.com" \
  --role="roles/iap.httpsResourceAccessor"
```

### 6. Set Up Secrets

```bash
# Create secrets
gcloud secrets create openai-api-key --replication-policy=automatic
echo -n "sk-proj-..." | gcloud secrets versions add openai-api-key --data-file=-

gcloud secrets create supabase-service-role-key --replication-policy=automatic
echo -n "eyJ..." | gcloud secrets versions add supabase-service-role-key --data-file=-

# Grant access to Cloud Run
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding supabase-service-role-key \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 7. Update Services with Secrets

```bash
# Voice Bridge
gcloud run services update easymo-voice-bridge \
  --update-secrets OPENAI_API_KEY=openai-api-key:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest \
  --region $REGION

# Voice Gateway
gcloud run services update easymo-voice-gateway \
  --update-secrets OPENAI_API_KEY=openai-api-key:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest \
  --region $REGION
```

## Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Google Cloud (easymoai)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ easymo-admin │  │ voice-bridge │  │voice-gateway │      │
│  │   (IAP 🔒)   │  │              │  │              │      │
│  │  Cloud Run   │  │  Cloud Run   │  │  Cloud Run   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │              │
│         └─────────────────┴─────────────────┘              │
│                           ↓                                 │
│           ┌───────────────────────────────┐                 │
│           │    Artifact Registry          │                 │
│           │  easymo-repo (europe-west1)   │                 │
│           └───────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                        Supabase                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐           │
│  │ Database │  │   Auth   │  │  Edge Functions  │           │
│  │(Postgres)│  │ (GoTrue) │  │  (wa-webhook-*)  │           │
│  └──────────┘  └──────────┘  └──────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## Detailed Setup

See individual documentation files:

- [services-overview.md](services-overview.md) - Complete service inventory
- [enable-apis.md](enable-apis.md) - API enablement guide
- [artifact-registry.md](artifact-registry.md) - Container registry setup
- [cloud-run-services.md](cloud-run-services.md) - Deploy commands
- [env-vars.md](env-vars.md) - Environment variables
- [iap-admin-vendor.md](iap-admin-vendor.md) - IAP configuration
- [docker-notes.md](docker-notes.md) - Dockerfile documentation

## CI/CD

### GitHub Actions Setup

1. **Create Service Account**:

```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployer"

# Grant permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com

# Base64 encode for GitHub secret
cat github-actions-key.json | base64
```

2. **Add GitHub Secrets**:

Go to GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:

- `GCP_SA_KEY` - Base64-encoded service account JSON
- `GCP_PROJECT_ID` - `easymoai`
- `GCP_REGION` - `europe-west1`
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key

3. **Workflow**: `.github/workflows/gcp-deploy-services.yml` (already created)

### Manual Deployment

```bash
# Deploy single service
cd services/whatsapp-voice-bridge
gcloud builds submit --tag europe-west1-docker.pkg.dev/easymoai/easymo-repo/voice-bridge:latest
gcloud run deploy easymo-voice-bridge \
  --image europe-west1-docker.pkg.dev/easymoai/easymo-repo/voice-bridge:latest \
  --region europe-west1

# Deploy all services
./scripts/gcp/deploy-all-services.sh
```

## Monitoring & Logging

### View Logs

```bash
# Real-time logs
gcloud run services logs read easymo-voice-bridge --region $REGION --tail

# Filter logs
gcloud run services logs read easymo-admin \
  --region $REGION \
  --filter="severity>=ERROR" \
  --limit=50
```

### Metrics

View in Google Cloud Console:

- https://console.cloud.google.com/run?project=easymoai

Key metrics:

- Request count
- Request latency (p50, p95, p99)
- Error rate
- Container instance count
- Memory usage
- CPU utilization

### Alerts

```bash
# Create alert for high error rate
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High Error Rate - Voice Bridge" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s
```

## Troubleshooting

### Common Issues

#### Image Build Fails

```bash
# Check Docker is running
docker info

# Rebuild with verbose output
cd service-directory
docker build -t test:local . --no-cache
```

#### Deployment Fails

```bash
# Check service account permissions
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --format="table(bindings.role)"

# Check quotas
gcloud compute project-info describe --project=$PROJECT_ID
```

#### Service Won't Start

```bash
# Check logs
gcloud run services logs read SERVICE_NAME --region $REGION --tail

# Check environment variables
gcloud run services describe SERVICE_NAME --region $REGION --format=yaml

# Test locally
docker run -p 8080:8080 --env-file .env IMAGE_NAME:latest
```

#### IAP Not Working

```bash
# Verify IAP is enabled
gcloud iap web get-iam-policy \
  --resource-type=cloud-run \
  --service=easymo-admin \
  --region=$REGION

# Check user has access
gcloud iap web get-iam-policy \
  --resource-type=cloud-run \
  --service=easymo-admin \
  --region=$REGION \
  --filter="members:user:admin@ikanisa.com"
```

### Health Checks

```bash
# Check service is running
gcloud run services describe easymo-voice-bridge --region $REGION

# Test endpoint
SERVICE_URL=$(gcloud run services describe easymo-voice-bridge --region $REGION --format="value(status.url)")
curl $SERVICE_URL/health
```

### Rollback

```bash
# List revisions
gcloud run revisions list --service easymo-admin --region $REGION

# Rollback to previous revision
gcloud run services update-traffic easymo-admin \
  --region $REGION \
  --to-revisions easymo-admin-00005-abc=100
```

## Cost Optimization

- Set `--min-instances=0` for services with sporadic traffic
- Use `--cpu-throttling` for CPU-bound services
- Enable Cloud CDN for static assets
- Use Artifact Registry cleanup policies

## Next Steps

1. ✅ Configure custom domains
2. ✅ Set up SSL certificates (auto-managed by Cloud Run)
3. ✅ Configure load balancing (if needed)
4. ✅ Set up monitoring dashboards
5. ✅ Configure alerting policies
6. ✅ Document runbooks for common issues

## Support

- **Documentation**: See `docs/gcp/` directory
- **Issues**: GitHub Issues
- **Cloud Console**: https://console.cloud.google.com/run?project=easymoai
