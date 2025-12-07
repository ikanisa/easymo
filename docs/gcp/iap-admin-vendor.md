# Identity-Aware Proxy (IAP) for Admin & Vendor Portal

## Overview
IAP restricts access to internal apps (Admin PWA, Vendor Portal) to authorized Google accounts only. Users authenticate with Google, then IAP checks if they have the correct role.

---

## Architecture

```
User (Google Account) 
    ↓
Google Sign-In
    ↓
Identity-Aware Proxy (IAP)
    ↓ (checks IAM role)
    ├─ ✅ Has role → Allow access
    └─ ❌ No role → 403 Forbidden
    ↓
Cloud Run Service (Admin or Vendor)
    ↓
Supabase Auth (app-level role check: admin/vendor)
```

**Two layers of auth**:
1. **IAP** (Google account must be in allowed list)
2. **Supabase** (user must have correct app role in DB)

---

## Prerequisites

1. Services deployed to Cloud Run
2. Services set with `--allow-unauthenticated=false`
3. OAuth consent screen configured

---

## Step-by-Step Setup

### 1. Configure OAuth Consent Screen

First time only:

```bash
# Open in browser
echo "https://console.cloud.google.com/apis/credentials/consent?project=easymoai"

# Configure:
# - User Type: Internal (if Google Workspace) or External
# - App name: easyMO Admin Portal
# - Support email: your@email.com
# - Scopes: email, profile, openid (default)
# - Authorized domains: easymo.rw (if using custom domain)
```

**If using Google Workspace**: Choose "Internal" to restrict to ikanisa.com domain only.

---

### 2. Enable IAP for Cloud Run Service

#### Option A: Console (Recommended for first setup)

1. Go to **Cloud Run** → https://console.cloud.google.com/run?project=easymoai
2. Click on `easymo-admin` service
3. Click **Security** tab
4. Under **Authentication**, ensure "Require authentication" is enabled
5. Click **Enable Identity-Aware Proxy**
6. Configure:
   - **Display name**: easyMO Admin Portal
   - **Support email**: your@ikanisa.com
7. Click **Save**

#### Option B: gcloud CLI

```bash
# Get service details
SERVICE_URL=$(gcloud run services describe easymo-admin \
  --region europe-west1 \
  --format="value(status.url)")

# Enable IAP (requires OAuth consent screen configured)
gcloud iap web enable \
  --resource-type=cloud-run \
  --service=easymo-admin \
  --region=europe-west1
```

---

### 3. Add Authorized Users

#### For Admin PWA

Add internal staff (ops, support, management):

```bash
# Add individual user
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=easymo-admin \
  --region=europe-west1 \
  --member="user:john@ikanisa.com" \
  --role="roles/iap.httpsResourceAccessor"

# Add Google Group (recommended)
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=easymo-admin \
  --region=europe-west1 \
  --member="group:easymo-admins@ikanisa.com" \
  --role="roles/iap.httpsResourceAccessor"

# Add multiple users at once
for EMAIL in john@ikanisa.com jane@ikanisa.com; do
  gcloud iap web add-iam-policy-binding \
    --resource-type=cloud-run \
    --service=easymo-admin \
    --region=europe-west1 \
    --member="user:${EMAIL}" \
    --role="roles/iap.httpsResourceAccessor"
done
```

#### For Vendor Portal

Add onboarded vendor Google accounts:

```bash
# Add vendor user
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=easymo-vendor \
  --region=europe-west1 \
  --member="user:bar@gmail.com" \
  --role="roles/iap.httpsResourceAccessor"

# Add vendors group
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=easymo-vendor \
  --region=europe-west1 \
  --member="group:easymo-vendors@ikanisa.com" \
  --role="roles/iap.httpsResourceAccessor"
```

---

### 4. Verify IAP Access

```bash
# List IAP members for Admin service
gcloud iap web get-iam-policy \
  --resource-type=cloud-run \
  --service=easymo-admin \
  --region=europe-west1

# Expected output:
# bindings:
# - members:
#   - user:john@ikanisa.com
#   - group:easymo-admins@ikanisa.com
#   role: roles/iap.httpsResourceAccessor
```

