# Docker Notes – easyMO on Google Cloud Run

## Overview

All Cloud Run services use **multi-stage Docker builds** for minimal image sizes and security.

---

## General Requirements

All Dockerfiles MUST:

1. Listen on `process.env.PORT || 8080` (Cloud Run requirement)
2. Use multi-stage builds (builder → runner)
3. Run as non-root user when possible
4. Set `NODE_ENV=production`
5. Use specific Node.js version (20-alpine)
6. Include `.dockerignore` to exclude node_modules, .git, etc.

---

## Next.js PWAs (Admin, Vendor, Client)

### Pattern

```dockerfile
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### next.config.js requirement

For standalone output, add to `next.config.js`:

```javascript
module.exports = {
  output: "standalone",
  // ... rest of config
};
```

### Files

- ✅ `/admin-app/Dockerfile` - Already exists, but PORT hardcoded to 3000. **Fix needed.**
- ⚠️ `/waiter-pwa/Dockerfile` - **To create**
- ⚠️ `/client-pwa/Dockerfile` - **To create**

---

## Node.js Microservices (pnpm monorepo)

### Pattern for services using workspace packages

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/<SERVICE_NAME> ./services/<SERVICE_NAME>

# Install pnpm
RUN npm install -g pnpm@10.18.3

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared packages first
RUN pnpm --filter @easymo/commons build
RUN pnpm --filter @va/shared build
# Add other workspace deps as needed

# Build service
RUN pnpm --filter @easymo/<SERVICE_NAME> build

# Production stage
FROM node:20-alpine

WORKDIR /usr/src/app

# Install pnpm
RUN npm install -g pnpm@10.18.3

# Copy package files
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./

# Copy built packages
COPY --from=builder /usr/src/app/packages ./packages
COPY --from=builder /usr/src/app/services/<SERVICE_NAME> ./services/<SERVICE_NAME>

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile

# Set working directory to service
WORKDIR /usr/src/app/services/<SERVICE_NAME>

ENV NODE_ENV=production

EXPOSE 8080
ENV PORT=8080

CMD ["pnpm", "start"]
```

### Voice Bridge (`/services/voice-bridge`)

- ⚠️ Dockerfile exists but may need PORT update
- Entry: `dist/server.js`
- Deps: `@easymo/commons`, `@easymo/circuit-breaker`

### WhatsApp Webhook Worker (`/services/whatsapp-webhook-worker`)

- ✅ Dockerfile exists
- Entry: `dist/index.js`
- Current port: 4900 (needs PORT env var support)
- Deps: `@easymo/commons`, `@easymo/messaging`, `@easymo/agents`

---

## NestJS Services (Agent Core)

### Pattern

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/agent-core ./services/agent-core

RUN npm install -g pnpm@10.18.3
RUN pnpm install --frozen-lockfile

# Build dependencies (@easymo/db, @easymo/commons)
RUN pnpm --filter @easymo/db build
RUN pnpm --filter @easymo/commons build

# Build service
RUN pnpm --filter @easymo/agent-core build

# Production
FROM node:20-alpine

WORKDIR /usr/src/app

RUN npm install -g pnpm@10.18.3

COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./
COPY --from=builder /usr/src/app/packages ./packages
COPY --from=builder /usr/src/app/services/agent-core ./services/agent-core

RUN pnpm install --prod --frozen-lockfile

WORKDIR /usr/src/app/services/agent-core

ENV NODE_ENV=production

EXPOSE 8080
ENV PORT=8080

CMD ["node", "dist/main.js"]
```

### Agent Core (`/services/agent-core`)

- ⚠️ Dockerfile **to create**
- Entry: `dist/main.js`
- Deps: `@easymo/db`, `@easymo/commons`, Prisma
- Special: Requires Prisma client generation

---

## .dockerignore Template

Create `.dockerignore` in each service/app:

```
node_modules
npm-debug.log
.git
.gitignore
.env
.env.*
!.env.example
dist
build
.next
coverage
.vscode
.idea
*.log
README.md
Dockerfile
.dockerignore
```

---

## Port Configuration Checklist

Services must read from `process.env.PORT`:

### Express/Node

```typescript
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
```

### Next.js

Set in Dockerfile:

```dockerfile
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"
```

Next.js standalone output respects these automatically.

### NestJS

```typescript
// main.ts
const port = process.env.PORT || 8080;
await app.listen(port, "0.0.0.0");
```

---

## Existing Dockerfiles Status

| Service               | Path                                           | Status      | Notes                             |
| --------------------- | ---------------------------------------------- | ----------- | --------------------------------- |
| Admin PWA             | `/admin-app/Dockerfile`                        | ⚠️ Fix PORT | Hardcoded to 3000, change to 8080 |
| Vendor Portal         | `/waiter-pwa/Dockerfile`                       | ❌ Create   | Copy from admin-app pattern       |
| Client PWA            | `/client-pwa/Dockerfile`                       | ❌ Create   | Copy from admin-app pattern       |
| Voice Bridge          | `/services/voice-bridge/Dockerfile`            | ⚠️ Review   | Check PORT env var                |
| WA Router             | `/services/whatsapp-webhook-worker/Dockerfile` | ⚠️ Fix PORT | Hardcoded to 4900                 |
| Agent Core            | `/services/agent-core/Dockerfile`              | ❌ Create   | NestJS pattern                    |
| Voice Media Server    | `/services/voice-media-server/Dockerfile`      | ✅          | Review PORT                       |
| Mobility Orchestrator | `/services/mobility-orchestrator/Dockerfile`   | ✅          | Review PORT                       |
| Ranking Service       | `/services/ranking-service/Dockerfile`         | ✅          | Review PORT                       |
| Wallet Service        | `/services/wallet-service/Dockerfile`          | ✅          | Review PORT                       |

---

## Build Context

For monorepo services, **build from repo root**:

```bash
docker build -f services/agent-core/Dockerfile -t easymo-agent-core .
```

NOT from service directory (needs access to `packages/`).

---

## Health Checks

All services should expose `/health` or `/healthz`:

```typescript
app.get("/health", (req, res) => res.json({ status: "ok" }));
```

Cloud Run uses this for readiness/liveness probes.

---

## Next Steps

1. Fix PORT in existing Dockerfiles
2. Create missing Dockerfiles (Vendor Portal, Client PWA, Agent Core)
3. Add `.dockerignore` files
4. Test local builds: `docker build -f <path> -t <name> .`
5. Push to Artifact Registry

See:

- [artifact-registry.md](./artifact-registry.md) - Push commands
- [cloud-run-services.md](./cloud-run-services.md) - Deploy commands
