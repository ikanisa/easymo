# 🚀 EasyMO AI - Production Deployment Checklist

Complete guide to deploying the AI platform to production.

---

## 📋 Pre-Deployment

### 1. Code Review
- [ ] All phases tested locally
- [ ] No console.log() in production code
- [ ] Error handling implemented
- [ ] Rate limits configured appropriately
- [ ] Security audit completed

### 2. Environment Variables
- [ ] Create production `.env.local`
- [ ] All secrets stored securely (not in code)
- [ ] API keys validated and working
- [ ] Feature flags configured

**Required Variables:**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG... # ⚠️ SERVER ONLY

# OpenAI
OPENAI_API_KEY=sk-proj-xxxxx # ⚠️ SERVER ONLY
OPENAI_ORG_ID=org-xxxxx

# Google (Optional)
GOOGLE_AI_API_KEY=AIzaxxxxx
GOOGLE_MAPS_API_KEY=AIzaxxxxx
GOOGLE_SEARCH_API_KEY=AIzaxxxxx
GOOGLE_SEARCH_ENGINE_ID=xxxxx

# Feature Flags
ENABLE_OPENAI_REALTIME=true
ENABLE_GEMINI_LIVE=true
ENABLE_IMAGE_GENERATION=true
ENABLE_GOOGLE_SEARCH_GROUNDING=true
```

### 3. Database Setup
- [ ] Supabase project created
- [ ] pgvector extension enabled
- [ ] All migrations applied
- [ ] RLS policies configured
- [ ] Backup strategy in place

**Enable pgvector:**
```sql
-- In Supabase SQL Editor
create extension if not exists vector;
```

**Apply migrations:**
```bash
supabase db push
```

---

## 🏗️ Build & Deploy

### Option A: Vercel

#### 1. Install Vercel CLI
```bash
npm install -g vercel
```

#### 2. Deploy
```bash
cd admin-app
vercel --prod
```

#### 3. Set Environment Variables
```bash
# Via Vercel CLI
vercel env add OPENAI_API_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Or via Vercel Dashboard:
# Project Settings → Environment Variables
```

#### 4. Configure Build Settings
- **Framework Preset:** Next.js
- **Root Directory:** `admin-app`
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`

### Option B: Netlify

#### 1. Install Netlify CLI
```bash
npm install -g netlify-cli
```

#### 2. Deploy
```bash
cd admin-app
netlify deploy --prod
```

#### 3. Set Environment Variables
```bash
# Via Netlify CLI
netlify env:set OPENAI_API_KEY sk-proj-xxxxx

# Or via Netlify Dashboard:
# Site Settings → Environment Variables
```

#### 4. Configure Build Settings
- **Build Command:** `npm run build`
- **Publish Directory:** `.next`
- **Functions Directory:** `netlify/functions`

### Option C: Docker

#### 1. Build Image
```bash
cd admin-app
docker build -t easymo-ai:latest .
```

#### 2. Run Container
```bash
docker run -d \
  -p 3000:3000 \
  -e OPENAI_API_KEY=sk-proj-xxxxx \
  -e SUPABASE_SERVICE_ROLE_KEY=xxxxx \
  --name easymo-ai \
  easymo-ai:latest
```

#### 3. Docker Compose (Recommended)
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: ./admin-app
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    env_file:
      - .env.production
    restart: unless-stopped
```

```bash
docker-compose up -d
```

---

## 🔒 Security

### 1. API Keys
- [ ] Never expose service role key to client
- [ ] Use environment variables (not hardcoded)
- [ ] Rotate keys regularly
- [ ] Monitor API usage for anomalies

### 2. Rate Limiting
- [ ] Configure appropriate limits per endpoint
- [ ] Consider upgrading to Redis for distributed rate limiting
- [ ] Set up alerts for rate limit violations

**Production Rate Limits (Recommended):**
```typescript
// lib/middleware/rate-limit.ts
export const RATE_LIMITS = {
  api: { requests: 1000, window: 60 },      // 1000/min
  streaming: { requests: 100, window: 60 },  // 100/min
  agents: { requests: 50, window: 60 },      // 50/min
};
```

### 3. CORS
- [ ] Configure allowed origins
- [ ] Restrict to production domains only

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://yourdomain.com' },
        ],
      },
    ];
  },
};
```

### 4. Authentication
- [ ] Enable Supabase RLS policies
- [ ] Require authentication for all sensitive endpoints
- [ ] Implement role-based access control (RBAC)

