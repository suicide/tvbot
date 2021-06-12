FROM node:16-alpine

WORKDIR /app

COPY package*.json tsconfig.json ./
COPY src/ ./src/

RUN npm ci && npm run build

EXPOSE 3000

CMD ["npm", "start"]
