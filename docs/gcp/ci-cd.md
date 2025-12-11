# CI/CD with GitHub Actions – easyMO on Google Cloud

## Overview

Automate build, push to Artifact Registry, and deploy to Cloud Run using GitHub Actions.

---

## Prerequisites

1. GCP project `easymoai` with billing enabled
2. Artifact Registry repository created
3. Cloud Run services configured
4. GitHub repository with easyMO code

---

## Service Account Setup

### 1. Create CI/CD Service Account

```bash
# Create service account
gcloud iam service-accounts create github-actions-easymo \
  --display-name="GitHub Actions - easyMO CI/CD" \
  --project=easymoai

SA_EMAIL="github-actions-easymo@easymoai.iam.gserviceaccount.com"
```

### 2. Grant Required Roles

```bash
# Artifact Registry Writer (push images)
gcloud projects add-iam-policy-binding easymoai \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

# Cloud Run Admin (deploy services)
gcloud projects add-iam-policy-binding easymoai \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

# Service Account User (deploy as service account)
gcloud projects add-iam-policy-binding easymoai \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

# Cloud Build Editor (for gcloud builds submit)
gcloud projects add-iam-policy-binding easymoai \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudbuild.builds.editor"

# Storage Object Viewer (for build artifacts)
gcloud projects add-iam-policy-binding easymoai \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectViewer"
```

### 3. Create JSON Key

```bash
# Create key file
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=${SA_EMAIL}

# Display key content (copy for GitHub Secret)
cat github-actions-key.json

# Delete local file after copying to GitHub
rm github-actions-key.json
```

---

## GitHub Secrets Setup

Go to GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository
secret**

Add these secrets:

| Secret Name                 | Value                                              | Description                                    |
| --------------------------- | -------------------------------------------------- | ---------------------------------------------- |
| `GCP_PROJECT_ID`            | `easymoai`                                         | GCP project ID                                 |
| `GCP_SA_KEY`                | `{...}`                                            | Service account JSON key (entire file content) |
| `GCP_REGION`                | `europe-west1`                                     | Deployment region                              |
| `GCP_ARTIFACT_REGISTRY`     | `europe-west1-docker.pkg.dev/easymoai/easymo-repo` | Registry URL                                   |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...`                                    | Supabase service role key                      |
| `OPENAI_API_KEY`            | `sk-proj-...`                                      | OpenAI API key                                 |
| `WHATSAPP_ACCESS_TOKEN`     | `EAAJ...`                                          | Meta WhatsApp token                            |
| `DATABASE_URL`              | `postgresql://...`                                 | Agent Core DB URL                              |

---

## GitHub Actions Workflows

### Workflow 1: Deploy Admin PWA

**`.github/workflows/deploy-admin.yml`**:

```yaml
name: Deploy Admin PWA to Cloud Run

on:
  push:
    branches:
      - main
    paths:
      - "admin-app/**"
      - "packages/commons/**"
      - "packages/ui/**"
      - ".github/workflows/deploy-admin.yml"
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      id-token: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2
        with:
          project_id: ${{ secrets.GCP_PROJECT_ID }}

      - name: Configure Docker for Artifact Registry
        run: |
          gcloud auth configure-docker ${{ secrets.GCP_REGION }}-docker.pkg.dev

      - name: Build and push Docker image
        run: |
          IMAGE="${{ secrets.GCP_ARTIFACT_REGISTRY }}/admin:${{ github.sha }}"
          IMAGE_LATEST="${{ secrets.GCP_ARTIFACT_REGISTRY }}/admin:latest"

          docker build \
            -f admin-app/Dockerfile \
            -t $IMAGE \
            -t $IMAGE_LATEST \
            .

          docker push $IMAGE
          docker push $IMAGE_LATEST

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy easymo-admin \
            --image ${{ secrets.GCP_ARTIFACT_REGISTRY }}/admin:${{ github.sha }} \
            --region ${{ secrets.GCP_REGION }} \
            --platform managed \
            --allow-unauthenticated=false \
            --memory 512Mi \
            --cpu 1 \
            --min-instances 0 \
            --max-instances 5 \
            --port 8080 \
            --timeout 300 \
            --set-env-vars "NODE_ENV=production,NEXT_TELEMETRY_DISABLED=1" \
            --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}" \
            --set-env-vars "NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" \
            --set-secrets "SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest"

      - name: Output service URL
        run: |
          gcloud run services describe easymo-admin \
            --region ${{ secrets.GCP_REGION }} \
            --format='value(status.url)'
```

---

### Workflow 2: Deploy WhatsApp Router

**`.github/workflows/deploy-wa-router.yml`**:

