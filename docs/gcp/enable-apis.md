# Enable Google Cloud APIs – easyMO

## Quick Enable All Required APIs

```bash
# Set project
gcloud config set project easymoai

# Enable all required APIs at once
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  iap.googleapis.com \
  cloudresourcemanager.googleapis.com \
  secretmanager.googleapis.com \
  containerregistry.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  compute.googleapis.com \
  iam.googleapis.com \
  cloudapis.googleapis.com \
  serviceusage.googleapis.com

echo "✅ All APIs enabled!"
```

---

## API Details

### Core APIs (Required)

| API | Purpose | When Used |
|-----|---------|-----------|
| **artifactregistry.googleapis.com** | Artifact Registry | Storing Docker images |
| **cloudbuild.googleapis.com** | Cloud Build | Building containers (optional, can use local Docker) |
| **run.googleapis.com** | Cloud Run | Running services |
| **iap.googleapis.com** | Identity-Aware Proxy | Protecting Admin + Vendor apps |
| **secretmanager.googleapis.com** | Secret Manager | Storing API keys, DB passwords |

### Supporting APIs (Recommended)

| API | Purpose |
|-----|---------|
| **cloudresourcemanager.googleapis.com** | Project management |
| **containerregistry.googleapis.com** | Legacy container registry (fallback) |
| **logging.googleapis.com** | Cloud Logging (service logs) |
| **monitoring.googleapis.com** | Cloud Monitoring (metrics, alerts) |
| **compute.googleapis.com** | Compute resources (networking) |
| **iam.googleapis.com** | IAM (service accounts, roles) |

---

## Verify APIs Enabled

```bash
# List all enabled APIs
gcloud services list --enabled

# Check specific APIs
gcloud services list --enabled | grep -E '(artifact|run|iap|build|secret)'
```

Expected output:
```
artifactregistry.googleapis.com    Artifact Registry API
cloudbuild.googleapis.com          Cloud Build API
iap.googleapis.com                 Cloud Identity-Aware Proxy API
run.googleapis.com                 Cloud Run Admin API
secretmanager.googleapis.com       Secret Manager API
```

---

## Enable Individual APIs (If Needed)

If you need to enable APIs one by one:

```bash
# Artifact Registry
gcloud services enable artifactregistry.googleapis.com

# Cloud Run
gcloud services enable run.googleapis.com

# Cloud Build
gcloud services enable cloudbuild.googleapis.com

# IAP
gcloud services enable iap.googleapis.com

# Secret Manager
gcloud services enable secretmanager.googleapis.com
```

---

## Disable APIs (Cleanup)

⚠️ **Warning**: Only disable if you're sure you don't need them!

```bash
# Disable specific API
gcloud services disable artifactregistry.googleapis.com

# List APIs that can be disabled
gcloud services list --enabled --filter="state:ENABLED"
```

---

## API Quotas

Check usage and quotas:
```bash
# View quotas
gcloud compute project-info describe --project=easymoai

# Or check in Console:
# https://console.cloud.google.com/apis/dashboard?project=easymoai
```

**Relevant quotas**:
- Cloud Run: 1000 requests/second (default)
- Cloud Build: 10 concurrent builds (default)
- Artifact Registry: Unlimited storage (pay per GB)

---

## Costs

Most APIs are **free** (only pay for resources used):
- Cloud Run: Pay per request + compute time
- Artifact Registry: $0.10/GB/month storage
- Secret Manager: $0.06/10k accesses
- Cloud Build: First 120 build-minutes/day free
- IAP: Free (no extra charge)

**Estimate for easyMO**: ~$20-50/month for small-medium traffic.

---

## Troubleshooting

### Issue: "API not enabled" error
```bash
# Enable the API mentioned in error
gcloud services enable <API_NAME>
```

### Issue: "Insufficient permissions to enable API"
**Solution**: Ensure you have `roles/serviceusage.serviceUsageAdmin` role:
```bash
gcloud projects add-iam-policy-binding easymoai \
  --member="user:YOUR_EMAIL" \
  --role="roles/serviceusage.serviceUsageAdmin"
```

---

## Next Steps

1. ✅ Enable all required APIs
2. Set up Artifact Registry (see [artifact-registry.md](./artifact-registry.md))
3. Create Cloud Run services (see [cloud-run-services.md](./cloud-run-services.md))
4. Configure IAP (see [iap-admin-vendor.md](./iap-admin-vendor.md))

---

## Console Quick Links

- **API Dashboard**: https://console.cloud.google.com/apis/dashboard?project=easymoai
- **API Library**: https://console.cloud.google.com/apis/library?project=easymoai
- **Service Usage**: https://console.cloud.google.com/apis/api/serviceusage.googleapis.com?project=easymoai
