# Admin App - IAP Deployment Guide

Deploy the EasyMO admin app as an internal-only application on Google Cloud Run with Identity-Aware Proxy (IAP).

## Architecture

```
User (Authorized via IAP)
    ↓
HTTPS Load Balancer (admin.easymo.com)
    ↓
Identity-Aware Proxy (IAP)
    ↓
Cloud Run (admin-app-iap)
    ↓
Supabase + Meta WhatsApp API
```

## Prerequisites

1. **GCP Project**: `easymo-478117` (or set `GCP_PROJECT_ID`)
2. **Domain**: Required for SSL certificate (e.g., `admin.easymo.com`)
3. **gcloud CLI**: Installed and authenticated
4. **Billing**: Enabled on GCP project
5. **Secrets**: Supabase credentials ready

## Quick Start

```bash
# 1. Setup infrastructure
cd infrastructure/iap-deployment
./setup.sh

# 2. Configure secrets (use your actual values)
echo 'https://your-project.supabase.co' | gcloud secrets versions add NEXT_PUBLIC_SUPABASE_URL --data-file=-
echo 'your-anon-key' | gcloud secrets versions add NEXT_PUBLIC_SUPABASE_ANON_KEY --data-file=-
echo 'your-service-role-key' | gcloud secrets versions add SUPABASE_SERVICE_ROLE_KEY --data-file=-
echo 'your-admin-token' | gcloud secrets versions add EASYMO_ADMIN_TOKEN --data-file=-
openssl rand -base64 32 | gcloud secrets versions add ADMIN_SESSION_SECRET --data-file=-

# 3. Deploy Cloud Run service
cd ../../admin-app
gcloud builds submit --config=cloudbuild.iap.yaml --project=easymo-478117

# 4. Configure load balancer + IAP
cd ../infrastructure/iap-deployment
./lb-iap-setup.sh

# 5. Add authorized users
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=admin-app-backend \
  --member='user:admin@yourdomain.com' \
  --role='roles/iap.httpsResourceAccessor'
```

## Deployment Steps

### 1. Initial Infrastructure Setup

```bash
cd infrastructure/iap-deployment
./setup.sh
```

This script:
- ✅ Enables required GCP APIs (Cloud Run, IAP, Secret Manager, etc.)
- ✅ Creates service account with minimal permissions
- ✅ Sets up Secret Manager for environment variables
- ✅ Reserves static IP address for load balancer

### 2. Configure Secrets

Update Secret Manager with actual values:

```bash
# Supabase configuration
echo 'https://your-project.supabase.co' | \
  gcloud secrets versions add NEXT_PUBLIC_SUPABASE_URL --data-file=-

echo 'eyJhbGciOiJI...' | \
  gcloud secrets versions add NEXT_PUBLIC_SUPABASE_ANON_KEY --data-file=-

echo 'eyJhbGciOiJI...' | \
  gcloud secrets versions add SUPABASE_SERVICE_ROLE_KEY --data-file=-

# Admin token
echo 'your-secure-admin-token' | \
  gcloud secrets versions add EASYMO_ADMIN_TOKEN --data-file=-

# Session secret (auto-generated)
openssl rand -base64 32 | \
  gcloud secrets versions add ADMIN_SESSION_SECRET --data-file=-
```

### 3. Build and Deploy Cloud Run Service

From repository root:

```bash
cd admin-app
gcloud builds submit \
  --config=cloudbuild.iap.yaml \
  --project=easymo-478117
```

This builds the Next.js app in standalone mode and deploys to Cloud Run with `--no-allow-unauthenticated`.

**Build time**: ~5-10 minutes (includes shared package builds)

### 4. Configure Load Balancer + IAP

```bash
cd ../infrastructure/iap-deployment
./lb-iap-setup.sh
```

When prompted, enter your domain (e.g., `admin.easymo.com`).

This script:
- ✅ Creates serverless NEG for Cloud Run
- ✅ Creates backend service with IAP enabled
- ✅ Creates managed SSL certificate (15-60 min provisioning)
- ✅ Creates HTTPS load balancer
- ✅ Binds static IP to load balancer

