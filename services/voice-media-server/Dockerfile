FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ 

COPY package*.json ./
RUN npm ci --only=production

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]