---

## 📊 Monitoring

### 1. Analytics Setup
- [ ] Analytics dashboard accessible
- [ ] Cost tracking enabled
- [ ] Usage alerts configured
- [ ] Error monitoring active

### 2. External Monitoring (Recommended)

#### Sentry (Error Tracking)
```bash
npm install @sentry/nextjs
```

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

#### OpenTelemetry (Performance)
```bash
npm install @opentelemetry/api @opentelemetry/sdk-node
```

### 3. Cost Alerts

**OpenAI:**
- Set up usage alerts in OpenAI dashboard
- Monitor: https://platform.openai.com/usage

**Google AI:**
- Enable billing alerts in Google Cloud Console
- Set budget thresholds

**Recommended Alerts:**
- Daily spend > $50
- Monthly spend > $500
- Error rate > 5%
- P95 latency > 2s

---

## 🧪 Testing

### Pre-Deployment Tests

```bash
# 1. Build test
cd admin-app
npm run build

# 2. Lint
npm run lint

# 3. Type check
npm run type-check

# 4. Run tests
npm test

# 5. E2E tests (if available)
npm run test:e2e
```

### Post-Deployment Smoke Tests

```bash
# Test endpoints
curl https://yourdomain.com/api/health

curl -X POST https://yourdomain.com/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Test"}]}'

curl https://yourdomain.com/api/analytics?type=all
```

---

## 📈 Performance Optimization

### 1. Caching
- [ ] Enable Next.js caching
- [ ] Implement Redis for session storage
- [ ] Cache frequent RAG queries

```typescript
// Cache configuration
export const revalidate = 60; // 60 seconds

export async function GET() {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
    },
  });
}
```

### 2. Database
- [ ] Enable connection pooling
- [ ] Optimize vector search indexes
- [ ] Set up read replicas (if needed)

```sql
-- Optimize vector index
create index documents_embedding_idx 
on documents using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Analyze table
analyze documents;
```

### 3. CDN
- [ ] Configure CDN for static assets
- [ ] Enable edge caching
- [ ] Optimize images

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        working-directory: ./admin-app
        run: npm ci
        
      - name: Run tests
        working-directory: ./admin-app
        run: npm test
        
      - name: Build
        working-directory: ./admin-app
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          working-directory: ./admin-app
```

---

## 📝 Post-Deployment

### 1. Verification
- [ ] All endpoints responding
- [ ] Database connections working
- [ ] Analytics collecting data
- [ ] No errors in logs

### 2. Documentation
- [ ] Update API documentation
- [ ] Document production URLs
- [ ] Share deployment guide with team

### 3. Monitoring
- [ ] Set up uptime monitoring
- [ ] Configure alerting
- [ ] Monitor first 24 hours closely

### 4. Gradual Rollout
- [ ] Start with 10% traffic
- [ ] Monitor metrics
- [ ] Increase to 50% if stable
- [ ] Full rollout after 24h

---

## 🆘 Rollback Plan

### Quick Rollback

**Vercel:**
```bash
vercel rollback
```

**Netlify:**
```bash
netlify rollback
```

**Docker:**
```bash
docker pull easymo-ai:previous
docker stop easymo-ai
docker run -d --name easymo-ai easymo-ai:previous
```

### Database Rollback
```bash
# Revert last migration
supabase db reset
```

---

## 📊 Success Metrics

Track these KPIs:

- **Uptime:** > 99.9%
- **Response Time (P95):** < 500ms
- **Error Rate:** < 1%
- **API Success Rate:** > 99%
- **Cost per 1K requests:** < $0.10

---

## ✅ Final Checklist

- [ ] All environment variables set
- [ ] Database migrations applied
- [ ] pgvector extension enabled
- [ ] Build successful
- [ ] Tests passing
- [ ] Deployed to platform
- [ ] Smoke tests passed
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] Documentation updated
- [ ] Team notified
- [ ] Rollback plan ready

---

## 🎯 Production URLs

Update these after deployment:

- **App URL:** https://your-domain.com
- **API Base:** https://your-domain.com/api
- **Analytics:** https://your-domain.com/analytics
- **Status Page:** https://status.your-domain.com (if applicable)

---

**Deployment Date:** _____________  
**Deployed By:** _____________  
**Version:** 1.0.0  
**Status:** □ SUCCESS □ ISSUES (describe below)

**Notes:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

**Need Help?** See `AI_MASTER_INDEX.md` or contact DevOps team.
