# Admin App Cloud Run Deployment

**Quick Reference** for deploying the EasyMO Admin Panel to Google Cloud Run (Internal-Only).

## TL;DR

```bash
# One-command deployment
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
./scripts/deploy-admin-cloudrun.sh
```

---

## Prerequisites

### 1. GCP Setup

- **Project**: `easymoai`
- **Region**: `europe-west1`
- **Artifact Registry**: `easymo-repo` (already exists)

### 2. Required APIs (auto-enabled by script)

- Cloud Build API
- Cloud Run API
- Artifact Registry API
- Secret Manager API

### 3. Required Secrets (create once)

Create in Google Secret Manager:

```bash
# Service role key (server-side only)
echo -n "your-supabase-service-role-key" | \
  gcloud secrets create supabase-service-role --data-file=-

# Admin API token
echo -n "your-admin-token" | \
  gcloud secrets create easymo-admin-token --data-file=-

# Session secret (min 32 characters)
echo -n "your-session-secret-min-32-characters" | \
  gcloud secrets create admin-session-secret --data-file=-
```

Grant Cloud Run access:

```bash
PROJECT_NUMBER=$(gcloud projects describe easymoai --format="value(projectNumber)")
for secret in supabase-service-role easymo-admin-token admin-session-secret; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

---

## Deployment Methods

### Option 1: Automated Script (Recommended)

```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"

# Deploy
./scripts/deploy-admin-cloudrun.sh
```

**What it does**:

1. ✅ Validates prerequisites (gcloud, project, auth)
2. ✅ Checks required APIs are enabled
3. ✅ Verifies Secret Manager secrets exist
4. ✅ Builds Docker image via Cloud Build
5. ✅ Deploys to Cloud Run with internal-only access
6. ✅ Verifies deployment and IAM policies

### Option 2: Cloud Build Only

Build image only (no deployment):

```bash
gcloud builds submit \
  --config=cloudbuild.admin.yaml \
  --region=europe-west1
```

Build + Deploy:

```bash
gcloud builds submit \
  --config=cloudbuild.admin.deploy.yaml \
  --substitutions="_SUPABASE_URL=https://your-project.supabase.co,_SUPABASE_ANON_KEY=your-anon-key" \
  --region=europe-west1
```

### Option 3: Manual gcloud Commands

```bash
# 1. Build image locally (for testing)
docker build -f Dockerfile.admin -t easymo-admin-local .

# 2. Deploy to Cloud Run
gcloud run deploy easymo-admin-app \
  --image=europe-west1-docker.pkg.dev/easymoai/easymo-repo/admin:latest \
  --region=europe-west1 \
  --platform=managed \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=300 \
  --no-allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --set-env-vars NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  --update-secrets SUPABASE_SERVICE_ROLE_KEY=supabase-service-role:latest \
  --update-secrets EASYMO_ADMIN_TOKEN=easymo-admin-token:latest \
  --update-secrets ADMIN_SESSION_SECRET=admin-session-secret:latest
```

---

## Configuration

### Environment Variables

| Variable                        | Type   | Example                   | Notes                  |
| ------------------------------- | ------ | ------------------------- | ---------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public | `https://xxx.supabase.co` | Client-safe            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | `eyJhbG...`               | Client-safe            |
| `SUPABASE_SERVICE_ROLE_KEY`     | Secret | `eyJhbG...`               | ⚠️ Secret Manager only |
| `EASYMO_ADMIN_TOKEN`            | Secret | `your-token`              | ⚠️ Secret Manager only |
| `ADMIN_SESSION_SECRET`          | Secret | `min-32-chars`            | ⚠️ Secret Manager only |

### Cloud Run Service Configuration

- **Name**: `easymo-admin-app`
- **Region**: `europe-west1`
- **Port**: `8080`
- **Memory**: `1Gi`
- **CPU**: `1`
- **Min Instances**: `0` (scales to zero)
- **Max Instances**: `10`
- **Timeout**: `300s`
- **Access**: **Internal-only** (`--no-allow-unauthenticated`)

