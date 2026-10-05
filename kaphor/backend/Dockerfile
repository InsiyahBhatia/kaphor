# ---- build stage ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY package*.json ./
# --ignore-scripts: the postinstall hook runs "prisma generate", which needs the schema (copied next)
RUN npm ci --ignore-scripts

COPY prisma/ prisma/
RUN npx prisma generate

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# ---- run stage ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY prisma/ prisma/
RUN npx prisma generate

COPY data/ data/
COPY --from=builder /app/dist/ dist/
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh \
    && mkdir -p uploads/garments uploads/profiles logs \
    && chown -R node:node /app

USER node

ENV PORT=4000
EXPOSE 4000

# Uses the PORT env var, so it keeps working if the platform changes the port
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-4000}/health" || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
