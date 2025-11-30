# 🚀 Netlify Deployment Guide - EasyMO Admin App with AI Agents

## 📋 Overview

This guide covers deploying the Next.js admin application with complete AI agent capabilities to Netlify.

**Deployment URL**: https://easymo-admin.netlify.app (customize in Netlify dashboard)

---

## ⚡ Quick Deploy

### Option 1: Netlify CLI (Recommended)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Navigate to admin app
cd admin-app

# Login to Netlify
netlify login

# Initialize and deploy
netlify init

# Build and deploy
npm run build
netlify deploy --prod
```

### Option 2: GitHub Integration

1. **Connect Repository**
   - Go to https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub → Select `ikanisa/easymo`

2. **Configure Build Settings**
   ```
   Base directory: admin-app
   Build command: npm run build
   Publish directory: admin-app/.next
   ```

3. **Deploy**
   - Click "Deploy site"
   - Auto-deploys on every push to `main`

---

## 🔧 Build Configuration

### netlify.toml

Create `admin-app/netlify.toml`:

```toml
[build]
  base = "admin-app"
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20.18.0"
  NPM_VERSION = "10.8.2"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[functions]
  node_bundler = "esbuild"
  external_node_modules = ["canvas", "sharp"]

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/api/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Methods = "GET, POST, PUT, DELETE, OPTIONS"
    Access-Control-Allow-Headers = "Content-Type, Authorization"

[[headers]]
  for = "/_next/static/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/ws/*"
  [headers.values]
    Connection = "Upgrade"
    Upgrade = "websocket"
```

---

## 🔐 Environment Variables

### Required Secrets (Netlify Dashboard → Site Settings → Environment Variables)

#### **Supabase**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### **OpenAI**
```bash
OPENAI_API_KEY=sk-proj-...
OPENAI_ORG_ID=org-...
OPENAI_PROJECT_ID=proj_...
```

#### **Google AI**
```bash
GOOGLE_AI_API_KEY=AIzaSy...
GOOGLE_CLOUD_PROJECT=easymo-prod
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}
```

#### **Google Maps**
```bash
GOOGLE_MAPS_API_KEY=AIzaSy...
```

#### **Google Search**
```bash
GOOGLE_SEARCH_API_KEY=AIzaSy...
GOOGLE_SEARCH_ENGINE_ID=your-search-engine-id
```

#### **Session & Auth**
```bash
NEXTAUTH_SECRET=your-nextauth-secret-min-32-chars
NEXTAUTH_URL=https://easymo-admin.netlify.app
ADMIN_SESSION_SECRET=your-admin-session-secret-min-16-chars
```

#### **Feature Flags**
```bash
ENABLE_OPENAI_REALTIME=true
ENABLE_GEMINI_LIVE=true
ENABLE_IMAGE_GENERATION=true
ENABLE_GOOGLE_SEARCH_GROUNDING=true
ENABLE_VOICE_AGENTS=true
```

#### **Optional: External Services**
```bash
REDIS_URL=redis://default:password@redis-host:6380
KAFKA_BROKERS=localhost:19092
DATABASE_URL=postgresql://user:pass@host:5432/db
```

---

## 📦 Dependencies Setup

### package.json (admin-app)

Ensure these are in `admin-app/package.json`:

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    
    "openai": "^4.104.0",
    "@google/generative-ai": "^0.21.0",
    "@googlemaps/google-maps-services-js": "^3.4.0",
    
    "ws": "^8.18.0",
    "eventsource-parser": "^3.0.0",
    "p-retry": "^6.2.0",
    "p-queue": "^8.0.1",
    "zod": "^3.25.0",
    
    "@supabase/supabase-js": "^2.47.10",
    "@tanstack/react-query": "^5.62.0",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.469.0",
    "tailwindcss": "^3.4.17"
  },
  "devDependencies": {
    "@types/node": "^22.10.1",
    "@types/react": "^18.3.0",
    "@types/ws": "^8.5.0",
    "typescript": "^5.7.2"
  }
}
```

---

## 🏗️ Build Process

### Pre-build Checks

Netlify runs these automatically:

1. **Security Guard**: `scripts/assert-no-service-role-in-client.mjs`
   - Blocks build if `VITE_*` or `NEXT_PUBLIC_*` vars contain secrets
   
