# 🚀 EasyMO AI - Quick Start Guide

Get your AI platform running in 5 minutes!

## Prerequisites

- Node.js 20+
- pnpm 10.18.3+ (or npm)
- Supabase account
- OpenAI API key

## Step 1: Environment Setup (2 minutes)

Create `admin-app/.env.local`:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=sk-proj-xxxxx

# Optional (for full features)
GOOGLE_AI_API_KEY=AIzaxxxxx
GOOGLE_MAPS_API_KEY=AIzaxxxxx
```

## Step 2: Database Setup (1 minute)

```bash
# Enable pgvector and run migrations
supabase db push
```

## Step 3: Install & Run (2 minutes)

```bash
cd admin-app
npm install
npm run dev
```

Open http://localhost:3000

## Step 4: Test It!

### Test Chat API

```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Test Streaming

```bash
curl -X POST http://localhost:3000/api/ai/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Count to 10"}]
  }'
```

### Test RAG

```bash
# Add a document
curl -X POST http://localhost:3000/api/ai/rag \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add_document",
    "content": "EasyMO is a mobility platform in Rwanda"
  }'

# Query it
curl -X POST http://localhost:3000/api/ai/rag \
  -H "Content-Type: application/json" \
  -d '{
    "action": "query",
    "question": "What is EasyMO?"
  }'
```

### View Analytics

```bash
curl http://localhost:3000/api/analytics?type=all | jq
```

## 🎯 What's Available

✅ Chat completions (OpenAI & Gemini)  
✅ Streaming chat  
✅ OpenAI Assistants  
✅ RAG with vector search  
✅ Multi-modal (images, audio)  
✅ Google Maps integration  
✅ Rate limiting  
✅ Analytics dashboard  

## 🔜 Next Steps

1. **Create an Assistant:**
   ```bash
   curl -X POST http://localhost:3000/api/ai/assistants \
     -H "Content-Type: application/json" \
     -d '{
       "action": "create",
       "name": "Support Bot",
       "instructions": "You help EasyMO users"
     }'
   ```

2. **Add Knowledge Base:**
   - Upload documents via `/api/ai/rag`
   - Documents are automatically chunked and embedded
   - Query with citations

3. **Enable Features:**
   - Set `GOOGLE_AI_API_KEY` for Gemini
   - Set `GOOGLE_MAPS_API_KEY` for location services
   - Configure rate limits in `lib/middleware/rate-limit.ts`

## 📚 Documentation

- **Full Guide:** `AI_MASTER_INDEX.md`
- **API Reference:** See "API Reference" section in master index
- **Phase Details:** `AI_PHASE*_COMPLETE.md` files

## 🆘 Troubleshooting

**Error: "OpenAI API key not found"**
- Check `.env.local` has `OPENAI_API_KEY`
- Restart dev server

**Error: "Cannot find module @/lib/..."**
- Run `npm install` in `admin-app/`

**RAG queries return no results:**
- Check pgvector is enabled: `create extension vector;`
- Run migration: `supabase db push`

**Rate limit errors:**
- Adjust limits in `lib/middleware/rate-limit.ts`
- Default: 100 req/min

## 💡 Tips

- Use `provider: "gemini"` for cheaper requests
- Enable caching for repeated queries
- Monitor costs via analytics dashboard
- Use assistants for stateful conversations
- Use RAG for knowledge-based queries

---

**Ready to deploy?** See `AI_MASTER_INDEX.md` → Deployment section

**Need help?** Check phase-specific documentation files
