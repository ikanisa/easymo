# AI Architecture Phase 1 - Next Steps Checklist

**Date:** 2025-11-28  
**Status:** Implementation Complete, Awaiting Configuration

---

## ✅ Completed Tasks

- [x] Created OpenAI client (`lib/ai/providers/openai-client.ts`)
- [x] Created Gemini client (`lib/ai/providers/gemini-client.ts`)
- [x] Created multi-provider router (`lib/ai/router.ts`)
- [x] Created health check API (`app/api/ai/health/route.ts`)
- [x] Created enhanced chat API (`app/api/ai/chat/route.ts`)
- [x] Created main exports (`lib/ai/index.ts`)
- [x] Added packages to package.json
- [x] Fixed packages/ai/package.json syntax error
- [x] Created comprehensive documentation
- [x] Created setup script

---

## 📋 Manual Steps Required (You Need To Do)

### 1. Install Dependencies ⏳

```bash
cd /Users/jeanbosco/workspace/easymo
pnpm install --no-frozen-lockfile
```

**Why:** The packages added to `admin-app/package.json` need to be installed.

**Expected Duration:** 2-3 minutes

---

### 2. Get API Keys 🔑

#### OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Sign in or create account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

#### Google AI API Key
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key (starts with `AIza`)

---

### 3. Configure Environment Variables 🔐

Create or edit `admin-app/.env.local`:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...  # Your OpenAI key here
OPENAI_ORG_ID=org-...        # Optional

# Google AI Configuration
GOOGLE_AI_API_KEY=AIza...    # Your Google AI key here

# Feature Flags
ENABLE_GEMINI=true
```

**Quick Method:**
```bash
# Copy from example if it exists
cp admin-app/.env.example admin-app/.env.local

# Or run the setup script
./setup-ai-phase1.sh
```

---

### 4. Start Development Server 🚀

```bash
cd admin-app
npm run dev
```

**Expected Output:**
```
▲ Next.js 15.x.x
- Local:   http://localhost:3000
- Ready in X.Xs
```

---

### 5. Test Health Endpoint 🏥

**Terminal 1** (running dev server):
```bash
cd admin-app && npm run dev
```

**Terminal 2** (testing):
```bash
curl http://localhost:3000/api/ai/health | jq
```

**Expected Response:**
```json
{
  "openai": "healthy",
  "gemini": "healthy",
  "timestamp": "2025-11-28T..."
}
```

**Possible Responses:**
- `"healthy"` - API key is valid and working ✅
- `"not_configured"` - API key not set in .env.local ⚠️
- `"unhealthy"` - API key invalid or API down ❌

---

### 6. Test Chat Endpoint 💬

```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is 2+2?"}
    ]
  }' | jq
```

**Expected Response:**
```json
{
  "id": "uuid-here",
  "created": 1234567890,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "2+2 equals 4."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}
```

---

### 7. Test Provider Selection 🔀

#### Test with OpenAI:
```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "provider": "openai"
  }' | jq '.model'
```
Expected: `"gpt-4o-mini"`

#### Test with Gemini:
```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "provider": "gemini"
  }' | jq '.model'
```
Expected: `"gemini-2.0-flash"`

#### Test Cost-Based Routing:
```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "maxCost": "low"
  }' | jq '.model'
```
Expected: `"gemini-2.0-flash"` (cheaper model selected)

---

## 🐛 Troubleshooting

### Issue: Health endpoint returns 503

**Check:**
```bash
cat admin-app/.env.local | grep -E "(OPENAI|GOOGLE)"
```

**Solution:** Add missing API keys to `.env.local`

---

### Issue: "Module not found: @google/generative-ai"

**Solution:**
```bash
pnpm install
# or
npm install (in admin-app directory)
```

---

### Issue: "GOOGLE_AI_API_KEY not configured"

**Solution:** Add to `admin-app/.env.local`:
```bash
GOOGLE_AI_API_KEY=AIza...
```

---

### Issue: Chat returns 500 error

**Steps:**
1. Check health endpoint first
2. Look at terminal logs for specific error
3. Verify API keys are valid
4. Check if you have OpenAI/Google AI credits

---

## 📊 Verification Checklist

After completing the manual steps, verify:

- [ ] `pnpm install` completed successfully
- [ ] `admin-app/.env.local` has both API keys
- [ ] Dev server starts without errors
- [ ] Health endpoint returns 200 status
- [ ] Both providers show "healthy" status
- [ ] Chat endpoint returns valid response
- [ ] OpenAI provider works (test with `provider: "openai"`)
- [ ] Gemini provider works (test with `provider: "gemini"`)
- [ ] Cost-based routing works (test with `maxCost: "low"`)

---

## 📚 Documentation Reference

| Document | Purpose |
|----------|---------|
| `AI_PHASE1_VISUAL.txt` | Quick visual overview |
| `AI_PHASE1_COMPLETE.md` | Full documentation & API reference |
| `AI_PHASE1_SUMMARY.md` | Implementation summary & metrics |
| `AI_ARCHITECTURE_DEEP_REVIEW.md` | Complete 5-phase roadmap |
| `setup-ai-phase1.sh` | Automated setup script |

---

## 🔜 After Phase 1 is Verified

Once all checklist items above are complete and working:

### Option A: Continue to Phase 2
```bash
# Phase 2 will add:
# - Google Maps API (Places, Directions, Distance Matrix)
# - Google Search Grounding
# - Gemini Live API (voice)
```

### Option B: Integrate Phase 1 into Existing Features
```typescript
// Example: Use in existing agent code
import { routeChatRequest } from "@/lib/ai/router";

const response = await routeChatRequest({
  messages: [...conversationHistory],
  maxCost: "low"  // Save costs
});
```

---

## 💡 Quick Test Script

Save as `test-phase1.sh`:

```bash
#!/bin/bash
echo "Testing Phase 1 Implementation..."
echo ""

echo "1. Health Check:"
curl -s http://localhost:3000/api/ai/health | jq

echo ""
echo "2. Chat Test (Auto-route):"
curl -s -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hi!"}]}' | jq '.choices[0].message.content'

echo ""
echo "3. Cost-based Routing (Gemini):"
curl -s -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hi!"}],"maxCost":"low"}' | jq '.model'

echo ""
echo "✅ Phase 1 Tests Complete"
```

Run with:
```bash
chmod +x test-phase1.sh
./test-phase1.sh
```

---

## 🎯 Success Criteria

Phase 1 is **fully operational** when:

1. ✅ Health endpoint returns both providers as "healthy"
2. ✅ Chat endpoint successfully calls OpenAI
3. ✅ Chat endpoint successfully calls Gemini
4. ✅ Cost-based routing selects Gemini for `maxCost: "low"`
5. ✅ Fallback works (if one provider fails, other is used)

---

## ⏭️ Next Phase Preview

**Phase 2: Google Integrations (Week 2)**

What we'll add:
- Google Maps integration for location-based features
- Google Search grounding for factual responses
- Gemini Live API for voice interactions

Files to create:
- `admin-app/lib/integrations/google-maps.ts`
- `admin-app/lib/ai/google/search-grounding.ts`
- `admin-app/lib/ai/google/gemini-live.ts`

**Ready to start Phase 2 when Phase 1 verification is complete!**

---

**Phase 1 Status:** ✅ Implementation Complete, Awaiting Configuration  
**Your Next Action:** Follow steps 1-7 above to configure and test
