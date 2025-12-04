# 🚀 IAP Deployment - Start Here

**Your credentials are ready!** Follow these steps to deploy.

## ⚠️ Authentication Required

The deployment scripts need Google Cloud authentication. Run this **once**:

```bash
gcloud auth login
```

This will open a browser for you to authenticate with your Google account.

---

## 📋 Step-by-Step Deployment

### 1️⃣ Enable APIs & Create Infrastructure (3 min)

```bash
cd infrastructure/iap-deployment
./setup.sh
```

**What it does**:
- Enables Cloud Run, IAP, Secret Manager APIs
- Creates service account for Cloud Run
- Reserves static IP address
- Creates Secret Manager placeholders

---

### 2️⃣ Configure Secrets (2 min)

We have your Supabase credentials ready. Run:

```bash
./configure-secrets.sh
```

**Pre-configured values**:
- ✅ Supabase URL: `https://lhbowpbcpwoiparwnwgt.supabase.co`
- ✅ Service Role Key: `sbp_500607f0d078e919aa24f179473291544003a035`
- ❓ Anon Key: You'll be prompted (get from Supabase dashboard)
- ✅ Admin Token: Auto-generated (or provide your own)
- ✅ Session Secret: Auto-generated

**To get your Anon Key**:
1. Visit: https://lhbowpbcpwoiparwnwgt.supabase.co/project/default/settings/api
2. Copy the **anon public** key
3. Paste when prompted by the script

---

### 3️⃣ Deploy Application (8-10 min)

```bash
cd ../../admin-app
gcloud builds submit --config=cloudbuild.iap.yaml --project=easymo-478117
```

**What happens**:
- Builds shared packages (@easymo/commons, @va/shared)
- Builds Next.js app in standalone mode
- Creates Docker container
- Deploys to Cloud Run (no public access)

**Progress**: Watch in Cloud Console or terminal output

---

### 4️⃣ Setup Load Balancer + IAP (5 min)

```bash
cd ../infrastructure/iap-deployment
./lb-iap-setup.sh
```

**You'll be prompted for**:
- Your domain name (e.g., `admin.easymo.com`)

**What it creates**:
- Serverless Network Endpoint Group (NEG)
- Backend service with IAP enabled
- Managed SSL certificate (takes 15-60 min to provision)
- HTTPS load balancer
- Forwarding rule

---

### 5️⃣ Configure DNS (2 min)

Get your static IP:
```bash
gcloud compute addresses describe admin-app-ip --global --format="get(address)"
```

Add an **A record** in your DNS provider:
```
Type: A
Host: admin (for admin.easymo.com)
Value: <STATIC_IP from above>
TTL: 300
```

---

### 6️⃣ Configure OAuth Consent Screen (3 min)

1. Visit: https://console.cloud.google.com/apis/credentials/consent?project=easymo-478117
2. Choose **User Type**:
   - **Internal** (if using Google Workspace)
   - **External** (for any Google account)
3. Fill in:
   - App name: `EasyMO Admin Portal`
   - Support email: `info@ikanisa.com`
   - Authorized domains: `easymo.com` (your domain)
4. Add scopes: `openid`, `email`, `profile`
5. Click **Save and Continue**

---

### 7️⃣ Enable IAP (2 min)

1. Visit: https://console.cloud.google.com/security/iap?project=easymo-478117
2. Find `admin-app-backend` in the list
3. Toggle **IAP** to **ON**
4. If prompted, select the OAuth client created in step 6

---

### 8️⃣ Add Authorized Users

Grant access to users who can access the admin portal:

```bash
# Single user
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=admin-app-backend \
  --member='user:info@ikanisa.com' \
  --role='roles/iap.httpsResourceAccessor'

# Add more users
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=admin-app-backend \
  --member='user:another@ikanisa.com' \
  --role='roles/iap.httpsResourceAccessor'

# Or add a Google Group (recommended for teams)
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=admin-app-backend \
  --member='group:admins@ikanisa.com' \
  --role='roles/iap.httpsResourceAccessor'
```

---

### 9️⃣ Verify Deployment (wait 15-60 min for SSL)

Check SSL certificate status:
```bash
gcloud compute ssl-certificates describe admin-app-ssl-cert --global
```

**Status progression**:
- `PROVISIONING` → Wait (can take 15-60 minutes)
- `ACTIVE` → Ready to use!

Once **ACTIVE**, test access:
```bash
curl -I https://admin.easymo.com
```

**Expected response**: `302 Found` (redirect to Google OAuth login)

---

## ✅ Success!

Once SSL is active, visit: `https://admin.easymo.com`

You should be:
1. Redirected to Google Sign-In
2. Prompted to authorize the app
3. Redirected back to the admin portal (if authorized)

---

## 🔧 Troubleshooting

### Build Fails
```bash
# View build logs
gcloud builds list --limit=5
gcloud builds log <BUILD_ID>
```

### SSL Stuck in PROVISIONING
- Wait 15-60 minutes (Google needs to verify DNS)
- Verify DNS A record points to correct static IP
- Check: `gcloud compute addresses describe admin-app-ip --global`

### IAP Not Working
- Ensure OAuth consent screen is configured (step 6)
- Verify IAP is enabled on backend service (step 7)
- Check user has `iap.httpsResourceAccessor` role (step 8)

### 502 Bad Gateway
```bash
# Check Cloud Run logs
gcloud run services logs read admin-app-iap --region=us-central1 --limit=50
```

Common causes:
- Missing environment variables
- Service startup failure
- Health check timeout

---

## 📊 Quick Status Check

```bash
# Check all resources
gcloud run services describe admin-app-iap --region=us-central1
gcloud compute backend-services describe admin-app-backend --global
gcloud compute ssl-certificates describe admin-app-ssl-cert --global
gcloud secrets list --filter="labels.app=admin-app"

# View logs
gcloud run services logs read admin-app-iap --region=us-central1 --limit=20
```

---

## 💡 Tips

- **First deployment**: ~20-25 min (excluding SSL provisioning)
- **Updates**: ~8-10 min (just re-run step 3)
- **Cost**: ~$40-60/month for 50 internal users
- **Scaling**: Cloud Run auto-scales (0 to 10 instances)

---

## 🆘 Need Help?

1. Check troubleshooting section above
2. View Cloud Console logs
3. Review [README.md](./README.md) for detailed documentation

---

**Ready to start?** Run:

```bash
gcloud auth login
cd infrastructure/iap-deployment
./setup.sh
```
