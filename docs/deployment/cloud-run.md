# Cloud Run Deployment

Cloud Run hosts containerized services from `services/*`.

## Build and Deploy (Cloud Build)

```bash
# Build and deploy a service
GCP_PROJECT_ID=<your-project>
SERVICE_NAME=wallet-service

gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_SERVICE_NAME=${SERVICE_NAME}
```

## Environment and Secrets
- Store secrets in Secret Manager.
- Set env vars and secrets on the Cloud Run service.

Example commands:

```bash
# Set env vars
gcloud run services update ${SERVICE_NAME} \
  --set-env-vars NODE_ENV=production,LOG_LEVEL=info

# Bind secrets
gcloud run services update ${SERVICE_NAME} \
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=projects/<id>/secrets/SUPABASE_SERVICE_ROLE_KEY:latest
```

## Logs and Health

```bash
# Read recent logs
gcloud run services logs read ${SERVICE_NAME} --limit=50
```

Use health endpoints exposed by the service (if present).

## Rollback

```bash
# List revisions
gcloud run revisions list --service ${SERVICE_NAME}

# Route 100% traffic to a previous revision
gcloud run services update-traffic ${SERVICE_NAME} \
  --to-revisions=${SERVICE_NAME}-vXYZ=100
```