2. **TypeScript Check**: `npm run typecheck`

3. **Linting**: `npm run lint`

### Build Command

```bash
npm run build
```

This executes:
```json
{
  "scripts": {
    "build": "next build",
    "typecheck": "tsc --noEmit",
    "lint": "next lint --max-warnings 0"
  }
}
```

### Build Output

```
admin-app/
└── .next/
    ├── static/              # Static assets
    ├── server/              # Server components
    └── standalone/          # Standalone mode (optional)
```

---

## 🌐 API Routes & Serverless Functions

### Netlify Functions Auto-Detection

Next.js API routes are automatically converted to Netlify Functions:

```
admin-app/app/api/
├── ai/
│   ├── chat/route.ts        → /.netlify/functions/api-ai-chat
│   ├── realtime/route.ts    → /.netlify/functions/api-ai-realtime
│   ├── voice/route.ts       → /.netlify/functions/api-ai-voice
│   ├── images/route.ts      → /.netlify/functions/api-ai-images
│   └── search/route.ts      → /.netlify/functions/api-ai-search
├── agents/route.ts          → /.netlify/functions/api-agents
└── health/route.ts          → /.netlify/functions/api-health
```

### Function Timeout

Default: 10 seconds (free tier)  
Pro: 26 seconds  
Business: Background functions available

**For long-running AI operations**, use streaming:

```typescript
// app/api/ai/chat/route.ts
export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Stream AI responses
      for await (const chunk of openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        stream: true,
      })) {
        controller.enqueue(encoder.encode(JSON.stringify(chunk)));
      }
      controller.close();
    },
  });
  
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

---

## 🔌 WebSocket Support (Realtime API)

### Limitation
Netlify doesn't support persistent WebSocket connections.

### Solutions

#### Option 1: External WebSocket Service (Recommended)
```bash
# Deploy to Railway/Render/Fly.io
WS_SERVER_URL=wss://easymo-ws.railway.app
```

#### Option 2: Supabase Realtime
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    realtime: {
      params: { eventsPerSecond: 10 }
    }
  }
);

// Subscribe to AI agent events
const channel = supabase.channel('ai-agents')
  .on('broadcast', { event: 'message' }, (payload) => {
    console.log('AI response:', payload);
  })
  .subscribe();
```

#### Option 3: Server-Sent Events (SSE)
```typescript
// Use SSE instead of WebSocket for voice streaming
export async function GET(req: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      // Stream voice data via SSE
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

---

## 📊 Monitoring & Logs

### Netlify Analytics

Enable in Netlify Dashboard:
- Real User Monitoring (RUM)
- Server-side analytics
- Function logs

### Custom Logging

Use Supabase Edge Functions for structured logging:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

await supabase.from('ai_logs').insert({
  event: 'AI_COMPLETION',
  provider: 'openai',
  model: 'gpt-4o',
  tokens: 1250,
  latency_ms: 850,
  user_id: session.user.id,
  created_at: new Date().toISOString(),
});
```

---

## 🚨 Deployment Checklist

### Pre-Deployment
- [ ] All environment variables set in Netlify
- [ ] `netlify.toml` configured
- [ ] Build locally: `npm run build`
- [ ] Test locally: `netlify dev`
- [ ] Verify API routes: `curl http://localhost:8888/api/health`

### Deployment
- [ ] Push to GitHub `main` branch
- [ ] Monitor build logs in Netlify
- [ ] Verify deploy preview URL
- [ ] Promote to production

### Post-Deployment
- [ ] Test chat completions: `/api/ai/chat`
- [ ] Test voice agent: `/api/ai/voice`
- [ ] Test image generation: `/api/ai/images`
- [ ] Verify Google Maps integration
- [ ] Check Supabase RLS policies
- [ ] Monitor function execution times
- [ ] Set up error alerting (Sentry/LogRocket)

---

## 🐛 Troubleshooting

### Build Errors

#### "Module not found: 'openai'"
```bash
cd admin-app
npm install openai @google/generative-ai
git add package.json package-lock.json
git commit -m "fix: add AI dependencies"
git push
```

