# Artifact Registry Setup – easyMO

## Project Information

- **GCP Project**: `easymoai`
- **Region**: `europe-west1` (Belgium – closest to Rwanda/East Africa)
- **Repository Name**: `easymo-repo`
- **Format**: Docker

---

## Prerequisites

### 1. Install gcloud CLI

```bash
# macOS
brew install google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install
```

### 2. Authenticate & Set Project

```bash
# Login to GCP
gcloud auth login

# Set default project
gcloud config set project easymoai

# Verify
gcloud config get-value project
# Output: easymoai
```

### 3. Configure Docker for Artifact Registry

```bash
# Authenticate Docker to Artifact Registry
gcloud auth configure-docker europe-west1-docker.pkg.dev

# This adds credential helper to ~/.docker/config.json
```

---

## Enable Required APIs

```bash
# Enable all required GCP services
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  iap.googleapis.com \
  cloudresourcemanager.googleapis.com \
  secretmanager.googleapis.com \
  containerregistry.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com

# Verify enabled services
gcloud services list --enabled | grep -E '(artifact|run|iap|build)'
```

Expected output:

```
artifactregistry.googleapis.com    Artifact Registry API
cloudbuild.googleapis.com          Cloud Build API
run.googleapis.com                 Cloud Run Admin API
iap.googleapis.com                 Cloud Identity-Aware Proxy API
```

---

## Create Artifact Registry Repository

```bash
# Create Docker repository
gcloud artifacts repositories create easymo-repo \
  --repository-format=docker \
  --location=europe-west1 \
  --description="Docker images for easyMO services on Cloud Run"

# Verify creation
gcloud artifacts repositories list --location=europe-west1
```

Expected output:

```
REPOSITORY    FORMAT  LOCATION       ...
easymo-repo   DOCKER  europe-west1   ...
```

---

## Image Naming Convention

All images follow this pattern:

```
europe-west1-docker.pkg.dev/easymoai/easymo-repo/<SERVICE_NAME>:<TAG>
```

### Service Images

| Service            | Image URL                                                                    |
| ------------------ | ---------------------------------------------------------------------------- |
| Admin PWA          | `europe-west1-docker.pkg.dev/easymoai/easymo-repo/admin:latest`              |
| Vendor Portal      | `europe-west1-docker.pkg.dev/easymoai/easymo-repo/vendor:latest`             |
| Client PWA         | `europe-west1-docker.pkg.dev/easymoai/easymo-repo/client:latest`             |
| Voice Bridge       | `europe-west1-docker.pkg.dev/easymoai/easymo-repo/voice-bridge:latest`       |
| WA Router          | `europe-west1-docker.pkg.dev/easymoai/easymo-repo/wa-router:latest`          |
| Agent Core         | `europe-west1-docker.pkg.dev/easymoai/easymo-repo/agent-core:latest`         |
| Voice Media Server | `europe-west1-docker.pkg.dev/easymoai/easymo-repo/voice-media:latest`        |
| Voice Media Bridge | `europe-west1-docker.pkg.dev/easymoai/easymo-repo/voice-media-bridge:latest` |
| WhatsApp Voice     | `europe-west1-docker.pkg.dev/easymoai/easymo-repo/whatsapp-voice:latest`     |
| Mobility           | `europe-west1-docker.pkg.dev/easymoai/easymo-repo/mobility:latest`           |
| Ranking            | `europe-west1-docker.pkg.dev/easymoai/easymo-repo/ranking:latest`            |
| Wallet             | `europe-west1-docker.pkg.dev/easymoai/easymo-repo/wallet:latest`             |
| Video              | `europe-west1-docker.pkg.dev/easymoai/easymo-repo/video:latest`              |

---

## Build & Push Images

### Option 1: Local Docker Build + Push

```bash
# Set variables
export REGION=europe-west1
export PROJECT_ID=easymoai
export REPO=easymo-repo

# Example: Admin PWA
cd /path/to/easymo
docker build -f admin-app/Dockerfile -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/admin:latest .
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/admin:latest

# Example: Agent Core (monorepo service)
docker build -f services/agent-core/Dockerfile -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/agent-core:latest .
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/agent-core:latest
```

### Option 2: Cloud Build (Recommended for CI/CD)

```bash
# Submit build to Cloud Build (builds in GCP, faster for large images)
gcloud builds submit \
  --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/admin:latest \
  --dockerfile admin-app/Dockerfile \
  .

# For services in subdirectories
gcloud builds submit \
  --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/agent-core:latest \
  --dockerfile services/agent-core/Dockerfile \
  .
```

Cloud Build benefits:

- Faster (runs in GCP, no upload time)
- Build logs in Cloud Logging
- Integrates with GitHub triggers
- Automatic caching

---

## Helper Scripts