---

## Access Control

### Internal-Only Access (Current)

Service is deployed with `--no-allow-unauthenticated`. Only authenticated requests allowed.

**Test access** (will return 403 if not authorized):

```bash
curl https://easymo-admin-app-xxxxx-ew.a.run.app
```

### Configure Identity-Aware Proxy (IAP)

For team-based access control:

1. Go to [IAP Console](https://console.cloud.google.com/security/iap?project=easymoai)
2. Find service: `easymo-admin-app`
3. Toggle IAP: **ON**
4. Add principals (users/groups)
5. Assign role: **IAP-secured Web App User**

**Grant access to user**:

```bash
gcloud run services add-iam-policy-binding easymo-admin-app \
  --region=europe-west1 \
  --member="user:admin@example.com" \
  --role="roles/run.invoker"
```

---

## Verification

### Check Deployment Status

```bash
gcloud run services describe easymo-admin-app --region=europe-west1
```

### View Logs

```bash
# Stream live logs
gcloud run services logs tail easymo-admin-app --region=europe-west1

# Recent logs
gcloud run services logs read easymo-admin-app --region=europe-west1 --limit=50
```

### Test Service

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe easymo-admin-app \
  --region=europe-west1 \
  --format="value(status.url)")

echo "Service URL: $SERVICE_URL"

# Test (requires authentication)
gcloud run services proxy easymo-admin-app --region=europe-west1
# Then visit http://localhost:8080 in browser
```

---

## Troubleshooting

### Build Failures

**Problem**: `ERR_PNPM_BROKEN_LOCKFILE`

**Solution**: Lockfile already fixed. If issue persists:

```bash
rm pnpm-lock.yaml
pnpm install --ignore-scripts
git add pnpm-lock.yaml
```

**Problem**: Workspace package not found

**Solution**: Ensure shared packages are built in Dockerfile:

```dockerfile
RUN pnpm --filter @va/shared build
RUN pnpm --filter @easymo/commons build
RUN pnpm --filter @easymo/ui build
RUN pnpm --filter @easymo/video-agent-schema build
```

### Deployment Failures

**Problem**: Secrets not found

**Solution**: Verify secrets exist:

```bash
gcloud secrets list --project=easymoai
```

**Problem**: 403 Forbidden

**Solution**: Grant yourself invoker role:

```bash
gcloud run services add-iam-policy-binding easymo-admin-app \
  --region=europe-west1 \
  --member="user:$(gcloud config get-value account)" \
  --role="roles/run.invoker"
```

---

## Cost Optimization

- **Min instances: 0** → Scales to zero when idle (no cost)
- **E2_HIGHCPU_8** machine for builds → Faster builds, lower total cost
- **100GB disk** → Adequate for monorepo + node_modules
- **.gcloudignore** → Reduces build context, faster uploads

**Estimated costs** (light usage):

- Cloud Run: ~$0-5/month (scales to zero)
- Cloud Build: ~$0.003/build-minute
- Artifact Registry: ~$0.10/GB/month storage

---

## Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Identity-Aware Proxy](https://cloud.google.com/iap/docs)
- [Artifact Registry](https://cloud.google.com/artifact-registry/docs)

---

## Files

### Deployment Infrastructure

- `Dockerfile.admin` - Multi-stage Docker build
- `cloudbuild.admin.yaml` - Image build only
- `cloudbuild.admin.deploy.yaml` - Build + deploy pipeline
- `scripts/deploy-admin-cloudrun.sh` - Automated deployment script
- `.gcloudignore` - Build context optimization

### Documentation

- `CLOUD_RUN_DEPLOYMENT.md` - General Cloud Run guide
- `docs/gcp/admin-cloudrun-deploy.md` - This file (admin-specific)
- `GCP_DEPLOYMENT_SUMMARY.md` - Overall GCP architecture

---

**Last Updated**: 2025-12-09  
**Status**: ✅ Production Ready  
**Scope**: Admin Panel Only (vendor portal deployment is separate)
