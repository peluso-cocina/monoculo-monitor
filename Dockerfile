# ---------- Builder ----------
FROM node:20-alpine AS builder

WORKDIR /app

# better-sqlite3 needs build tools on alpine
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ---------- Runner ----------
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/database/schema.sql ./dist/database/schema.sql

# SQLite persistence directory (mount as volume in NAS)
RUN mkdir -p /app/data
VOLUME ["/app/data"]

CMD ["node", "dist/index.js"]
