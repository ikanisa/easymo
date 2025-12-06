FROM node:20-alpine

# Install build dependencies for wrtc
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cmake \
    linux-headers

WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml* ./

RUN npm install -g pnpm@10.18.3
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 8080
EXPOSE 10000-10100/udp

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
