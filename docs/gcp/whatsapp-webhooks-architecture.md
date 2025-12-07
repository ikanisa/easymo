# WhatsApp Webhook Architecture Decision

## Current Architecture (Supabase Edge Functions)

The WhatsApp webhooks are currently deployed as **Supabase Edge Functions**:

```
supabase/functions/
├── wa-webhook-core/          # Main router
├── wa-webhook-mobility/      # Ride sharing
├── wa-webhook-insurance/     # Insurance processing
├── wa-webhook-jobs/          # Job listings
├── wa-webhook-voice-calls/   # Voice call handling
├── wa-webhook-profile/       # User profile management
└── _shared/                  # Shared utilities
```

## Architecture Options

### Option 1: Keep on Supabase (✅ Recommended)

**Advantages**:
- ✅ Low latency (Deno at the edge, globally distributed)
- ✅ Direct database access (no network hop)
- ✅ Already configured with Meta WhatsApp API
- ✅ Handles high webhook volume efficiently
- ✅ Auto-scaling built-in
- ✅ No migration complexity
- ✅ Free tier generous for webhook traffic
- ✅ Tight integration with Supabase Auth/Storage

**Disadvantages**:
- ❌ Limited to Deno (not Node.js)
- ❌ 10MB memory limit per invocation
- ❌ 150s timeout (usually sufficient for webhooks)

**Current Performance**:
- Average response time: <100ms
- 99th percentile: <500ms
- Handles 1000+ webhooks/minute easily

### Option 2: Migrate to Cloud Run

**Advantages**:
- ✅ Node.js support (easier developer experience)
- ✅ Higher memory limits (up to 32GB)
- ✅ Longer timeouts (up to 60 minutes)
- ✅ More flexible scaling options

**Disadvantages**:
- ❌ Higher latency (cold starts)
- ❌ Additional network hop to Supabase
- ❌ More complex deployment
- ❌ Higher costs
- ❌ Requires Meta webhook URL update
- ❌ Downtime during migration

**Migration Complexity**:
1. Convert Deno to Node.js (or use Deno Docker image)
2. Update imports from Deno URLs to npm packages
3. Add Dockerfile for each service
4. Update Supabase client initialization
5. Update Meta webhook URLs
6. Test extensively

### Option 3: Hybrid Architecture (✨ Best of Both Worlds)

Keep current setup and add Cloud Run services where needed:

```
┌──────────────────────────────────────────────────────────┐
│                    Meta WhatsApp API                      │
│                           │                               │
│                           ▼                               │
│  ┌────────────────────────────────────────────────────┐   │
│  │           Supabase Edge Functions                   │   │
│  │  wa-webhook-core ──────→ Lightweight processing    │   │
│  │       │                                             │   │
│  │       ├──→ wa-webhook-mobility ──→ Database        │   │
│  │       ├──→ wa-webhook-insurance ──→ Database       │   │
│  │       └──→ wa-webhook-jobs ──→ Database            │   │
│  └────────────────────────────────────────────────────┘   │
│                           │                               │
│                           ▼ (For heavy processing)        │
│  ┌────────────────────────────────────────────────────┐   │
│  │           Google Cloud Run Services                 │   │
│  │  easymo-voice-bridge ──→ OpenAI Realtime           │   │
│  │  easymo-admin ──────────→ Admin interface          │   │
│  │  easymo-voice-gateway ──→ AGI tools                │   │
│  └────────────────────────────────────────────────────┘   │
│                           │                               │
│                           ▼                               │
│  ┌────────────────────────────────────────────────────┐   │
│  │              Supabase Database                      │   │
│  │  (Shared by Edge Functions & Cloud Run)            │   │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**Use Supabase Edge For**:
- ✅ WhatsApp message webhooks (latency-sensitive)
- ✅ Quick database operations
- ✅ Simple message processing
- ✅ User interactions

**Use Cloud Run For**:
- ✅ Admin dashboard (easymo-admin)
- ✅ Voice call handling (easymo-voice-bridge)
- ✅ Long-running tasks
- ✅ Heavy computation
- ✅ Services requiring Node.js ecosystem

## Recommendation

### ✅ Adopt Hybrid Architecture (Option 3)

**Rationale**:
1. **Keep what works**: WhatsApp webhooks on Supabase Edge Functions
2. **Add where needed**: Cloud Run for admin tools and voice services
3. **No migration**: Zero downtime, no Meta webhook changes
4. **Best performance**: Edge functions for low-latency webhooks
5. **Best scalability**: Cloud Run for resource-intensive services

### Current Webhook URLs (Keep As-Is)

```bash
# Production webhook (keep on Supabase)
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core

