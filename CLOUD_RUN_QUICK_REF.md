# Cloud Run Deployment - Quick Reference

## 🚀 Quick Deploy Commands

### Local Test
```bash
docker build -t easymo-admin-app .
docker run -p 8080:8080 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-role \
  -e EASYMO_ADMIN_TOKEN=your-token \
  -e ADMIN_SESSION_SECRET=min-32-chars-secret \
  easymo-admin-app
```

### Deploy to Cloud Run
```bash
gcloud run deploy easymo-admin-app \
  --source . \
  --region us-central1 \
  --port 8080 \
  --memory 1Gi \
  --set-env-vars NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
  --set-env-vars NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  --update-secrets SUPABASE_SERVICE_ROLE_KEY=supabase-service-role:latest \
  --update-secrets EASYMO_ADMIN_TOKEN=easymo-admin-token:latest \
  --update-secrets ADMIN_SESSION_SECRET=admin-session-secret:latest
```

## 📋 Required Environment Variables

### Public (Client-safe)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

### Server-only (Secret Manager)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `EASYMO_ADMIN_TOKEN` - Admin API token  
- `ADMIN_SESSION_SECRET` - Session secret (32+ chars)

## 🔒 IAP Setup (Internal-only Access)

1. Console → Security → Identity-Aware Proxy
2. Enable IAP for `easymo-admin-app`
3. Add authorized users/groups
4. Update service: `gcloud run services update easymo-admin-app --no-allow-unauthenticated`

## 🔍 Monitoring

```bash
# View logs
gcloud run services logs tail easymo-admin-app --region us-central1

# Describe service
gcloud run services describe easymo-admin-app --region us-central1

# List revisions
gcloud run revisions list --service easymo-admin-app --region us-central1
```

## ⚙️ Files Created

- `Dockerfile` - Production multi-stage build for Next.js
- `.dockerignore` - Optimized build context
- `cloudbuild.yaml` - Updated for Cloud Build CI/CD
- `verify-cloudrun-config.sh` - Environment validation script
- `CLOUD_RUN_DEPLOYMENT.md` - Complete deployment guide
- `README.md` - Updated with Cloud Run section

## 📚 Documentation

See `CLOUD_RUN_DEPLOYMENT.md` for complete guide including:
- Secret Manager setup
- Supabase configuration
- Troubleshooting
- CI/CD integration
- Security best practices
