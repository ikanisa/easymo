# Marketplace Webhook - Quick Start Guide

## 🚀 Just Deployed Phase 1? Start Here!

### Prerequisites Checklist
```bash
# Required environment variables
export GEMINI_API_KEY=your_key
export WA_ACCESS_TOKEN=your_token  
export WA_PHONE_NUMBER_ID=your_id
export FEATURE_MARKETPLACE_AI=true

# Optional (already set in Supabase)
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
export WA_VERIFY_TOKEN=...
```

### Deploy in 3 Commands
```bash
# 1. Apply database migration (if not already)
supabase db push

# 2. Deploy function
supabase functions deploy wa-webhook-marketplace --no-verify-jwt

# 3. Verify
curl https://your-project.supabase.co/functions/v1/wa-webhook-marketplace
# Should return: {"status":"healthy","service":"wa-webhook-marketplace","aiEnabled":true}
```

## 📸 Testing Photo Uploads

### Test Flow
1. Send to WhatsApp: "I want to sell my laptop"
2. Agent asks: "How much?"
3. You: "500000 RWF"
4. Agent asks: "Where are you located?"
5. You: [Share location]
6. Agent: "Would you like to add photos?"
7. **YOU: [Send photo]** ✨ NEW!
8. Agent: "✅ Photo 1 uploaded! Send another or type 'done'"

### Verify Upload
```sql
-- Check if storage bucket exists
SELECT * FROM storage.buckets WHERE name = 'marketplace-images';

-- See uploaded photos
SELECT * FROM storage.objects 
WHERE bucket_id = 'marketplace-images' 
ORDER BY created_at DESC LIMIT 5;

-- Check listing has photos
SELECT id, title, photos 
FROM marketplace_listings 
WHERE photos IS NOT NULL AND array_length(photos, 1) > 0
ORDER BY created_at DESC LIMIT 5;
```

## 🔍 Monitoring

### Real-time Logs
```bash
# Watch all events
supabase functions logs wa-webhook-marketplace --tail

# Filter photo uploads only
supabase functions logs wa-webhook-marketplace | grep MEDIA_

# Filter errors only  
supabase functions logs wa-webhook-marketplace | grep ERROR
```

### Key Events
```
✅ MEDIA_DOWNLOADED     - Photo downloaded from WhatsApp
✅ MEDIA_UPLOADED       - Photo uploaded to storage
✅ LISTING_PHOTO_ADDED  - Photo added to listing
❌ MEDIA_DOWNLOAD_ERROR - WhatsApp download failed
❌ MEDIA_UPLOAD_ERROR   - Storage upload failed
```

## 🧪 Running Tests

### All Tests
```bash
cd supabase/functions/wa-webhook-marketplace
deno test --allow-env --allow-net __tests__/*.test.ts
```

### Without API Keys (unit tests only)
```bash
deno test --allow-env __tests__/media.test.ts
```

### With Gemini API (integration tests)
```bash
export GEMINI_API_KEY=your_key
export SUPABASE_URL=your_url
export SUPABASE_SERVICE_ROLE_KEY=your_key
deno test --allow-env --allow-net __tests__/*.test.ts
```

## 🐛 Troubleshooting

### Photo Upload Not Working
```bash
# 1. Check environment variables
echo $WA_ACCESS_TOKEN    # Must be set
echo $WA_PHONE_NUMBER_ID # Must be set

# 2. Check storage bucket exists
# Run SQL above to verify

# 3. Check function logs for errors
supabase functions logs wa-webhook-marketplace | grep -A 5 MEDIA_

# 4. Test WhatsApp API access
curl -H "Authorization: Bearer $WA_ACCESS_TOKEN" \
  https://graph.facebook.com/v18.0/me
# Should return WhatsApp Business Account info
```

### AI Agent Not Responding
```bash
# 1. Check feature flag
echo $FEATURE_MARKETPLACE_AI  # Should be "true"

# 2. Check Gemini API key
echo $GEMINI_API_KEY  # Should be set

# 3. Check agent errors in logs
supabase functions logs wa-webhook-marketplace | grep -i gemini
```

### Database Tables Missing
```bash
# Apply migration
supabase db push

# Verify tables
psql $DATABASE_URL -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'marketplace_%'
ORDER BY table_name;
"
```

## 📊 Success Metrics

### Check These Metrics
```sql
-- Total listings with photos
SELECT 
  COUNT(*) FILTER (WHERE array_length(photos, 1) > 0) as with_photos,
  COUNT(*) as total_listings,
  ROUND(100.0 * COUNT(*) FILTER (WHERE array_length(photos, 1) > 0) / COUNT(*), 2) as photo_percentage
FROM marketplace_listings
WHERE status = 'active';

-- Average photos per listing
SELECT 
  AVG(array_length(photos, 1)) as avg_photos_per_listing,
  MAX(array_length(photos, 1)) as max_photos
FROM marketplace_listings
WHERE photos IS NOT NULL;

-- Recent uploads
SELECT 
  seller_phone,
  title,
  array_length(photos, 1) as photo_count,
  created_at
FROM marketplace_listings
WHERE photos IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

## 🎯 Next Steps (Phase 2)

### Priority 1: Payment Integration
```bash
# TODO: Create transaction table migration
# TODO: Integrate MoMo API
# TODO: Add payment webhook handler
```

### Priority 2: Buyer Intent Persistence
```bash
# TODO: Save buyer searches when no results
# TODO: Auto-notify when matching listing created
```

### Priority 3: Production Hardening
```bash
# TODO: Add rate limiting (Redis)
# TODO: Add content moderation
# TODO: Implement listing expiry
```

## 📚 Documentation

- **Full Implementation Details**: `supabase/functions/wa-webhook-marketplace/PHASE1_COMPLETE.md`
- **Executive Summary**: `MARKETPLACE_PHASE1_IMPLEMENTATION_SUMMARY.md`
- **Original Audit**: See the comprehensive audit document provided
- **Ground Rules**: `docs/GROUND_RULES.md` (observability, security)

## 🆘 Getting Help

### Check Logs
```bash
# Function logs
supabase functions logs wa-webhook-marketplace

# Database logs  
supabase db logs

# Storage logs
# Check Supabase dashboard → Storage → Logs
```

### Common Issues
| Issue | Solution |
|-------|----------|
| "supabaseUrl is required" | Set SUPABASE_URL env var |
| "GEMINI_API_KEY is required" | Set GEMINI_API_KEY env var |
| Storage upload fails | Check bucket exists, verify permissions |
| WhatsApp download fails | Check WA_ACCESS_TOKEN is valid |
| Tests fail | 3 tests need Gemini API, others should pass |

### File Locations
```
supabase/functions/wa-webhook-marketplace/
├── index.ts           # Main webhook handler
├── agent.ts           # AI agent logic
├── media.ts           # Photo upload (NEW!)
├── __tests__/         # Test suite (NEW!)
└── PHASE1_COMPLETE.md # Documentation (NEW!)
```

---

**Quick Deploy**: `./deploy-marketplace-phase1.sh`  
**Test**: `deno test __tests__/*.test.ts`  
**Monitor**: `supabase functions logs wa-webhook-marketplace --tail`  
**Success**: Photo uploads working? ✅ Phase 1 complete!