#### "SECURITY VIOLATION: SERVICE_ROLE in NEXT_PUBLIC_*"
```bash
# Remove from Netlify env vars:
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ❌
NEXT_PUBLIC_OPENAI_API_KEY ❌

# Use server-side only (no prefix):
SUPABASE_SERVICE_ROLE_KEY ✅
OPENAI_API_KEY ✅
```

#### "Function timeout (10s exceeded)"
```typescript
// Use streaming for long operations
export const config = {
  runtime: 'edge', // Faster cold starts
};
```

### Runtime Errors

#### "Cannot find module '@easymo/commons'"
This is a monorepo package. Options:
1. Bundle it: `npm run build` in root
2. Copy to admin-app: `cp -r packages/commons admin-app/lib/`
3. Use Next.js transpilePackages:
```javascript
// next.config.js
module.exports = {
  transpilePackages: ['@easymo/commons', '@va/shared'],
};
```

#### "CORS errors on API calls"
Add to `netlify.toml`:
```toml
[[headers]]
  for = "/api/*"
  [headers.values]
    Access-Control-Allow-Origin = "https://easymo-admin.netlify.app"
    Access-Control-Allow-Credentials = "true"
```

---

## 🔄 CI/CD Integration

### GitHub Actions Workflow

`.github/workflows/netlify-deploy.yml`:

```yaml
name: Netlify Deploy

on:
  push:
    branches: [main]
    paths:
      - 'admin-app/**'
  pull_request:
    branches: [main]
    paths:
      - 'admin-app/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: admin-app
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20.18.0'
          cache: 'npm'
          cache-dependency-path: admin-app/package-lock.json
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type check
        run: npm run typecheck
      
      - name: Lint
        run: npm run lint
      
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
      
      - name: Deploy to Netlify
        uses: netlify/actions/cli@master
        with:
          args: deploy --prod --dir=admin-app/.next
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

---

## 🎯 Performance Optimization

### Next.js Config

```javascript
// next.config.js
module.exports = {
  // Enable standalone output for smaller bundle
  output: 'standalone',
  
  // Optimize images
  images: {
    domains: ['your-project.supabase.co'],
    formats: ['image/avif', 'image/webp'],
  },
  
  // Enable SWC minification
  swcMinify: true,
  
  // Reduce bundle size
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@tanstack/react-query'],
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};
```

### Caching Strategy

```toml
# netlify.toml
[[headers]]
  for = "/_next/static/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/api/ai/*"
  [headers.values]
    Cache-Control = "private, no-cache, no-store, must-revalidate"
```

---

## 📈 Scaling Considerations

### Function Concurrency
- Free tier: 3 concurrent executions
- Pro: 100 concurrent executions
- Business: Custom limits

### AI API Rate Limits
- OpenAI: Tier-based (track usage in dashboard)
- Google AI: 60 requests/minute (Gemini Pro)
- Google Maps: $200 free credit/month

### Cost Optimization
```typescript
// Use cheaper models for simple tasks
const model = complexity === 'simple' 
  ? 'gpt-4o-mini'  // $0.15/1M tokens
  : 'gpt-4o';       // $2.50/1M tokens

// Implement caching
import { cache } from 'react';

const getCachedCompletion = cache(async (prompt: string) => {
  // Cache for 5 minutes
  return openai.chat.completions.create({ ... });
});
```

---

## ✅ Success Metrics

### Health Check Endpoint

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    services: {
      openai: await checkOpenAI(),
      gemini: await checkGemini(),
      supabase: await checkSupabase(),
      maps: await checkGoogleMaps(),
    },
  };
  
  return Response.json(checks);
}
```

Access: `https://easymo-admin.netlify.app/api/health`

---

## 🆘 Support

- **Netlify Docs**: https://docs.netlify.com/frameworks/next-js/overview/
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **OpenAI Platform**: https://platform.openai.com/docs
- **Google AI**: https://ai.google.dev/gemini-api/docs

---

## 📝 Next Steps

1. **Custom Domain**: Configure in Netlify DNS
2. **SSL/TLS**: Auto-provisioned by Netlify
3. **CDN**: Automatic global distribution
4. **Monitoring**: Add Sentry, LogRocket, or Datadog
5. **A/B Testing**: Use Netlify Split Testing

**Deployment Status**: ✅ Production Ready

**Last Updated**: 2025-11-29