### Build & Push Script (`scripts/gcp-build-push.sh`)

```bash
#!/bin/bash
set -e

REGION=${REGION:-europe-west1}
PROJECT_ID=${PROJECT_ID:-easymoai}
REPO=${REPO:-easymo-repo}

SERVICE_NAME=$1
DOCKERFILE_PATH=$2

if [ -z "$SERVICE_NAME" ] || [ -z "$DOCKERFILE_PATH" ]; then
  echo "Usage: ./scripts/gcp-build-push.sh <service-name> <dockerfile-path>"
  echo "Example: ./scripts/gcp-build-push.sh admin admin-app/Dockerfile"
  exit 1
fi

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE_NAME}:latest"

echo "Building ${SERVICE_NAME}..."
docker build -f ${DOCKERFILE_PATH} -t ${IMAGE} .

echo "Pushing to Artifact Registry..."
docker push ${IMAGE}

echo "✅ ${SERVICE_NAME} pushed successfully!"
echo "Image: ${IMAGE}"
```

Usage:

```bash
chmod +x scripts/gcp-build-push.sh
./scripts/gcp-build-push.sh admin admin-app/Dockerfile
./scripts/gcp-build-push.sh agent-core services/agent-core/Dockerfile
```

### Build All Services (`scripts/gcp-build-all.sh`)

```bash
#!/bin/bash
set -e

# Phase 1 services
./scripts/gcp-build-push.sh admin admin-app/Dockerfile
./scripts/gcp-build-push.sh vendor waiter-pwa/Dockerfile
./scripts/gcp-build-push.sh wa-router services/whatsapp-webhook-worker/Dockerfile
./scripts/gcp-build-push.sh agent-core services/agent-core/Dockerfile

# Phase 2 services
./scripts/gcp-build-push.sh voice-bridge services/voice-bridge/Dockerfile
./scripts/gcp-build-push.sh client client-pwa/Dockerfile

echo "✅ All images built and pushed!"
```

---

## View & Manage Images

### List all images

```bash
gcloud artifacts docker images list ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}
```

### View specific image tags

```bash
gcloud artifacts docker tags list ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/admin
```

### Delete old images

```bash
# Delete specific tag
gcloud artifacts docker images delete ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/admin:old-tag

# Delete untagged images (cleanup)
gcloud artifacts docker images list ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO} \
  --include-tags \
  --filter="-tags:*" \
  --format="get(package)" | xargs -I {} gcloud artifacts docker images delete {}
```

---

## Access Control (IAM)

### For CI/CD Service Account

Create a service account for GitHub Actions:

```bash
# Create service account
gcloud iam service-accounts create github-actions-easymo \
  --display-name="GitHub Actions - easyMO CI/CD"

# Grant permissions
gcloud projects add-iam-policy-binding easymoai \
  --member="serviceAccount:github-actions-easymo@easymoai.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding easymoai \
  --member="serviceAccount:github-actions-easymo@easymoai.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding easymoai \
  --member="serviceAccount:github-actions-easymo@easymoai.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create JSON key for GitHub Secrets
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions-easymo@easymoai.iam.gserviceaccount.com

# Store github-actions-key.json content in GitHub Secrets as GCP_SA_KEY
# Then delete local file
rm github-actions-key.json
```

---

## Costs & Cleanup

### Storage Costs

- First 0.5 GB/month: **Free**
- Beyond 0.5 GB: **$0.10/GB/month**

Estimate: ~50 images × 200 MB avg = 10 GB = **~$1/month**

### Cleanup Old Images

Set up lifecycle policy (auto-delete images older than 30 days):

```bash
# Create policy file: cleanup-policy.json
{
  "rules": [
    {
      "action": {"type": "Delete"},
      "condition": {
        "olderThan": "2592000s"  # 30 days
      }
    }
  ]
}

# Apply policy
gcloud artifacts repositories set-cleanup-policies easymo-repo \
  --location=europe-west1 \
  --policy=cleanup-policy.json
```

---

## Troubleshooting

### Docker authentication issues

```bash
gcloud auth configure-docker europe-west1-docker.pkg.dev
gcloud auth login
```

### Permission denied

```bash
gcloud auth application-default login
```

### Build fails with "context too large"

Add `.gcloudignore` (similar to `.dockerignore`):

```
node_modules/
.git/
dist/
build/
coverage/
*.log
```

---

## Next Steps

1. ✅ Set up Artifact Registry
2. Create missing Dockerfiles (see [docker-notes.md](./docker-notes.md))
3. Build & push images
4. Deploy to Cloud Run (see [cloud-run-services.md](./cloud-run-services.md))

See:

- [enable-apis.md](./enable-apis.md) - Full API enablement checklist
- [ci-cd.md](./ci-cd.md) - GitHub Actions automation
