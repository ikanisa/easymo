FROM node:22-alpine
WORKDIR /usr/src/app
RUN npm install -g pnpm@10.18.3
COPY ../../package.json ../../pnpm-lock.yaml ../../pnpm-workspace.yaml ./
COPY ../../packages ./packages
COPY ./package.json ./
RUN pnpm install --prod --filter @easymo/buyer-service...
COPY ./src ./src
COPY ./tsconfig.json ./
RUN pnpm --filter @easymo/buyer-service build
CMD ["node", "dist/server.js"]