```yaml
name: Deploy WhatsApp Router to Cloud Run

on:
  push:
    branches:
      - main
    paths:
      - "services/whatsapp-webhook-worker/**"
      - "packages/**"
      - ".github/workflows/deploy-wa-router.yml"
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      id-token: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2
        with:
          project_id: ${{ secrets.GCP_PROJECT_ID }}

      - name: Configure Docker
        run: |
          gcloud auth configure-docker ${{ secrets.GCP_REGION }}-docker.pkg.dev

      - name: Build and push image
        run: |
          IMAGE="${{ secrets.GCP_ARTIFACT_REGISTRY }}/wa-router:${{ github.sha }}"
          IMAGE_LATEST="${{ secrets.GCP_ARTIFACT_REGISTRY }}/wa-router:latest"

          docker build \
            -f services/whatsapp-webhook-worker/Dockerfile \
            -t $IMAGE \
            -t $IMAGE_LATEST \
            .

          docker push $IMAGE
          docker push $IMAGE_LATEST

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy easymo-wa-router \
            --image ${{ secrets.GCP_ARTIFACT_REGISTRY }}/wa-router:${{ github.sha }} \
            --region ${{ secrets.GCP_REGION }} \
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
            --set-secrets "SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest" \
            --set-secrets "WHATSAPP_ACCESS_TOKEN=WHATSAPP_ACCESS_TOKEN:latest"
```

---

### Workflow 3: Deploy Agent Core

**`.github/workflows/deploy-agent-core.yml`**:

```yaml
name: Deploy Agent Core to Cloud Run

on:
  push:
    branches:
      - main
    paths:
      - "services/agent-core/**"
      - "packages/db/**"
      - "packages/commons/**"
      - ".github/workflows/deploy-agent-core.yml"
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      id-token: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2
        with:
          project_id: ${{ secrets.GCP_PROJECT_ID }}

      - name: Configure Docker
        run: |
          gcloud auth configure-docker ${{ secrets.GCP_REGION }}-docker.pkg.dev

      - name: Build and push image
        run: |
          IMAGE="${{ secrets.GCP_ARTIFACT_REGISTRY }}/agent-core:${{ github.sha }}"
          IMAGE_LATEST="${{ secrets.GCP_ARTIFACT_REGISTRY }}/agent-core:latest"

          docker build \
            -f services/agent-core/Dockerfile \
            -t $IMAGE \
            -t $IMAGE_LATEST \
            .

          docker push $IMAGE
          docker push $IMAGE_LATEST

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy easymo-agent-core \
            --image ${{ secrets.GCP_ARTIFACT_REGISTRY }}/agent-core:${{ github.sha }} \
            --region ${{ secrets.GCP_REGION }} \
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
            --set-secrets "DATABASE_URL=DATABASE_URL:latest" \
            --set-secrets "SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest" \
            --set-secrets "OPENAI_API_KEY=OPENAI_API_KEY:latest"
```

---

### Workflow 4: Deploy All Services

**`.github/workflows/deploy-all.yml`**:

```yaml
name: Deploy All Services to Cloud Run

on:
  workflow_dispatch:
    inputs:
      services:
        description: 'Services to deploy (comma-separated or "all")'
        required: true
        default: "all"

jobs:
  deploy-admin:
    if:
      contains(github.event.inputs.services, 'all') || contains(github.event.inputs.services,
      'admin')
    uses: ./.github/workflows/deploy-admin.yml
    secrets: inherit

  deploy-vendor:
    if:
      contains(github.event.inputs.services, 'all') || contains(github.event.inputs.services,
      'vendor')
    uses: ./.github/workflows/deploy-vendor.yml
    secrets: inherit

  deploy-wa-router:
    if:
      contains(github.event.inputs.services, 'all') || contains(github.event.inputs.services,
      'wa-router')
    uses: ./.github/workflows/deploy-wa-router.yml
    secrets: inherit

  deploy-agent-core:
    if:
      contains(github.event.inputs.services, 'all') || contains(github.event.inputs.services,
      'agent-core')
    uses: ./.github/workflows/deploy-agent-core.yml
    secrets: inherit
```

---

## Using Cloud Build (Alternative to Docker Build in Actions)

**Option**: Use `gcloud builds submit` instead of local Docker build for faster builds.

Replace build step:

```yaml
- name: Build and push with Cloud Build
  run: |
    gcloud builds submit \
      --tag ${{ secrets.GCP_ARTIFACT_REGISTRY }}/admin:${{ github.sha }} \
      --dockerfile admin-app/Dockerfile \
      .

    # Tag as latest
    gcloud artifacts docker tags add \
      ${{ secrets.GCP_ARTIFACT_REGISTRY }}/admin:${{ github.sha }} \
      ${{ secrets.GCP_ARTIFACT_REGISTRY }}/admin:latest
```

**Benefits**:

- Faster (no upload time from GitHub to GCP)
- Caching in Cloud Build
- Build logs in Cloud Logging

