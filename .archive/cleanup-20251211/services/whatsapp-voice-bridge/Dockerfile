FROM node:20-slim

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install -g node-pre-gyp && npm install

# Copy source and build
COPY . .
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --omit=dev

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "dist/index.js"]
