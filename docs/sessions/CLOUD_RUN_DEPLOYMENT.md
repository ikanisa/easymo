# Google Cloud Run Deployment Guide

## Overview

This guide covers deploying the EasyMO admin-app (Next.js 15 SSR) to Google Cloud Run as an internal-only application.

## Architecture

- **Framework**: Next.js 15 with standalone output mode
- **Runtime**: Node.js 20 Alpine
- **Port**: 8080 (Cloud Run standard)
- **Build Tool**: pnpm (monorepo workspace)
- **Package Manager**: pnpm 10.18.3+

## Prerequisites

1. **Google Cloud Project** with Cloud Run API enabled
2. **gcloud CLI** installed and authenticated
3. **Docker** installed for local testing
4. **Secrets configured** in Google Secret Manager:
   - `supabase-service-role` - Supabase service role key
   - `easymo-admin-token` - Admin API token
   - `admin-session-secret` - Session encryption secret (32+ chars)

## Quick Start

### 1. Local Docker Build & Test

```bash
# Build the image
docker build -t easymo-admin-app .

# Test locally with environment variables
docker run -p 8080:8080 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  -e EASYMO_ADMIN_TOKEN=your-admin-token \
  -e ADMIN_SESSION_SECRET=your-session-secret-min-32-chars \
  easymo-admin-app

# Verify the app is running
curl http://localhost:8080
```

### 2. Create Secrets in Secret Manager

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Create secrets (one-time setup)
echo -n "your-supabase-service-role-key" | \
  gcloud secrets create supabase-service-role --data-file=-

echo -n "your-admin-token" | \
  gcloud secrets create easymo-admin-token --data-file=-

echo -n "your-session-secret-min-32-characters" | \
  gcloud secrets create admin-session-secret --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding supabase-service-role \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding easymo-admin-token \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding admin-session-secret \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. Deploy to Cloud Run

#### Option A: Direct Deploy (Recommended)

```bash
gcloud run deploy easymo-admin-app \
  --source . \
  --region europe-west1 \
  --platform managed \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --no-allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --set-env-vars NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  --update-secrets SUPABASE_SERVICE_ROLE_KEY=supabase-service-role:latest \
  --update-secrets EASYMO_ADMIN_TOKEN=easymo-admin-token:latest \
  --update-secrets ADMIN_SESSION_SECRET=admin-session-secret:latest
```

#### Option B: Cloud Build (CI/CD)

```bash
# Deploy using cloudbuild.yaml
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions _SUPABASE_URL=https://your-project.supabase.co,_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Configure Identity-Aware Proxy (IAP)

To restrict access to internal users only:

1. Go to **Cloud Console → Security → Identity-Aware Proxy**
2. Find your Cloud Run service `easymo-admin-app`
3. Toggle IAP to **ON**
4. Click **Add Principal**
5. Add authorized users/groups (e.g., `user@yourcompany.com` or `group@yourcompany.com`)
6. Assign role: **IAP-secured Web App User**

After IAP is enabled, verify authentication is required:

```bash
# Service should already have --no-allow-unauthenticated
gcloud run services describe easymo-admin-app \
  --region europe-west1 \
  --format="value(status.url)"
```

## Environment Variables Reference

> **Complete Guide:** See [ENV_VARS_QUICK_REF.md](./ENV_VARS_QUICK_REF.md) for detailed environment variable configuration, security rules, and troubleshooting.

### Required Public Variables (Client-side Safe)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### Required Server-side Secrets

| Variable | Description | Source |
|----------|-------------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Secret Manager |
| `EASYMO_ADMIN_TOKEN` | Admin API authentication token | Secret Manager |
| `ADMIN_SESSION_SECRET` | Session encryption key (32+ chars) | Secret Manager |

### Optional Microservice URLs

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_AGENT_CORE_URL` | Agent core service endpoint | - |
| `NEXT_PUBLIC_VOICE_BRIDGE_API_URL` | Voice bridge API endpoint | - |
| `NEXT_PUBLIC_MARKETPLACE_RANKING_URL` | Ranking service endpoint | - |
| `NEXT_PUBLIC_MARKETPLACE_VENDOR_URL` | Vendor service endpoint | - |
| `NEXT_PUBLIC_MARKETPLACE_BUYER_URL` | Buyer service endpoint | - |
| `NEXT_PUBLIC_WALLET_SERVICE_URL` | Wallet service endpoint | - |

## Supabase Configuration

After deployment, configure Supabase to allow traffic from Cloud Run:

1. Go to **Supabase Dashboard → Authentication → URL Configuration**
2. Add Cloud Run URL to **Redirect URLs**:
   ```
   https://easymo-admin-app-xxxxx-uc.a.run.app/**
   ```

