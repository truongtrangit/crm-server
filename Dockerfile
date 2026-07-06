FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

RUN apk add --no-cache wget

HEALTHCHECK \
  --interval=10s \
  --timeout=3s \
  --start-period=15s \
  --retries=6 \
  CMD wget -q --spider http://127.0.0.1:3000/health || exit 1

CMD ["npm", "run", "prod"]
