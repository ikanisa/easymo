# =============================================================================
# EasyMO Admin Panel - Production Dockerfile for Google Cloud Run
# =============================================================================
# This Dockerfile builds the Next.js admin-app for deployment to Cloud Run.
# It uses pnpm (required by the monorepo) and outputs a standalone Next.js build.
#
# Build: docker build -t easymo-admin .
# Run:   docker run -p 8080:8080 --env-file .env.local easymo-admin
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base image with pnpm
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# Install pnpm globally (more reliable than corepack in constrained networks)
RUN npm install -g pnpm@10.18.3

# Add libc6-compat for Alpine compatibility with some npm packages
RUN apk add --no-cache libc6-compat

WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2: Install dependencies
# -----------------------------------------------------------------------------
FROM base AS deps

# Copy workspace configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Copy all workspace package.json files for dependency resolution
COPY packages/shared/package.json ./packages/shared/
COPY packages/commons/package.json ./packages/commons/
COPY packages/ui/package.json ./packages/ui/
COPY packages/video-agent-schema/package.json ./packages/video-agent-schema/
COPY admin-app/package.json ./admin-app/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 3: Build the application
# -----------------------------------------------------------------------------
FROM base AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/commons/node_modules ./packages/commons/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/video-agent-schema/node_modules ./packages/video-agent-schema/node_modules
COPY --from=deps /app/admin-app/node_modules ./admin-app/node_modules

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Copy shared packages source code
COPY packages/shared ./packages/shared
COPY packages/commons ./packages/commons
COPY packages/ui ./packages/ui
COPY packages/video-agent-schema ./packages/video-agent-schema

# Build shared packages first (required by admin-app)
RUN pnpm --filter @va/shared build && \
    pnpm --filter @easymo/commons build && \
    pnpm --filter @easymo/ui build && \
    pnpm --filter @easymo/video-agent-schema build

# Copy admin-app source code
COPY admin-app ./admin-app

# Copy build scripts needed by admin-app
COPY scripts/assert-no-service-role-in-client.mjs ./scripts/
COPY scripts/assert-inventory-app-deferred.mjs ./scripts/
COPY scripts/assert-no-mocks-in-admin.mjs ./scripts/

# Set production environment for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js admin-app with standalone output
RUN pnpm --filter @easymo/admin-app run build

# -----------------------------------------------------------------------------
# Stage 4: Production runner
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output from builder
COPY --from=builder /app/admin-app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/admin-app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/admin-app/.next/static ./admin-app/.next/static

# Switch to non-root user
USER nextjs

# Cloud Run expects port 8080
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

EXPOSE 8080

# Health check for container orchestration
# Use node to avoid needing additional packages like wget/curl
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the Next.js server
CMD ["node", "admin-app/server.js"]