---

## Manual Trigger

Trigger deployment manually from GitHub:

1. Go to **Actions** tab
2. Select workflow (e.g., "Deploy Admin PWA")
3. Click **Run workflow**
4. Select branch → **Run workflow**

---

## Rollback Strategy

### Option 1: Re-deploy previous commit

```bash
# In GitHub Actions, checkout specific commit
git checkout abc123
# Run deployment workflow
```

### Option 2: Traffic splitting

```yaml
# Deploy new version without traffic
- name: Deploy new revision (no traffic)
  run: |
    gcloud run deploy easymo-admin \
      --image $IMAGE \
      --no-traffic \
      --tag v${{ github.sha }}

# Test new revision at: https://v{sha}---easymo-admin-xxx.a.run.app

# Shift traffic gradually
- name: Shift 10% traffic to new revision
  run: |
    gcloud run services update-traffic easymo-admin \
      --to-tags v${{ github.sha }}=10 \
      --region ${{ secrets.GCP_REGION }}

# Full cutover
- name: Full traffic to new revision
  run: |
    gcloud run services update-traffic easymo-admin \
      --to-latest \
      --region ${{ secrets.GCP_REGION }}
```

---

## Notifications

### Slack notifications

Add to workflow:

```yaml
- name: Notify Slack on success
  if: success()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "✅ easymo-admin deployed successfully!",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*easymo-admin* deployed to Cloud Run\nCommit: ${{ github.sha }}"
            }
          }
        ]
      }

- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "❌ easymo-admin deployment failed!",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*easymo-admin* deployment failed\nCommit: ${{ github.sha }}\nCheck logs: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
            }
          }
        ]
      }
```

---

## Environment-Specific Deployments

### Staging vs Production

**Option 1**: Separate workflows

- `deploy-admin-staging.yml` (deploys `easymo-admin-staging`)
- `deploy-admin-prod.yml` (deploys `easymo-admin`)

**Option 2**: Single workflow with input

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: "Environment to deploy"
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      # ... auth steps ...

      - name: Deploy to Cloud Run
        run: |
          SERVICE_NAME="easymo-admin-${{ github.event.inputs.environment }}"
          gcloud run deploy $SERVICE_NAME \
            --image $IMAGE \
            # ... other flags
```

---

## Best Practices

1. **Pin image tags** in prod (use `${{ github.sha }}`, not `latest`)
2. **Test staging first** before prod deployments
3. **Use branch protection** (require PR approvals for main)
4. **Enable required status checks** (CI must pass before merge)
5. **Rotate service account keys** every 90 days
6. **Monitor deployment logs** in Cloud Logging
7. **Set up alerts** for failed deployments

---

## Troubleshooting

### Issue: "Permission denied" in GitHub Actions

**Solution**: Verify service account has correct roles (see "Service Account Setup")

### Issue: "Image not found in Artifact Registry"

**Solution**: Ensure `gcloud auth configure-docker` ran successfully

### Issue: "Deployment timeout"

**Solution**: Increase timeout in deploy step or check service logs

---

## Complete Example Workflow

**`.github/workflows/deploy-easymo.yml`** (all Phase 1 services):

```yaml
name: Deploy easyMO to Google Cloud Run

on:
  push:
    branches:
      - main
  workflow_dispatch:

env:
  GCP_PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  GCP_REGION: ${{ secrets.GCP_REGION }}
  REGISTRY: ${{ secrets.GCP_ARTIFACT_REGISTRY }}

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      admin: ${{ steps.filter.outputs.admin }}
      vendor: ${{ steps.filter.outputs.vendor }}
      wa-router: ${{ steps.filter.outputs.wa-router }}
      agent-core: ${{ steps.filter.outputs.agent-core }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v2
        id: filter
        with:
          filters: |
            admin:
              - 'admin-app/**'
            vendor:
              - 'waiter-pwa/**'
            wa-router:
              - 'services/whatsapp-webhook-worker/**'
            agent-core:
              - 'services/agent-core/**'

  deploy-admin:
    needs: changes
    if: needs.changes.outputs.admin == 'true'
    runs-on: ubuntu-latest
    steps:
      # ... deploy admin steps (see above) ...

  deploy-vendor:
    needs: changes
    if: needs.changes.outputs.vendor == 'true'
    runs-on: ubuntu-latest
    steps:
      # ... deploy vendor steps ...

  # ... other services ...
```

---

## Next Steps

1. Create service account and grant roles
2. Add GitHub secrets
3. Create workflow files for each service
4. Test manual deployment
5. Enable auto-deployment on push to main
6. Set up notifications

See:

- [artifact-registry.md](./artifact-registry.md) - Registry setup
- [cloud-run-services.md](./cloud-run-services.md) - Deployment commands
- [env-vars.md](./env-vars.md) - Secrets management
