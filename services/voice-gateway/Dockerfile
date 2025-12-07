# Voice Gateway - Cloud Run Dockerfile
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy built application
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./dist

# Install production dependencies only
RUN npm ci --omit=dev

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 easymo
USER easymo

EXPOSE 8080

CMD ["node", "dist/server.js"]
