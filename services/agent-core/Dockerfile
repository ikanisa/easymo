FROM node:20-slim AS base

WORKDIR /usr/src/app

COPY ../../pnpm-lock.yaml ../../package.json ../../pnpm-workspace.yaml ./
COPY ../../packages ./packages
COPY package.json ./package.json
COPY tsconfig.json ./tsconfig.json
COPY tsconfig.build.json ./tsconfig.build.json
COPY nest-cli.json ./nest-cli.json
COPY src ./src

RUN npm install -g pnpm@9.12.2
RUN pnpm install --frozen-lockfile

RUN pnpm build

EXPOSE 4000

CMD ["pnpm", "start"]