### 5. Configure DNS

Add an A record pointing to the static IP:

```bash
# Get the static IP
gcloud compute addresses describe admin-app-ip --global --format="get(address)"
```

**DNS Record**:
```
Type: A
Name: admin (for admin.easymo.com)
Value: <STATIC_IP>
TTL: 300
```

### 6. Configure OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent?project=easymo-478117
2. Set **User Type**: Internal (for Google Workspace) or External
3. Fill in application details:
   - **App name**: EasyMO Admin Portal
   - **Support email**: admin@yourdomain.com
4. Add scopes: `openid`, `email`, `profile`
5. Save and continue

### 7. Enable IAP

1. Go to: https://console.cloud.google.com/security/iap?project=easymo-478117
2. Enable IAP for `admin-app-backend` backend service
3. Configure OAuth brand if prompted

### 8. Add Authorized Users

Grant access to specific users or groups:

```bash
# Add individual user
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=admin-app-backend \
  --member='user:admin@yourdomain.com' \
  --role='roles/iap.httpsResourceAccessor'

# Add Google Group
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=admin-app-backend \
  --member='group:admins@yourdomain.com' \
  --role='roles/iap.httpsResourceAccessor'
```

### 9. Verify Deployment

Wait for SSL certificate provisioning (~15-60 minutes), then:

```bash
# Check certificate status
gcloud compute ssl-certificates describe admin-app-ssl-cert --global

# Test access (should redirect to Google Sign-In)
curl -I https://admin.easymo.com
```

**Expected**: 302 redirect to `accounts.google.com` for authentication.

## Security Features

✅ **IAP Authentication**: Only authorized users can access  
✅ **No public access**: `--no-allow-unauthenticated` on Cloud Run  
✅ **HTTPS only**: Managed SSL certificate with auto-renewal  
✅ **Security headers**: CSP, HSTS, X-Frame-Options (Next.js config)  
✅ **Secret management**: No secrets in code or env files  
✅ **Service account**: Minimal IAM permissions  
✅ **Audit logging**: Cloud Logging enabled by default  

## Cost Estimates

**Monthly cost** (estimated for ~50 internal users):

| Service | Cost |
|---------|------|
| Cloud Run (1 GB RAM, 1 vCPU) | $10-30 |
| Cloud Load Balancer | $18 + data |
| Secret Manager | $0.60 (6 secrets) |
| Static IP (reserved) | $7 |
| Container Registry storage | $2-5 |
| **Total** | **~$40-60/month** |

💡 **Cost optimization**: Cloud Run scales to zero when idle.

## Troubleshooting

### SSL Certificate Pending
```bash
gcloud compute ssl-certificates describe admin-app-ssl-cert --global
```
- **Status**: `PROVISIONING` → Wait 15-60 minutes
- **Failure**: Check DNS A record points to correct IP

### IAP Error: "OAuth Client Not Found"
1. Ensure OAuth consent screen is configured
2. Check IAP is enabled for backend service
3. Verify user has `roles/iap.httpsResourceAccessor` role

### Cloud Run Deployment Fails
```bash
# Check build logs
gcloud builds list --limit=5
gcloud builds log <BUILD_ID>
```

### 502 Bad Gateway
```bash
# Check Cloud Run logs
gcloud run services logs read admin-app-iap --region=us-central1 --limit=50
```

## Maintenance

### Update Application

```bash
cd admin-app
gcloud builds submit --config=cloudbuild.iap.yaml
```

### Add/Remove Users

```bash
# Add user
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=admin-app-backend \
  --member='user:newuser@yourdomain.com' \
  --role='roles/iap.httpsResourceAccessor'

# Remove user
gcloud iap web remove-iam-policy-binding \
  --resource-type=backend-services \
  --service=admin-app-backend \
  --member='user:olduser@yourdomain.com' \
  --role='roles/iap.httpsResourceAccessor'
```

## Related Documentation

- [GROUND_RULES.md](../../docs/GROUND_RULES.md) - Security & observability standards
- [admin-app/README.md](../../admin-app/README.md) - Application documentation