---

## Vendor Onboarding Workflow

When adding a new vendor (bar/restaurant):

### 1. Create Vendor in Admin App
Admin creates vendor business in Admin PWA, collects Google account email.

### 2. Add to IAP
```bash
VENDOR_EMAIL="newbar@gmail.com"

gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=easymo-vendor \
  --region=europe-west1 \
  --member="user:${VENDOR_EMAIL}" \
  --role="roles/iap.httpsResourceAccessor"

echo "✅ ${VENDOR_EMAIL} can now access Vendor Portal"
```

### 3. Create Supabase User Record
In Supabase DB, create user with `role='vendor'` and link to business.

### 4. Send Onboarding Email
```
Subject: Welcome to easyMO Vendor Portal

Hi [Vendor Name],

Your vendor account is ready!

1. Visit: https://easymo-vendor-xxx.a.run.app
2. Sign in with: [vendor@gmail.com]
3. Complete your business profile

Support: support@easymo.rw
```

---

## Testing IAP

### Test as authorized user
```bash
# Open in browser (will prompt for Google sign-in)
SERVICE_URL=$(gcloud run services describe easymo-admin --region europe-west1 --format="value(status.url)")
open $SERVICE_URL
```

Expected flow:
1. Redirected to Google Sign-In
2. If authorized: Access granted → App loads
3. If unauthorized: `403 Forbidden` error

### Test as unauthorized user
Use incognito mode with different Google account → Should see 403 error.

---

## Custom Error Pages (Optional)

Create custom 403 page for better UX:

In app (e.g., `admin-app/middleware.ts` or Next.js layout):
```typescript
// Check if IAP headers exist
const iapEmail = req.headers['x-goog-authenticated-user-email'];
const iapId = req.headers['x-goog-authenticated-user-id'];

if (!iapEmail) {
  return new Response('Forbidden: IAP authentication required', { 
    status: 403 
  });
}

// Extract email from format: accounts.google.com:user@example.com
const userEmail = iapEmail.split(':')[1];

// Verify user in Supabase has admin role
// ...
```

---

## Removing Access

```bash
# Remove individual user
gcloud iap web remove-iam-policy-binding \
  --resource-type=cloud-run \
  --service=easymo-admin \
  --region=europe-west1 \
  --member="user:exemployee@ikanisa.com" \
  --role="roles/iap.httpsResourceAccessor"

# Remove group
gcloud iap web remove-iam-policy-binding \
  --resource-type=cloud-run \
  --service=easymo-admin \
  --region=europe-west1 \
  --member="group:old-group@ikanisa.com" \
  --role="roles/iap.httpsResourceAccessor"
```

---

## App-Level Role Verification

IAP ensures **Google account** is allowed. Apps must verify **Supabase role**:

### In Admin App (`admin-app/middleware.ts`):
```typescript
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  // IAP provides authenticated user email
  const iapEmail = req.headers.get('x-goog-authenticated-user-email');
  
  if (!iapEmail) {
    return new Response('Unauthorized', { status: 401 });
  }

  const email = iapEmail.split(':')[1]; // Extract email

  // Check Supabase role
  const supabase = createServerClient(/* ... */);
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('email', email)
    .single();

  if (user?.role !== 'admin') {
    return new Response('Forbidden: Admin role required', { status: 403 });
  }

  // Allow request
  return NextResponse.next();
}
```

### In Vendor Portal (`waiter-pwa/middleware.ts`):
```typescript
// Similar, but check role === 'vendor'
if (user?.role !== 'vendor') {
  return new Response('Forbidden: Vendor role required', { status: 403 });
}
```

---

## Using Google Groups (Recommended)

**Benefits**:
- Centralized management
- Easy onboarding/offboarding
- Audit trail

**Setup**:
1. Create Google Groups in Google Workspace:
   - `easymo-admins@ikanisa.com`
   - `easymo-vendors@ikanisa.com`
