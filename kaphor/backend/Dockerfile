FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma/ prisma/
RUN npx prisma generate

COPY --from=builder /app/dist/ dist/

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
