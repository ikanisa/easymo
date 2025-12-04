# Quick Start - Admin App IAP Deployment

Deploy the admin app to Cloud Run with IAP in **4 steps** (~20 minutes + SSL provisioning).

## ⚡ TL;DR

```bash
# 1. Setup infrastructure (3 min)
cd infrastructure/iap-deployment && ./setup.sh

# 2. Add secrets (1 min)
echo 'https://xxxxx.supabase.co' | gcloud secrets versions add NEXT_PUBLIC_SUPABASE_URL --data-file=-
echo 'eyJhbG...' | gcloud secrets versions add NEXT_PUBLIC_SUPABASE_ANON_KEY --data-file=-
echo 'eyJhbG...' | gcloud secrets versions add SUPABASE_SERVICE_ROLE_KEY --data-file=-
echo 'admin-token' | gcloud secrets versions add EASYMO_ADMIN_TOKEN --data-file=-
openssl rand -base64 32 | gcloud secrets versions add ADMIN_SESSION_SECRET --data-file=-

# 3. Deploy app (8-10 min)
cd ../../admin-app && gcloud builds submit --config=cloudbuild.iap.yaml

# 4. Setup load balancer + IAP (5 min)
cd ../infrastructure/iap-deployment && ./lb-iap-setup.sh

# 5. Add users
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=admin-app-backend \
  --member='user:you@company.com' \
  --role='roles/iap.httpsResourceAccessor'
```

## 📋 Prerequisites Checklist

- [ ] GCP project created (`easymo-478117`)
- [ ] Billing enabled
- [ ] `gcloud` CLI installed and authenticated
- [ ] Domain ready for SSL certificate (e.g., `admin.easymo.com`)
- [ ] Supabase credentials ready

## 🚀 Deployment Steps

### Step 1: Infrastructure (3 min)

```bash
cd infrastructure/iap-deployment
./setup.sh
```

**Output**: Static IP, Service Account, Secret placeholders created.

### Step 2: Configure Secrets (1 min)

Replace with your actual values:

```bash
# From Supabase project settings
echo 'https://your-project.supabase.co' | \
  gcloud secrets versions add NEXT_PUBLIC_SUPABASE_URL --data-file=-

echo 'your-anon-key-here' | \
  gcloud secrets versions add NEXT_PUBLIC_SUPABASE_ANON_KEY --data-file=-

echo 'your-service-role-key-here' | \
  gcloud secrets versions add SUPABASE_SERVICE_ROLE_KEY --data-file=-

# Admin token (any secure string)
echo 'my-secure-admin-token-12345' | \
  gcloud secrets versions add EASYMO_ADMIN_TOKEN --data-file=-

# Session secret (auto-generated)
openssl rand -base64 32 | \
  gcloud secrets versions add ADMIN_SESSION_SECRET --data-file=-
```

### Step 3: Deploy App (8-10 min)

```bash
cd ../../admin-app
gcloud builds submit --config=cloudbuild.iap.yaml --project=easymo-478117
```

**What happens**:
1. Builds shared packages (`@easymo/commons`, `@va/shared`)
2. Builds Next.js app in standalone mode
3. Creates Docker image
4. Deploys to Cloud Run (no public access)

### Step 4: Load Balancer + IAP (5 min)

```bash
cd ../infrastructure/iap-deployment
./lb-iap-setup.sh
```

When prompted, enter your domain: `admin.easymo.com`

**What happens**:
1. Creates Network Endpoint Group (NEG) for Cloud Run
2. Creates backend service with IAP enabled
3. Creates SSL certificate (provisioning starts)
4. Creates HTTPS load balancer
5. Binds static IP

### Step 5: DNS Configuration (2 min)

Get static IP:
```bash
gcloud compute addresses describe admin-app-ip --global --format="get(address)"
```

Add DNS A record:
```
Type: A
Host: admin
Value: <STATIC_IP>
TTL: 300
```

### Step 6: OAuth Consent Screen (3 min)

1. Visit: https://console.cloud.google.com/apis/credentials/consent?project=easymo-478117
2. Choose **Internal** (Google Workspace) or **External**
3. App name: `EasyMO Admin Portal`
4. Support email: `admin@yourcompany.com`
5. Scopes: `openid`, `email`, `profile`
6. Save

### Step 7: Enable IAP (2 min)

1. Visit: https://console.cloud.google.com/security/iap?project=easymo-478117
2. Toggle IAP **ON** for `admin-app-backend`
3. Configure OAuth if prompted

### Step 8: Add Authorized Users

```bash
# Single user
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=admin-app-backend \
  --member='user:admin@yourcompany.com' \
  --role='roles/iap.httpsResourceAccessor'

# Google Group (recommended)
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=admin-app-backend \
  --member='group:admin-team@yourcompany.com' \
  --role='roles/iap.httpsResourceAccessor'
```

### Step 9: Verify (wait ~30-60 min for SSL)

```bash
# Check SSL certificate status
gcloud compute ssl-certificates describe admin-app-ssl-cert --global

# Once ACTIVE, test access
curl -I https://admin.easymo.com
```

**Expected**: 302 redirect to Google OAuth login.

## ✅ Success Checklist

- [ ] Cloud Run service deployed (`admin-app-iap`)
- [ ] Load balancer created (`admin-app-backend`)
- [ ] SSL certificate provisioned (ACTIVE status)
- [ ] DNS A record added
- [ ] OAuth consent screen configured
- [ ] IAP enabled on backend service
- [ ] At least one user authorized
- [ ] Access URL works (redirects to Google login)

## 🔧 Common Issues

| Issue | Solution |
|-------|----------|
| Build fails: "Cannot find @easymo/commons" | Ensure step 1 in cloudbuild.iap.yaml builds shared packages |
| SSL cert stuck in PROVISIONING | Wait 15-60 min; verify DNS points to correct IP |
| IAP error: "OAuth not configured" | Complete Step 6 (OAuth consent screen) |
| 502 Bad Gateway | Check Cloud Run logs: `gcloud run services logs read admin-app-iap --region=us-central1` |

## 📞 Troubleshooting Commands

```bash
# View build history
gcloud builds list --limit=5

# View specific build logs
gcloud builds log <BUILD_ID>

# Check Cloud Run status
gcloud run services describe admin-app-iap --region=us-central1

# View runtime logs
gcloud run services logs read admin-app-iap --region=us-central1 --limit=50

# Check SSL certificate
gcloud compute ssl-certificates describe admin-app-ssl-cert --global

# List IAP authorized users
gcloud iap web get-iam-policy --resource-type=backend-services --service=admin-app-backend
```

## 🔄 Update Deployment

```bash
cd admin-app
gcloud builds submit --config=cloudbuild.iap.yaml
```

Rolling update with zero downtime (~8-10 min).

## 📚 Full Documentation

See [README.md](./README.md) for detailed architecture, security features, and maintenance guides.

## 💰 Expected Costs

- **Initial**: ~$0 (free tier for most services)
- **Monthly**: ~$40-60 for 50 internal users
- **Per-request**: Cloud Run scales to zero when idle

---

**Need help?** Open an issue or check Cloud Run/IAP docs.
