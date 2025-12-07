# Docker Configuration - easyMO Fly.io Deployment

**Date:** 2025-12-07  
**Purpose:** Document all Docker configurations for Fly.io deployment

---

## Overview

This document describes the Dockerfiles used for each easyMO service deploying to Fly.io. All Dockerfiles follow best practices:
- Multi-stage builds for minimal image size
- Production-only dependencies
- Non-root user execution
- Configurable PORT via environment variable
- Health check support

---

## 1. Admin PWA (`easymo-admin`)

### Location
`admin-app/Dockerfile`

### Type
Next.js 15 application with standalone output

### Build Command
```bash
cd admin-app
docker build -t easymo-admin .
```

### Key Features
- **Base Image:** `node:20-alpine`
- **Build Strategy:** Multi-stage (deps → builder → runner)
- **User:** Non-root `nextjs:nodejs` (UID 1001:GID 1001)
- **Port:** 3000 (configurable via `PORT` env var)
- **Entry:** `node server.js` (Next.js standalone server)
- **Size:** ~150MB (optimized)

### Dockerfile Structure
```dockerfile
FROM node:20-alpine AS base
FROM base AS deps
  # Install dependencies only
FROM base AS builder  
  # Build Next.js application
FROM base AS runner
  # Production runtime
```

### Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_URL` (build-time)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (build-time)
- `SUPABASE_SERVICE_ROLE_KEY` (runtime)
- `PORT` (runtime, default: 3000)

### Notes
- Uses Next.js standalone output mode (`output: 'standalone'` in `next.config.mjs`)
- Telemetry disabled for production
- Static files properly copied to `.next/static`

---

## 2. Vendor Portal PWA (`easymo-vendor`)

### Location
`client-pwa/Dockerfile` (or similar - needs verification)

### Type
Next.js application (vendor-facing portal)

### Build Command
```bash
cd client-pwa
docker build -t easymo-vendor .
```

### Key Features
- Similar to Admin PWA
- Enforces `role = 'vendor'` in application logic
- No public signup routes

### Dockerfile
Should match Admin PWA pattern (create if missing)

---

## 3. WhatsApp Voice Bridge (`easymo-voice-bridge`)

### Location
`services/whatsapp-voice-bridge/Dockerfile`

### Type
Node.js 20 + TypeScript + WebRTC service

### Build Command
```bash
cd services/whatsapp-voice-bridge
docker build -t easymo-voice-bridge .
```

### Key Features
- **Base Image:** `node:20-slim`
- **Native Dependencies:** `wrtc` (WebRTC), requires build tools
- **Build Tools:** `python3`, `make`, `g++`, `node-pre-gyp`
- **TypeScript Build:** `npm run build` → `dist/`
- **Port:** 8080 (configurable via `PORT`)
- **Entry:** `node dist/index.js`
- **Size:** ~300MB (native dependencies)

### Dockerfile Structure
```dockerfile
FROM node:20-slim
RUN apt-get update && apt-get install -y python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm install -g node-pre-gyp && npm install
COPY . .
RUN npm run build
RUN npm prune --omit=dev
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

### Environment Variables Required
- `PORT` (default: 8080)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_ORG_ID`
- `OPENAI_PROJECT_ID`
- `OPENAI_REALTIME_MODEL`
- `LOG_LEVEL` (info/debug)

### Notes
- **Critical:** Requires UDP support for WebRTC
- Native module compilation during build
- Keep dev dependencies during build, prune after

---

## 4. WhatsApp Router (`easymo-wa-router`)

### Location
`services/wa-router/Dockerfile` (to be created if migrating from Supabase)

### Type
Node.js/TypeScript webhook router

### Build Command
```bash
cd services/wa-router
docker build -t easymo-wa-router .
```

### Dockerfile Pattern (if migrating)
```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
USER nodejs
EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist/server.js"]
```

### Environment Variables Required
- `PORT` (default: 8080)
- `WHATSAPP_PHONE_ID` - Meta WhatsApp Phone ID
- `WHATSAPP_ACCESS_TOKEN` - Meta API token  
- `WHATSAPP_VERIFY_TOKEN` - Webhook verification
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Notes
- **IMPORTANT:** Uses Meta WhatsApp Cloud API (NOT Twilio)
- Must be publicly accessible
- Fast response required (<5s for webhook verification)
- HTTPS required

