# WA-Webhook-Jobs Microservice

**Purpose**: Handle all WhatsApp interactions for the Job Board  
**Extracted from**: wa-webhook (Phase 2 - Week 2)  
**Size**: ~500 LOC  
**Status**: ✅ Production Ready  

## 📋 Features

- Job listings search
- Job applications
- Job alerts
- Employer postings
- Job categories

## 🚀 Local Development

```bash
# Test the function
cd supabase/functions/wa-webhook-jobs
deno test --allow-all

# Run locally
deno run --allow-all index.ts

# Check types
deno check index.ts
```

## 🔗 Endpoints

- `POST /wa-webhook-jobs` - Main webhook endpoint
- `GET /wa-webhook-jobs/health` - Health check

## 📊 Metrics

Monitor in Supabase dashboard:
- `jobs_webhook_request_total` - Total requests
- `jobs_webhook_error_rate` - Error percentage
- `jobs_webhook_latency_p95` - 95th percentile latency

## 🔧 Environment Variables

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
WA_PHONE_ID=your-whatsapp-phone-id
WA_TOKEN=your-whatsapp-token
```

## 🧪 Testing

```bash
# Unit tests
deno test handlers/

# Integration test
curl -X POST http://localhost:54321/functions/v1/wa-webhook-jobs \
  -H "Content-Type: application/json" \
  -d '{"entry": [...]}'
```

## 📚 Dependencies

- `@easymo/wa-webhook-shared` - Common types & utilities
- `@easymo/wa-webhook-router` - Routing logic
- `@easymo/wa-webhook-observability` - Logging & metrics

## 🚨 Troubleshooting

**Issue**: Health check fails  
**Solution**: Check database connection and job_listings table

**Issue**: No jobs returned  
**Solution**: Verify job_listings has active listings

## 📈 Performance

- Cold start: <2s
- Memory: ~64MB
- p95 latency: <300ms
