FROM node:20-alpine AS builder

WORKDIR /app

ENV DATABASE_URL="file:./dev.db"
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev
RUN npm install -g prisma
RUN npx prisma generate

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.ts ./

RUN mkdir -p /data

ENV NODE_ENV=production
ENV DATABASE_URL="file:/data/dev.db"
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["sh", "-c", "prisma db push && npm start"]