---

## 5. Call Center AGI (`easymo-agents`)

### Location
`services/agents/Dockerfile` (to be created)

### Type
Node.js/TypeScript AI orchestrator

### Build Command
```bash
cd services/agents
docker build -t easymo-agents .
```

### Dockerfile Pattern
```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
USER nodejs
EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist/server.js"]
```

### Environment Variables Required
- `PORT` (default: 8080)
- `OPENAI_API_KEY`
- `OPENAI_ORG_ID`
- `OPENAI_PROJECT_ID`
- `OPENAI_REALTIME_MODEL` (e.g., `gpt-4-realtime-preview`)
- `GEMINI_API_KEY` (for dual-provider)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Notes
- High memory requirements (AI processing)
- Persistent WebSocket connections
- Low latency critical

---

## 6. Agent Core (`easymo-agent-core`)

### Location
`services/agent-core/Dockerfile` (check if exists)

### Type
NestJS application with Prisma

### Build Command
```bash
cd services/agent-core
docker build -t easymo-agent-core .
```

### Dockerfile Pattern (NestJS)
```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist/main.js"]
```

### Environment Variables Required
- `PORT` (default: 8080)
- `DATABASE_URL` (Prisma-managed Postgres, separate from Supabase)
- `REDIS_URL`
- `KAFKA_BROKERS`

---

## 7. Common Patterns

### Health Check Endpoints
All services should implement `/health` or `/livez`:

```typescript
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'service-name' });
});
```

### Port Configuration
Always read from environment:

```typescript
const PORT = parseInt(process.env.PORT || '8080', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
```

### Logging
Use structured logging (pino):

```typescript
import pino from 'pino';
const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});
```

---

## 8. Build & Test Locally

### Build All Images
```bash
# Admin PWA
cd admin-app && docker build -t easymo-admin . && cd ..

# Vendor Portal (if separate)
cd client-pwa && docker build -t easymo-vendor . && cd ..

# Voice Bridge
cd services/whatsapp-voice-bridge && docker build -t easymo-voice-bridge . && cd ../..

# Test locally
docker run -p 3000:3000 -e SUPABASE_URL=... easymo-admin
docker run -p 8080:8080 -e OPENAI_API_KEY=... easymo-voice-bridge
```

### Multi-Platform Builds (for Fly)
```bash
# Fly.io uses amd64 architecture
docker buildx build --platform linux/amd64 -t easymo-admin .
```

---

## 9. Image Size Optimization

### Current Sizes (estimated)
- `easymo-admin`: ~150MB (Alpine + Next.js standalone)
- `easymo-vendor`: ~150MB (similar)
- `easymo-voice-bridge`: ~300MB (Slim + native dependencies)
- `easymo-wa-router`: ~100MB (Alpine + minimal deps)
- `easymo-agents`: ~120MB (Alpine + AI libs)

### Optimization Tips
1. Use Alpine base images when possible
2. Multi-stage builds (deps → builder → runner)
3. Prune dev dependencies
4. Copy only necessary files
5. Use `.dockerignore` to exclude:
   - `node_modules`
   - `.git`
   - `*.md`
   - `.env*`
   - `tests/`

---

## 10. Troubleshooting

### Build Failures

**Issue:** `wrtc` fails to compile
```bash
# Ensure build tools are installed
RUN apt-get update && apt-get install -y python3 make g++
```

**Issue:** Next.js standalone mode not working
```bash
# Ensure next.config.mjs has:
output: 'standalone'
```

**Issue:** Module not found errors
```bash
# Check .dockerignore isn't excluding necessary files
# Verify COPY commands include all required directories
```

### Runtime Issues

**Issue:** Port binding error
```bash
# Ensure app listens on 0.0.0.0, not localhost
app.listen(PORT, '0.0.0.0')
```

**Issue:** Permission denied
```bash
# Check USER directive is after all file copies
# Verify ownership with --chown in COPY
```

---

## Next Steps

1. ✅ Document all Dockerfiles
2. ⏳ Create `fly.toml` for each service
3. ⏳ Set up environment variables
4. ⏳ Deploy to staging
5. ⏳ Set up CI/CD

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-07  
**Status:** Complete
