FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy shared packages
COPY packages/commons ./packages/commons
COPY packages/shared ./packages/shared

# Copy service
COPY services/ai-realtime ./services/ai-realtime

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @easymo/ai-realtime...

# Build shared packages and service
RUN pnpm --filter @va/shared build && \
    pnpm --filter @easymo/commons build && \
    pnpm --filter @easymo/ai-realtime build

# Set production environment
ENV NODE_ENV=production
EXPOSE 7070

# Run the service
CMD ["node", "services/ai-realtime/dist/server.js"]
