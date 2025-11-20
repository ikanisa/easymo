# 🔐 Gemini API Configuration - Complete

**Date**: November 20, 2025  
**Status**: ✅ **CONFIGURED**  
**API Key**: Set in local environment

---

## ✅ Configuration Summary

### 1. Local Environment Files Updated

**File**: `.env`
```bash
GEMINI_API_KEY=AIzaSyABpKvSi5VvOKPWrIABVwIvSYAh0xTrafY
```
✅ Backup created: `.env.backup.YYYYMMDD_HHMMSS`

**File**: `supabase/.env.local`
```bash
GEMINI_API_KEY=AIzaSyABpKvSi5VvOKPWrIABVwIvSYAh0xTrafY
# OPENAI_API_KEY=sk-...  # Add your OpenAI key
```

### 2. Database Configuration

**Agent**: General Broker
- **Primary Provider**: OpenAI (`gpt-4-turbo-preview`)
- **Fallback Provider**: Gemini (`gemini-1.5-flash`)
- **Status**: Active ✅

---

## 🚀 Next Steps to Complete Deployment

### Step 1: Set Gemini API Key in Supabase (REQUIRED)

The API key is set locally but needs to be added to Supabase:

**Option A: Via Supabase Dashboard** (Recommended)
1. Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt
2. Settings → Edge Functions → Secrets
3. Add secret:
   - Name: `GEMINI_API_KEY`
   - Value: `AIzaSyABpKvSi5VvOKPWrIABVwIvSYAh0xTrafY`

**Option B: Via Supabase CLI**
```bash
supabase secrets set GEMINI_API_KEY=AIzaSyABpKvSi5VvOKPWrIABVwIvSYAh0xTrafY \
  --project-ref lhbowpbcpwoiparwnwgt
```

### Step 2: Set OpenAI API Key (REQUIRED)

The system uses OpenAI as the primary provider:

```bash
# In Supabase Dashboard → Settings → Edge Functions → Secrets
OPENAI_API_KEY=sk-your-openai-key-here
```

Or via CLI:
```bash
supabase secrets set OPENAI_API_KEY=sk-your-key \
  --project-ref lhbowpbcpwoiparwnwgt
```

### Step 3: Deploy Edge Functions

```bash
# Deploy General Broker tools (includes Gemini integration)
supabase functions deploy agent-tools-general-broker \
  --project-ref lhbowpbcpwoiparwnwgt

# Verify deployment
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/agent-tools-general-broker/health
```

---

## 🧪 Testing Gemini Integration

### Test 1: Vendor Normalization (Gemini-powered)

```bash
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/agent-tools-general-broker \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "normalize_vendor_payload",
    "userId": "test-user",
    "rawText": "Hardware shop in Kimironko, Kigali. We sell cement, paint, and iron sheets. Open Monday-Saturday 8am-6pm. Contact: 0788123456"
  }'
```

**Expected Response** (from Gemini):
```json
{
  "normalized": {
    "vendor_name": "Kimironko Hardware",
    "categories": ["hardware", "construction", "retail"],
    "description": "Hardware shop selling cement, paint, and iron sheets",
    "address": "Kimironko, Kigali",
    "opening_hours": "Monday-Saturday 8am-6pm",
    "contact_info": {
      "phone": "0788123456"
    }
  }
}
```

### Test 2: Check LLM Request Tracking

After testing, verify requests are logged:

