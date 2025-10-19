FROM node:22-alpine
WORKDIR /usr/src/app
RUN npm install -g pnpm@10.18.3
COPY ../../package.json ../../pnpm-lock.yaml ./
COPY ../../pnpm-workspace.yaml ./
COPY ../../packages ./packages
COPY ./package.json ./
RUN pnpm install --prod --filter @easymo/whatsapp-bot...
COPY ./src ./src
COPY ./tsconfig.json ./
RUN pnpm --filter @easymo/whatsapp-bot build
CMD ["node", "dist/server.js"]
