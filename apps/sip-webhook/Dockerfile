FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm i -g pnpm && pnpm i --prod
COPY . .
RUN pnpm build
EXPOSE 3001
CMD ["node", "dist/main.js"]
