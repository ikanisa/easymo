# ============================================================================
# Production Dockerfile for Google Cloud Run
# Deploys the Next.js admin-app as a standalone SSR application
# ============================================================================

# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc ./

# Copy all workspace packages for dependency resolution
COPY packages ./packages
COPY admin-app/package.json ./admin-app/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy admin-app source
COPY admin-app ./admin-app

# Build shared packages first (required by admin-app)
RUN pnpm --filter @va/shared build && \
    pnpm --filter @easymo/commons build && \
    pnpm --filter @easymo/ui build && \
    pnpm --filter @easymo/video-agent-schema build

# Build admin-app in standalone mode
ENV NODE_ENV=production
RUN pnpm --filter @easymo/admin-app run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy built Next.js standalone output
COPY --from=builder /app/admin-app/.next/standalone ./
COPY --from=builder /app/admin-app/.next/static ./admin-app/.next/static
COPY --from=builder /app/admin-app/public ./admin-app/public

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

# Cloud Run expects PORT environment variable
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Start Next.js server
CMD ["node", "admin-app/server.js"]
