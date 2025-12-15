# WhatsApp Webhooks Architecture – Why Keep on Supabase?

## Overview

WhatsApp webhooks remain on **Supabase Edge Functions** (Deno runtime) rather than migrating to
Google Cloud Run. This document explains the decision and provides a migration path if needed in the
future.

---

## Current Architecture

### WhatsApp Webhook Flow

```
Meta WhatsApp Cloud API
        ↓
  Webhook Event
        ↓
Supabase Edge Functions
   (wa-webhook-*)
        ↓
┌──────────────┬──────────────┬──────────────┐
│ wa-webhook-  │ wa-webhook-  │ wa-webhook-  │
│   core       │   mobility   │   commerce   │
└──────────────┴──────────────┴──────────────┘
        ↓
Supabase Database
   (Direct RLS)
        ↓
AI Agent Processing
  (OpenAI, etc.)
```

### Edge Functions on Supabase

- **Path**: `/supabase/functions/wa-webhook-*`
- **Runtime**: Deno 2.x
- **Deployment**: `supabase functions deploy`
- **Benefits**:
  - Sub-10ms latency to Supabase DB
  - Direct RLS policy access
  - Automatic auth context
  - No cold starts (always warm)
  - Built-in secrets management

---

## Why NOT Migrate to Cloud Run

### 1. Performance

**Supabase Edge Functions**:

- Deployed on same infrastructure as database
- Direct database connection (no network hop)
- Sub-10ms query latency
- Always warm (no cold starts)

**Cloud Run**:

- Separate infrastructure from Supabase
- Network latency to Supabase DB (~20-50ms)
- Cold starts possible (0-2 seconds)
- Connection pooling overhead

**Verdict**: Edge Functions are **2-5x faster** for database-heavy operations.

---

### 2. Database Access

**Supabase Edge Functions**:

- Native Supabase client with RLS
- Automatic auth context
- Direct access to `auth.users()`, storage, realtime
- No connection pool management

**Cloud Run**:

- Generic PostgreSQL client
- Manual RLS policy enforcement
- Must manage connection pooling
- No automatic auth integration

**Verdict**: Edge Functions have **first-class Supabase integration**.

---

### 3. Development Experience

**Supabase Edge Functions**:

- Local testing: `supabase functions serve`
- Integrated with Supabase CLI
- TypeScript type generation from DB schema
- Hot reload during development
- Same runtime as production

**Cloud Run**:

- Requires Docker for local testing
- Separate deployment pipeline
- Manual type generation
- More complex local setup

**Verdict**: Edge Functions have **better developer experience** for Supabase-centric apps.

---

### 4. Cost

**Supabase Edge Functions**:

- Included in Supabase plan
- 500K invocations/month (Pro plan)
- $2/million requests beyond quota
- No separate infrastructure costs

**Cloud Run**:

- Pay per request + compute time
- ~$0.40 per million requests
- Additional costs for always-warm instances
- Network egress charges to Supabase

**Estimate**: 1M WhatsApp messages/month

- **Edge Functions**: Free (within quota) or $2
- **Cloud Run**: ~$10-20 (requests + compute + egress)

**Verdict**: Edge Functions are **cheaper** at current scale.

---

### 5. Operational Complexity

**Supabase Edge Functions**:

- Single deployment command
- Managed infrastructure
- Built-in monitoring
- Automatic scaling
- No container management

**Cloud Run**:

- Docker builds required
- Artifact Registry management
- Manual scaling configuration
- Container versioning
- CI/CD pipeline complexity

**Verdict**: Edge Functions are **simpler to operate**.

---

## When to Migrate to Cloud Run

Consider migration if:

1. **High volume**: >10M messages/day (exceeds Edge Function limits)
2. **Complex compute**: CPU-intensive processing (image/video analysis)
3. **Long-running**: Operations >60 seconds (Edge Function timeout)
4. **Non-Supabase data**: Primary data source moves off Supabase
5. **Custom runtime**: Need Node.js libraries incompatible with Deno

**Current status**: None of these apply. Edge Functions are optimal.

---

## Hybrid Architecture (Recommended)

### Services on Cloud Run

1. **Admin PWA** (`easymo-admin`) - Internal staff dashboard
2. **Vendor Portal** (`easymo-vendor`) - Onboarded vendor management
3. **Voice Bridge** (`easymo-voice-bridge`) - WebRTC/SIP voice calls
4. **Voice Gateway** (`easymo-voice-gateway`) - OpenAI Realtime integration
5. **Vendor Service** (`easymo-vendor-service`) - Vendor API
6. **Agent Core** - Multi-agent orchestration (if needed)

### Services on Supabase Edge Functions

1. **wa-webhook-core** - Main WhatsApp message router
2. **wa-webhook-mobility** - Mobility/ride-sharing messages
3. **wa-webhook-commerce** - Marketplace messages
4. **wa-agent-\*** - All AI conversation handlers
5. **admin-\*** functions - Admin API endpoints
6. **openai-realtime-sip** - SIP voice integration
7. **OCR processors** - Document OCR
8. **Lookup functions** - Data enrichment

**Why this split?**

- WhatsApp webhooks → Database-heavy → Edge Functions
- Admin/Vendor PWAs → UI apps → Cloud Run
- Voice services → External APIs → Cloud Run
- AI agents → Database + OpenAI → Edge Functions

---

