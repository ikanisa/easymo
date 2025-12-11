# Identity-Aware Proxy (IAP) Setup Guide

This guide walks you through configuring Google Cloud's Identity-Aware Proxy (IAP) to restrict
access to your EasyMO admin PWA to authorized users only.

## What is IAP?

Identity-Aware Proxy (IAP) is a Google Cloud service that controls access to your cloud applications
by verifying user identity and context. IAP sits in front of your application and enforces access
policies **before** any request reaches your service.

### How IAP Works

```
User Request → IAP (Auth Check) → Allowed? → Your App
                      ↓
                   Denied → 403 Error
```

1. **User attempts to access your app** - The request first hits the IAP layer
2. **IAP authenticates the user** - Redirects to Google OAuth if not signed in
3. **IAP checks authorization** - Verifies the user is in your allowed list
4. **Request forwarded or blocked** - Only authorized users reach your application

### Benefits

✅ **Zero code changes** - IAP handles authentication externally  
✅ **Centralized access control** - Manage users/groups from GCP Console  
✅ **Google Workspace integration** - Use existing company accounts  
✅ **Audit trails** - All access attempts logged in Cloud Logging  
✅ **No VPN required** - Secure public endpoints without network complexity

## Prerequisites

Before setting up IAP, ensure you have:

