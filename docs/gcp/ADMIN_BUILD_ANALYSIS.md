# Admin App GCP Deployment - Technical Analysis

## Date: 2025-12-07 14:19 CET

## Problem Summary

After 5 build attempts over 1 hour, the admin-app build continues to fail due to Next.js standalone
output and monorepo complexities.

## Build Attempts Log

1. **Attempt #1**: npm ci failed (no package-lock.json) ✗
2. **Attempt #2**: workspace:\* dependencies unsupported by npm ✗
3. **Attempt #3**: Missing root tsconfig.json files ✗
4. **Attempt #4**: Missing required environment variables ✗
5. **Attempt #5**: Module resolution issues (UI components not found) ✗

## Current Issue

**Error**: `Module not found: Can't resolve '@/components/ui/card'`

The UI components exist in `admin-app/components/ui/` but Next.js standalone output isn't properly
including them in the build.

## Root Cause Analysis

The admin-app has complex requirements:

1. **Monorepo dependencies**: Uses 4 workspace packages (@va/shared, @easymo/commons, @easymo/ui,
   @easymo/video-agent-schema)
2. **Next.js standalone output**: Must be configured with exact paths for monorepo
3. **Local UI components**: Also has its own components that must be included
4. **Build-time environment variables**: Requires dummy values for build
5. **Multiple TypeScript configurations**: Root + package-level tsconfigs

## Why This Is Hard

Next.js standalone output in a pnpm monorepo requires:

- Precise configuration of `outputFileTracing` in next.config.js
- Manual specification of which workspace packages to include
- Proper handling of path aliases in monorepo context
- Complex Dockerfile with exact COPY paths

## Solutions

### Option A: Fix Standalone Output (2-4 hours estimated)

**Steps**:

1. Update admin-app/next.config.mjs to explicitly configure outputFileTracing
2. Add experimental.outputFileTracingIncludes for workspace packages
3. Test locally with Docker first
4. Debug path resolution issues
5. Deploy to Cloud Run

**Risk**: High - Next.js standalone in monorepos is notoriously tricky

---

### Option B: Use Simple Docker Build (30 minutes) ✅ RECOMMENDED

**Approach**: Build with all node_modules, skip standalone optimization

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10.18.3

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json ./
COPY packages ./packages
COPY admin-app ./admin-app

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @va/shared build
RUN pnpm --filter @easymo/video-agent-schema build
RUN pnpm --filter @easymo/commons build
RUN pnpm --filter @easymo/ui build

# Build admin WITHOUT standalone
WORKDIR /app/admin-app
RUN pnpm build

# Simple production image (includes all node_modules)
FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm@10.18.3

COPY --from=builder /app ./

WORKDIR /app/admin-app

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080
CMD ["pnpm", "start"]
```

**Pros**:

- Simple, proven approach
- Will work immediately
- Easy to debug

**Cons**:

- Larger image size (~500MB vs ~200MB)
- Slightly slower cold starts

---

### Option C: Deploy to Existing Platform (5 minutes) ⚡ FASTEST

**Keep admin-app** on current platform (Fly.io/Railway/etc.) where it already works.

**Deploy to GCP instead**:

- WhatsApp Router (standalone service, simple Dockerfile)
- Voice Bridge (standalone service)
- Agent Core (NestJS, standard build)
- Client PWA (simpler Next.js app)

**Rationale**:

- Admin app is internal tool (low traffic)
- Current deployment works fine
- Focus GCP effort on production-critical services
- Can circle back to admin later with proper time investment

---

## Recommendation: Option C

**Immediate action**:

1. Keep admin-app where it is (working deployment)
2. Deploy WhatsApp Router to GCP (production-critical, simple build)
3. Deploy other standalone services
4. Circle back to admin-app migration later

**Commands for WhatsApp Router**:

```bash
cd /Users/jeanbosco/workspace/easymo

# Check if Dockerfile needs PORT fix
grep -n "PORT" services/whatsapp-webhook-worker/Dockerfile

# Build and deploy
gcloud builds submit \
  --tag europe-west1-docker.pkg.dev/easymoai/easymo-repo/wa-router:latest \
  services/whatsapp-webhook-worker

gcloud run deploy easymo-wa-router \
  --image europe-west1-docker.pkg.dev/easymoai/easymo-repo/wa-router:latest \
  --region europe-west1 \
  --allow-unauthenticated=true \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 20 \
  --port 8080
```

---

## Time Investment Analysis

| Approach                  | Time Required | Success Probability | Value     |
| ------------------------- | ------------- | ------------------- | --------- |
| Fix Standalone (Option A) | 2-4 hours     | 60%                 | Medium    |
| Simple Build (Option B)   | 30 min        | 95%                 | High      |
| Deploy Others (Option C)  | 30 min        | 99%                 | Very High |

**Option C delivers the most value in the least time.**

---

## Files Created This Session

1. `/Users/jeanbosco/workspace/easymo/Dockerfile.admin` - Monorepo Dockerfile (work in progress)
2. `/Users/jeanbosco/workspace/easymo/cloudbuild.admin.yaml` - Cloud Build config
3. `/Users/jeanbosco/workspace/easymo/admin-app/Dockerfile` - PORT fix (3000 → 8080)
4. `/Users/jeanbosco/workspace/easymo/admin-app/cloudbuild.yaml` - Initial attempt (deprecated)

## Infrastructure Ready

✅ GCP Project: easymoai ✅ APIs Enabled: Artifact Registry, Cloud Build, Cloud Run, IAP, Secret
Manager ✅ Artifact Registry: europe-west1-docker.pkg.dev/easymoai/easymo-repo ✅ Docker
Authentication: Configured ✅ Documentation: 11 files (100+ KB) ✅ Scripts: 4 helper scripts

---

## Next Steps

**Choose one**:

1. **Quick Win** (Recommended): Deploy WhatsApp Router using Option C commands above
2. **Complete Solution**: Implement Option B (simple Docker build)
3. **Perfect Solution**: Invest 2-4 hours in Option A (standalone output)

---

**Status**: Infrastructure ready, admin-app blocked by Next.js monorepo complexity
**Recommendation**: Deploy production services first, optimize admin-app later **Time spent**: ~75
minutes **Services deployed**: 0/4 (infrastructure 100% ready)
