FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/whatsapp-webhook-worker ./services/whatsapp-webhook-worker

# Install pnpm
RUN npm install -g pnpm@10.18.3

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared packages
RUN pnpm --filter @easymo/commons build
RUN pnpm --filter @easymo/messaging build

# Build service
RUN pnpm --filter @easymo/whatsapp-webhook-worker build

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
COPY --from=builder /usr/src/app/services/whatsapp-webhook-worker ./services/whatsapp-webhook-worker

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile

# Set working directory to service
WORKDIR /usr/src/app/services/whatsapp-webhook-worker

ENV NODE_ENV=production

EXPOSE 4900

CMD ["pnpm", "start"]
