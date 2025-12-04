FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm@10.18.3 && pnpm install --frozen-lockfile --prod
COPY . .
RUN pnpm build
EXPOSE 4800
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "require('http').get('http://localhost:4800/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"
CMD ["node", "dist/index.js"]
