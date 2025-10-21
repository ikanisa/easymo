FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm i -g pnpm && pnpm i --prod
COPY . .
RUN pnpm build
EXPOSE 8080
CMD ["node", "dist/server.js"]