- [x] **Google Cloud Project** with billing enabled
- [x] **Cloud Run or App Engine service** already deployed (see
      [CI/CD to Google Cloud Run](../README.md#cicd-to-google-cloud-run))
- [x] **Custom domain** (optional but recommended for production)
- [x] **Google Workspace** (for internal apps) or Gmail accounts (for external users)
- [x] **Owner or Editor role** on the GCP project

## Step-by-Step Setup

### 1. Configure OAuth Consent Screen

IAP requires an OAuth 2.0 consent screen to authenticate users.

#### For Internal Users (Google Workspace)

1. Go to
   [APIs & Services → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Select **Internal** user type (only available for Google Workspace organizations)
3. Click **Create**
4. Fill in required fields:
   - **App name**: `EasyMO Admin Panel`
   - **User support email**: Your email
   - **App logo**: (optional)
   - **Authorized domains**: Your domain (e.g., `easymo.app`)
   - **Developer contact**: Your email
5. Click **Save and Continue**
6. Skip **Scopes** (not needed for IAP)
7. Click **Save and Continue**, then **Back to Dashboard**

#### For External Users (Gmail/Personal Accounts)

1. Select **External** user type
2. Fill in the same fields as above
3. Add **Test users** (while in development):
   - Click **Add Users**
   - Enter email addresses of allowed testers
   - Click **Save**
4. **Note**: You'll need to publish the app to move beyond 100 test users

### 2. Enable Required APIs

```bash
# Enable IAP API
gcloud services enable iap.googleapis.com

# Enable Cloud Resource Manager API (for permission management)
gcloud services enable cloudresourcemanager.googleapis.com

# Enable Compute Engine API (for load balancers)
gcloud services enable compute.googleapis.com
```

Or use the helper script:

```bash
./scripts/enable-iap.sh --enable-apis
```

### 3. Set Up IAP for Cloud Run

#### Option A: Via GCP Console (Recommended for First-Time Setup)

1. **Create a Backend Service with Load Balancer**

   Cloud Run requires an HTTPS load balancer to use IAP:

   a. Go to
   [Network Services → Load Balancing](https://console.cloud.google.com/net-services/loadbalancing)

   b. Click **Create Load Balancer** → **HTTPS Load Balancing** → **Start Configuration**

   c. **Frontend Configuration**:
   - Protocol: `HTTPS`
   - IP: Create a new static IP
   - Certificate: Create or select an SSL certificate for your domain

   d. **Backend Configuration**:
   - Backend type: `Serverless network endpoint group`
   - Create a NEG pointing to your Cloud Run service
   - Region: Match your Cloud Run region
   - Enable **Cloud CDN** (optional)

   e. Click **Create**

2. **Enable IAP**

   a. Go to [Security → Identity-Aware Proxy](https://console.cloud.google.com/security/iap)

   b. Find your load balancer backend service in the list

   c. Toggle the **IAP** switch to **ON**

   d. If prompted, configure the OAuth consent screen (already done in Step 1)

3. **Add Authorized Users**

   a. Select your backend service (checkbox)

   b. Click **Add Principal** in the right panel

   c. Enter email addresses or groups:
   - Individual: `admin@yourcompany.com`
   - Group: `easymo-admins@yourcompany.com`
   - Domain: `yourcompany.com` (all users in domain)

   d. Select role: **IAP-secured Web App User**

   e. Click **Save**

#### Option B: Via gcloud CLI

```bash
# Set variables
export PROJECT_ID="your-project-id"
export REGION="europe-west1"
export SERVICE_NAME="easymo-admin-pwa"
export MEMBER_EMAIL="admin@yourcompany.com"

# Create backend service for Cloud Run (requires load balancer setup)
# See: https://cloud.google.com/iap/docs/enabling-cloud-run

# Enable IAP on the backend service
gcloud iap web enable \
  --resource-type=backend-services \
  --service=YOUR_BACKEND_SERVICE_NAME

# Grant access to a user
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=YOUR_BACKEND_SERVICE_NAME \
  --member="user:${MEMBER_EMAIL}" \
  --role="roles/iap.httpsResourceAccessor"

# Grant access to a Google Group
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=YOUR_BACKEND_SERVICE_NAME \
  --member="group:easymo-admins@yourcompany.com" \
  --role="roles/iap.httpsResourceAccessor"

# Grant access to an entire domain
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=YOUR_BACKEND_SERVICE_NAME \
  --member="domain:yourcompany.com" \
  --role="roles/iap.httpsResourceAccessor"
```

Or use the helper script:

```bash
./scripts/enable-iap.sh \
  --project-id=your-project-id \
  --backend-service=your-backend-service \
  --member=user:admin@yourcompany.com
```

### 4. Update Cloud Run Service (No Unauthenticated Access)

Since IAP now handles authentication, update your Cloud Run service to **deny** unauthenticated
access:

```bash
gcloud run services update ${SERVICE_NAME} \
  --region=${REGION} \
  --no-allow-unauthenticated
```

This ensures requests can **only** reach your app through the IAP-protected load balancer.

### 5. Configure DNS

Point your custom domain to the load balancer's static IP:

```bash
# Get the static IP
gcloud compute addresses list

# Create DNS A record
# your-domain.com → [STATIC_IP]
```

### 6. Test Access

#### Test as Authorized User

1. Open an **incognito window**
2. Navigate to `https://your-domain.com`
3. Sign in with an authorized Google account
4. You should reach the app successfully

#### Test as Unauthorized User

1. Open a different **incognito window**
2. Navigate to `https://your-domain.com`
3. Sign in with an **unauthorized** Google account
4. You should see: **"You don't have access"** (403 error)

### 7. Verify IAP Headers (Optional)

IAP passes user information to your app via headers. You can log these for audit trails:

```typescript
// Example: Reading IAP headers in your app
const userEmail = request.headers["x-goog-authenticated-user-email"];
const userId = request.headers["x-goog-authenticated-user-id"];

console.log("IAP User:", userEmail?.replace("accounts.google.com:", ""));
```

**Headers Available:**

- `X-Goog-Authenticated-User-Email`: User's email (prefixed with `accounts.google.com:`)
- `X-Goog-Authenticated-User-Id`: Unique user ID
- `X-Goog-IAP-JWT-Assertion`: Signed JWT (can be verified for extra security)

## Managing Access

### Add a New User

```bash
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=YOUR_BACKEND_SERVICE \
  --member="user:newadmin@yourcompany.com" \
  --role="roles/iap.httpsResourceAccessor"
```

### Remove a User

```bash
gcloud iap web remove-iam-policy-binding \
  --resource-type=backend-services \
  --service=YOUR_BACKEND_SERVICE \
  --member="user:oldadmin@yourcompany.com" \
  --role="roles/iap.httpsResourceAccessor"
```

### List Current Access

```bash
gcloud iap web get-iam-policy \
  --resource-type=backend-services \
  --service=YOUR_BACKEND_SERVICE
```

### Use Google Groups (Recommended)

Instead of managing individual users, use Google Groups:

1. Create a group: `easymo-admins@yourcompany.com`
2. Add/remove users in [Google Groups Admin](https://groups.google.com)
3. Grant IAP access to the group once:
   ```bash
   gcloud iap web add-iam-policy-binding \
     --resource-type=backend-services \
     --service=YOUR_BACKEND_SERVICE \
     --member="group:easymo-admins@yourcompany.com" \
     --role="roles/iap.httpsResourceAccessor"
   ```

## Troubleshooting

### "You don't have access" for all users

**Cause**: No IAM bindings configured

**Solution**:

```bash
# Check current policy
gcloud iap web get-iam-policy \
  --resource-type=backend-services \
  --service=YOUR_BACKEND_SERVICE

# Add yourself
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=YOUR_BACKEND_SERVICE \
  --member="user:your-email@yourcompany.com" \
  --role="roles/iap.httpsResourceAccessor"
```

### OAuth consent screen not configured

**Cause**: Skipped Step 1

**Solution**: Go back to [OAuth consent screen setup](#1-configure-oauth-consent-screen)

### Can't enable IAP on Cloud Run directly

**Cause**: Cloud Run requires a load balancer for IAP

**Solution**: Follow [Option A](#option-a-via-gcp-console-recommended-for-first-time-setup) to
create a load balancer with serverless NEG

### Users see "403 Forbidden" after signing in

**Cause**: User authenticated but not authorized

**Solution**: Add the user's email to IAP access list (see [Add a New User](#add-a-new-user))

### IAP bypass attempts

**Cause**: Cloud Run service allows unauthenticated access

**Solution**:

```bash
gcloud run services update ${SERVICE_NAME} \
  --region=${REGION} \
  --no-allow-unauthenticated
```

## Security Best Practices

1. **Always use `--no-allow-unauthenticated`** on Cloud Run when using IAP
2. **Use Google Groups** instead of individual users for easier management
3. **Enable Cloud Logging** to audit access attempts
4. **Verify JWT tokens** in your app for critical operations (see
   [IAP JWT verification](https://cloud.google.com/iap/docs/signed-headers-howto))
5. **Rotate OAuth client secrets** periodically
6. **Use custom domains** (not `.run.app`) for production
7. **Monitor IAP metrics** in Cloud Monitoring

## Cost Considerations

IAP is **free** for the first 1,000 requests per month, then:

- $0.011 per 1,000 requests (Cloud Run)
- Load balancer costs apply (~$18/month minimum)

See [IAP pricing](https://cloud.google.com/iap/pricing) for details.

## References

- [IAP Official Documentation](https://cloud.google.com/iap/docs)
- [Enabling IAP for Cloud Run](https://cloud.google.com/iap/docs/enabling-cloud-run)
- [IAP JWT Verification](https://cloud.google.com/iap/docs/signed-headers-howto)
- [OAuth Consent Screen Setup](https://cloud.google.com/iap/docs/configure-oauth-consent-screen)
- [Managing IAP Access](https://cloud.google.com/iap/docs/managing-access)
