FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm and dependencies
RUN npm install -g pnpm@10.18.3 && \
    pnpm install --frozen-lockfile --prod

# Copy source
COPY . .

# Build
RUN pnpm build

# Expose port
EXPOSE 4700

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4700/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run
CMD ["node", "dist/index.js"]
