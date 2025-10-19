FROM node:22-alpine
WORKDIR /usr/src/app
COPY ../../pnpm-lock.yaml ../../package.json ./
RUN npm install -g pnpm@10.18.3
COPY ../../pnpm-workspace.yaml ./
COPY ../../packages ./packages
COPY ./package.json ./
RUN pnpm install --prod --filter @easymo/voice-bridge...
COPY ./src ./src
COPY ./tsconfig.json ./
RUN pnpm --filter @easymo/voice-bridge build
CMD ["node", "dist/server.js"]