2. Add members via Google Admin Console
3. Grant group IAP access (one time)
4. New members automatically get access

```bash
# Grant access to group
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=easymo-admin \
  --region=europe-west1 \
  --member="group:easymo-admins@ikanisa.com" \
  --role="roles/iap.httpsResourceAccessor"

# Now add/remove users via Google Groups UI
```

---

## Monitoring & Auditing

### View IAP access logs
```bash
gcloud logging read '
  resource.type="cloud_run_revision"
  AND jsonPayload.@type="type.googleapis.com/google.cloud.audit.AuditLog"
  AND protoPayload.authenticationInfo.principalEmail!=""
' --limit 50 --format json
```

### Set up alerts for unauthorized access attempts
```bash
# Create log-based metric for 403 errors
gcloud logging metrics create iap_unauthorized_access \
  --description="IAP 403 Forbidden attempts" \
  --log-filter='
    resource.type="cloud_run_revision"
    AND httpRequest.status=403
  '

# Create alert policy
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="IAP Unauthorized Access Alert" \
  --condition-display-name="High 403 rate" \
  --condition-threshold-value=5 \
  --condition-threshold-duration=60s
```

---

## Custom Domains with IAP

If using custom domains:

```bash
# Map domain
gcloud run domain-mappings create \
  --service easymo-admin \
  --domain admin.easymo.rw \
  --region europe-west1

# IAP automatically applies to custom domain
# No additional config needed
```

DNS setup:
```
Type: CNAME
Name: admin
Value: ghs.googlehosted.com
```

---

## Troubleshooting

### Issue: "OAuth consent screen not configured"
**Solution**: Configure OAuth consent screen first (see Step 1)

### Issue: "User gets 403 even though added to IAP"
**Checks**:
1. User signed in with correct Google account?
2. Run `gcloud iap web get-iam-policy` to verify user listed
3. Wait 1-2 minutes for IAM propagation
4. Clear browser cache

### Issue: "Service unavailable" after enabling IAP
**Solution**: Ensure service has `--allow-unauthenticated=false`:
```bash
gcloud run services update easymo-admin \
  --region europe-west1 \
  --allow-unauthenticated=false
```

---

## Helper Script: Add Vendor to IAP

**scripts/gcp-add-vendor-iap.sh**:
```bash
#!/bin/bash
set -e

VENDOR_EMAIL=$1

if [ -z "$VENDOR_EMAIL" ]; then
  echo "Usage: ./scripts/gcp-add-vendor-iap.sh vendor@gmail.com"
  exit 1
fi

REGION=europe-west1
SERVICE=easymo-vendor

echo "Adding ${VENDOR_EMAIL} to Vendor Portal IAP..."

gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=${SERVICE} \
  --region=${REGION} \
  --member="user:${VENDOR_EMAIL}" \
  --role="roles/iap.httpsResourceAccessor"

SERVICE_URL=$(gcloud run services describe ${SERVICE} --region ${REGION} --format="value(status.url)")

echo "✅ ${VENDOR_EMAIL} can now access Vendor Portal"
echo "Send this URL: ${SERVICE_URL}"
```

Usage:
```bash
chmod +x scripts/gcp-add-vendor-iap.sh
./scripts/gcp-add-vendor-iap.sh newvendor@gmail.com
```

---

## Security Best Practices

1. **Use Google Groups** for easier management
2. **Regularly audit** IAP access lists
3. **Remove access** immediately when users leave
4. **Combine IAP + app roles** (defense in depth)
5. **Enable audit logs** for compliance

---

## Next Steps

1. ✅ Configure OAuth consent screen
2. Enable IAP for Admin & Vendor services
3. Add initial users/groups
4. Test access with authorized/unauthorized accounts
5. Implement app-level role checks
6. Set up monitoring alerts

See:
- [cloud-run-services.md](./cloud-run-services.md) - Service deployment
- [ci-cd.md](./ci-cd.md) - Automate IAP in CI/CD
