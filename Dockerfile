FROM node:20-alpine AS builder

WORKDIR /app

ENV DATABASE_URL="file:./dev.db"
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
# Docker is an optional deployment path and often runs on small single-host
# machines. Use webpack here because it is more predictable under tight memory
# limits than the default Turbopack production build.
RUN npx next build --webpack

FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev
# The app only uses Docker as an optional single-host deployment path.
# Keep the runtime Prisma CLI pinned to the project version so db push behaves
# the same way as local development when this path is used later.
RUN npm install -g prisma@6.19.2
RUN npx prisma generate

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.ts ./

RUN mkdir -p /data

ENV NODE_ENV=production
ENV DATABASE_URL="file:/data/dev.db"
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["sh", "-c", "prisma db push && ./node_modules/.bin/next start --hostname 0.0.0.0 --port \"${PORT}\""]