3. Go to **Settings → API**
4. Add Cloud Run URL to **CORS allowed origins**:
   ```
   https://easymo-admin-app-xxxxx-uc.a.run.app
   ```

## Monitoring & Logs

### View Logs

```bash
# Stream logs
gcloud run services logs tail easymo-admin-app \
  --region europe-west1

# View logs in Cloud Console
# https://console.cloud.google.com/run/detail/europe-west1/easymo-admin-app/logs
```

### Metrics

Available in Cloud Console:
- Request count
- Request latency
- Container instance count
- Memory utilization
- CPU utilization

### Health Checks

Cloud Run automatically performs health checks on port 8080. Next.js handles this internally.

**Note**: For admin-specific deployment guide with automated script, see [docs/gcp/admin-cloudrun-deploy.md](docs/gcp/admin-cloudrun-deploy.md).

## Troubleshooting

### Build Failures

**Problem**: `Cannot find '@easymo/commons'`

**Solution**: Ensure shared packages are built in the Dockerfile:
```dockerfile
RUN pnpm --filter @va/shared build && \
    pnpm --filter @easymo/commons build && \
    pnpm --filter @easymo/ui build && \
    pnpm --filter @easymo/video-agent-schema build
```

### Container Startup Failures

**Problem**: Container exits immediately

**Solution**: Check logs for environment variable issues:
```bash
gcloud run services logs read easymo-admin-app --region europe-west1 --limit 50
```

Common causes:
- Missing required environment variables
- Invalid Supabase credentials
- Session secret too short (<32 chars)

### 403 Forbidden with IAP

**Problem**: Users get 403 after IAP is enabled

**Solution**: 
1. Verify user has **IAP-secured Web App User** role
2. Check IAP is enabled for the service
3. Verify service account has Secret Manager access

### Secrets Not Loading

**Problem**: Container can't access secrets

**Solution**:
```bash
# Check secret exists
gcloud secrets describe supabase-service-role

# Verify IAM permissions
gcloud secrets get-iam-policy supabase-service-role

# Grant access if missing
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding supabase-service-role \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Security Best Practices

1. **Never use service role key in NEXT_PUBLIC_* variables**
   - Validated by `scripts/assert-no-service-role-in-client.mjs` during build
   - Service role key must only be in Secret Manager

2. **Use Secret Manager for all sensitive data**
   - Never hardcode secrets in Dockerfile or source code
   - Rotate secrets regularly

3. **Enable IAP for internal-only access**
   - Restricts access to authorized users
   - No additional authentication code needed

4. **Use least-privilege service accounts**
   - Create custom service account for Cloud Run
   - Grant only necessary permissions

5. **Enable Cloud Armor for DDoS protection** (optional)
   - Rate limiting
   - Geographic restrictions
   - IP allow/deny lists

## Cost Optimization

1. **Set min-instances to 0** for development/staging
   - Scales to zero when not in use
   - No charge for idle time

2. **Configure appropriate max-instances**
   - Prevents runaway costs
   - Set based on expected traffic

3. **Use request-based pricing**
   - Pay per request
   - More cost-effective for low-traffic apps

4. **Optimize container image size**
   - Use multi-stage builds (already implemented)
   - Alpine base image (already implemented)
   - .dockerignore excludes unnecessary files

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - id: auth
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy easymo-admin-app \
            --source . \
            --region us-central1 \
            --platform managed \
            --port 8080 \
            --set-env-vars NEXT_PUBLIC_SUPABASE_URL=${{ secrets.SUPABASE_URL }} \
            --set-env-vars NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.SUPABASE_ANON_KEY }} \
            --update-secrets SUPABASE_SERVICE_ROLE_KEY=supabase-service-role:latest \
            --update-secrets EASYMO_ADMIN_TOKEN=easymo-admin-token:latest \
            --update-secrets ADMIN_SESSION_SECRET=admin-session-secret:latest
```

# Rollback

If deployment fails, rollback to previous revision:

```bash
# List revisions
gcloud run revisions list --service easymo-admin-app --region europe-west1

# Route traffic to previous revision
gcloud run services update-traffic easymo-admin-app \
  --region europe-west1 \
  --to-revisions REVISION_NAME=100
```

## Support

For issues:
1. Check Cloud Run logs: `gcloud run services logs tail easymo-admin-app --region europe-west1`
2. Verify environment variables: `gcloud run services describe easymo-admin-app --region europe-west1`
3. Test locally with Docker first
4. Review [docs/GROUND_RULES.md](./docs/GROUND_RULES.md) for security compliance
5. See [docs/gcp/admin-cloudrun-deploy.md](docs/gcp/admin-cloudrun-deploy.md) for admin-specific deployment

## Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Identity-Aware Proxy](https://cloud.google.com/iap/docs)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)