```sql
-- Check Gemini requests
SELECT 
  provider,
  model,
  status,
  duration_ms,
  created_at
FROM llm_requests
WHERE provider = 'gemini'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 📊 Current Configuration Status

| Component | Status | Details |
|-----------|--------|---------|
| **Database Schema** | ✅ Complete | 4 tables, 3 functions, 1 view |
| **Tool Routing** | ✅ Configured | 16 tools (9 Gemini, 7 OpenAI) |
| **Agent Config** | ✅ Loaded | General Broker with dual providers |
| **Local .env** | ✅ Set | GEMINI_API_KEY configured |
| **Supabase Secret** | ⏳ Pending | Add via Dashboard/CLI |
| **Edge Functions** | ⏳ Not Deployed | Deploy with `supabase functions deploy` |
| **OpenAI Key** | ⏳ Required | Add OPENAI_API_KEY |

---

## 🔧 Model Configuration

### Gemini Models Available
Based on the configuration, the system uses:
- **gemini-1.5-flash** - Fast, cost-effective (fallback provider)
- **gemini-1.5-pro** - Higher quality (can be configured for specific agents)

### Tool Routing for Gemini

**9 Gemini-Preferred Tools:**
1. `find_vendors_nearby` - Google Maps integration
2. `normalize_vendor_payload` - Document parsing (OCR)
3. `maps_geosearch` - Geocoding
4. `extract_document_text` - PDF/image text extraction
5. `analyze_menu_image` - Restaurant menu parsing
6. `parse_property_listing` - Property details extraction
7. `research_farming_info` - Web research
8. `crawl_job_sites` - Job data scraping
9. `generate_ad_keywords` - Marketing keywords

---

## 💰 Cost Optimization

### Price Comparison (per 1K tokens)
- **OpenAI GPT-4 Turbo**: ~$0.01
- **Gemini 1.5 Flash**: ~$0.0005
- **Savings**: **95% cheaper** for Gemini tasks

### Example Savings
If you process 1,000 vendor images/day:
- **With OpenAI only**: $10/day = $300/month
- **With Gemini**: $0.50/day = $15/month
- **Savings**: $285/month = **$3,420/year**

---

## 🛡️ Security Notes

### API Key Storage
✅ **Local**: Stored in `.env` (gitignored)  
⏳ **Supabase**: Must be added as secret (not in code)  
✅ **Database**: Provider config (no keys stored)  

### Best Practices
- ✅ Never commit API keys to git
- ✅ Use environment variables
- ✅ Rotate keys periodically
- ✅ Monitor usage in Google Cloud Console

---

## 📝 Monitoring Commands

### Check Gemini Usage
```sql
-- Daily Gemini requests
SELECT 
  DATE(created_at) as date,
  COUNT(*) as requests,
  SUM(total_tokens) as tokens,
  SUM(total_tokens) * 0.0000005 as cost_usd
FROM llm_requests
WHERE provider = 'gemini'
  AND created_at > CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Check Provider Health
```sql
-- Success rate by provider
SELECT 
  provider,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  ROUND(COUNT(*) FILTER (WHERE status = 'success') * 100.0 / COUNT(*), 2) as success_rate_pct
FROM llm_requests
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY provider;
```

---

## 🔍 Troubleshooting

### Issue: "Gemini API key not found"
**Solution**: Ensure secret is set in Supabase:
```bash
supabase secrets list --project-ref lhbowpbcpwoiparwnwgt
```

### Issue: "Model not found" error
**Solution**: The API key may need activation in Google Cloud Console:
1. Go to: https://console.cloud.google.com/
2. Enable "Generative Language API"
3. Wait 5-10 minutes for activation

### Issue: Rate limit exceeded
**Solution**: Gemini has free tier limits:
- 60 requests per minute
- 1,500 requests per day (free tier)

Upgrade at: https://ai.google.dev/pricing

---

## ✅ Checklist

- [x] **GEMINI_API_KEY set in .env**
- [x] **GEMINI_API_KEY set in supabase/.env.local**
- [x] **Database schema deployed**
- [x] **Tool routing configured**
- [x] **Agent configuration loaded**
- [ ] **GEMINI_API_KEY added to Supabase secrets** (Manual step)
- [ ] **OPENAI_API_KEY added to Supabase secrets** (Manual step)
- [ ] **Edge functions deployed** (Manual step)
- [ ] **End-to-end test completed** (After deployment)

---

## 📚 Related Documentation

- **Deployment Summary**: `DEPLOYMENT_SUCCESS_DUAL_LLM.md`
- **Implementation Guide**: `DUAL_LLM_IMPLEMENTATION_GUIDE.md`
- **Architecture Visual**: `DUAL_LLM_ARCHITECTURE_VISUAL.txt`
- **Quick Start**: `README_DUAL_LLM.md`

---

## 🎯 Status

**Local Configuration**: ✅ Complete  
**Supabase Secrets**: ⏳ Requires manual setup  
**Edge Functions**: ⏳ Ready to deploy  
**Testing**: ⏳ Pending API key activation  

**Next Action**: Add secrets to Supabase Dashboard and deploy edge functions.

---

**Configured by**: GitHub Copilot CLI  
**Date**: 2025-11-20  
**Version**: 1.0.0