## Migration Path (If Needed)

If you must migrate WhatsApp webhooks to Cloud Run:

### Step 1: Create Cloud Run Service

```bash
# Build container
gcloud builds submit \
  --tag europe-west1-docker.pkg.dev/easymoai/easymo-repo/wa-webhook:latest \
  --dockerfile services/wa-webhook-router/Dockerfile \
  .

# Deploy
gcloud run deploy easymo-wa-webhook \
  --image europe-west1-docker.pkg.dev/easymoai/easymo-repo/wa-webhook:latest \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 100 \
  --port 8080 \
  --set-env-vars "NODE_ENV=production,SUPABASE_URL=$SUPABASE_URL" \
  --update-secrets "SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,WHATSAPP_VERIFY_TOKEN=whatsapp-verify-token:latest"
```

### Step 2: Update Meta WhatsApp Webhook URL

```bash
# Old: https://PROJECT.supabase.co/functions/v1/wa-webhook-core
# New: https://easymo-wa-webhook-xxx.a.run.app/webhook

# Update in Meta Business Manager
# https://developers.facebook.com/apps/YOUR_APP_ID/whatsapp-business/wa-settings/
```

### Step 3: Implement Signature Verification

```typescript
// Must verify Meta webhook signatures in Cloud Run
import crypto from "crypto";

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `sha256=${expectedSignature}` === signature;
}

// In handler
const signature = req.headers["x-hub-signature-256"];
const isValid = verifyWebhookSignature(
  JSON.stringify(req.body),
  signature,
  process.env.WHATSAPP_APP_SECRET
);
```

### Step 4: Database Connection Pooling

```typescript
// Use Supabase connection pooler for Cloud Run
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  db: {
    schema: "public",
    // Use transaction pooler for serverless
    host: "aws-0-us-west-1.pooler.supabase.com",
    port: 6543,
  },
});
```

### Step 5: Performance Testing

```bash
# Load test both endpoints
ab -n 10000 -c 100 \
  -H "x-hub-signature-256: sha256=..." \
  https://easymo-wa-webhook-xxx.a.run.app/webhook

# Compare:
# - P50, P95, P99 latency
# - Error rates
# - Database connection usage
# - Cost per 1M messages
```

---

## Architecture Diagram: Hybrid Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                  Google Cloud (easymoai)                         │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Admin    │  │ Vendor   │  │ Voice    │  │ Voice    │        │
│  │ PWA      │  │ Portal   │  │ Bridge   │  │ Gateway  │        │
│  │ (IAP 🔒) │  │ (IAP 🔒) │  │          │  │          │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│       │              │              │              │            │
│       └──────────────┴──────────────┴──────────────┘            │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Supabase                                   │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │ Database   │  │ Auth       │  │ Storage    │                │
│  │ (Postgres) │  │ (JWT+RLS)  │  │ (S3)       │                │
│  └────────────┘  └────────────┘  └────────────┘                │
│         ▲                                                        │
│         │                                                        │
│  ┌──────┴──────────────────────────────────────────────┐        │
│  │        Edge Functions (Deno)                        │        │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐      │        │
│  │  │ wa-webhook │ │ wa-webhook │ │ wa-agent-  │      │        │
│  │  │   -core    │ │ -mobility  │ │  commerce  │      │        │
│  │  └────────────┘ └────────────┘ └────────────┘      │        │
│  └─────────────────────────────────────────────────────┘        │
│         ▲                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │
          │
     ┌────┴────┐
     │  Meta   │
     │WhatsApp │
     │Cloud API│
     └─────────┘
```

**Legend**:

- 🔒 = IAP protected
- Blue = Cloud Run (public/authenticated)
- Green = Supabase Edge Functions (webhook endpoints)
- Gray = Supabase managed services

---

## Monitoring Both Platforms

### Supabase Edge Functions

```bash
# View logs
supabase functions logs wa-webhook-core

# View metrics in dashboard
# https://supabase.com/dashboard/project/YOUR_PROJECT/functions
```

### Cloud Run Services

```bash
# View logs
gcloud run services logs tail easymo-voice-bridge --region europe-west1

# View metrics
# https://console.cloud.google.com/run?project=easymoai
```

---

## Decision Summary

| Factor                 | Edge Functions | Cloud Run | Winner       |
| ---------------------- | -------------- | --------- | ------------ |
| Database Latency       | <10ms          | 20-50ms   | 🏆 Edge      |
| Supabase Integration   | Native         | Manual    | 🏆 Edge      |
| Development Speed      | Fast           | Slower    | 🏆 Edge      |
| Cost (1M msg/mo)       | $0-2           | $10-20    | 🏆 Edge      |
| Operational Complexity | Low            | Medium    | 🏆 Edge      |
| Max Throughput         | 10M/day        | 100M+/day | 🏆 Cloud Run |
| CPU-Intensive Tasks    | Limited        | Excellent | 🏆 Cloud Run |
| Custom Runtime         | Deno only      | Any       | 🏆 Cloud Run |

**Recommendation**: Keep WhatsApp webhooks on Supabase Edge Functions unless scale or compute
requirements change.

---

## References

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Deno Deploy vs Cloud Run Comparison](https://deno.com/blog/anatomy-isolate-cloud)

---

**Decision**: Keep webhooks on Supabase  
**Review Trigger**: When traffic exceeds 5M messages/day or compute requirements change
significantly