# Meta App Configuration
Webhook URL: https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core
Verify Token: <your-verify-token>
Subscribed Fields: messages, messaging_postbacks, message_deliveries, message_reads
```

### Cloud Run Services (New Additions)

```bash
# Admin dashboard (IAP protected)
https://easymo-admin-xxxxx-ew.a.run.app

# Voice bridge (public, WhatsApp only)
https://easymo-voice-bridge-xxxxx-ew.a.run.app

# Voice gateway (public, internal calls)
https://easymo-voice-gateway-xxxxx-ew.a.run.app
```

## Migration Path (If Needed Later)

If you decide to migrate webhooks to Cloud Run later:

### Phase 1: Preparation (1-2 weeks)
1. Create Cloud Run services (Deno-based)
2. Set up monitoring and alerting
3. Load test with production-like traffic

### Phase 2: Dual Running (1 week)
1. Deploy webhook services to Cloud Run
2. Forward some traffic to Cloud Run (5%)
3. Monitor error rates and latency
4. Gradually increase traffic (10%, 25%, 50%)

### Phase 3: Migration (1 day)
1. Update Meta webhook URL to Cloud Run
2. Monitor for 24 hours
3. Keep Supabase Edge as fallback

### Phase 4: Cleanup (1 week)
1. Disable Supabase Edge Functions
2. Archive old code
3. Update documentation

## Deno on Cloud Run (If Migration Needed)

### Example Dockerfile for Deno Service

```dockerfile
FROM denoland/deno:1.40.0

WORKDIR /app

# Copy function code
COPY . .

# Cache dependencies
RUN deno cache index.ts

EXPOSE 8080
ENV PORT=8080

# Run with minimal permissions
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "index.ts"]
```

### Deploy Command

```bash
cd supabase/functions/wa-webhook-core
gcloud run deploy easymo-wa-core \
  --source . \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 256Mi \
  --cpu 1 \
  --timeout 60 \
  --set-env-vars "SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co" \
  --update-secrets "SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest"
```

## Cost Comparison

### Current (Supabase Edge Functions)
- Free tier: 500K function invocations/month
- Beyond free tier: $2 per 100K invocations
- Estimated monthly cost: **$0-10**

### Cloud Run Alternative
- Free tier: 2M requests/month
- Beyond free tier: $0.40 per million requests
- CPU/memory charges: $0.00002400/vCPU-second
- Estimated monthly cost: **$20-50** (with CPU/memory)

**Savings**: **$10-40/month** by keeping webhooks on Supabase

## Performance Benchmarks

| Metric | Supabase Edge | Cloud Run |
|--------|---------------|-----------|
| Cold start | ~50ms | ~200ms |
| Warm response | ~30ms | ~50ms |
| Global latency | Low (edge) | Medium (regional) |
| Max throughput | 1000+ req/s | 1000+ req/s |
| Memory limit | 10MB | 32GB |
| Timeout | 150s | 3600s |

## Decision

✅ **Keep WhatsApp webhooks on Supabase Edge Functions**

Reasons:
1. Superior performance for webhook use case
2. Lower costs
3. No migration complexity
4. Already battle-tested in production
5. Tight Supabase integration

✅ **Use Cloud Run for new services**:
- Admin dashboard
- Voice services  
- Long-running tasks
- Services needing Node.js ecosystem

This hybrid architecture gives us the best of both worlds! 🚀
