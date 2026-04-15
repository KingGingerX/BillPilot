# =============================================================
# Multi-stage Dockerfile for PIMS Backend
# Stage 1: deps   — install production dependencies
# Stage 2: build  — compile TypeScript
# Stage 3: production — minimal runtime image
# =============================================================

# ── Stage 1: Dependencies ────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: Build ───────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Stage 3: Production ──────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Non-root user for security
RUN addgroup -g 1001 -S pims && adduser -u 1001 -S pims -G pims

COPY --from=deps   /app/node_modules  ./node_modules
COPY --from=build  /app/dist          ./dist
COPY --from=build  /app/prisma        ./prisma
COPY --from=build  /app/package.json  ./

# Create uploads directory
RUN mkdir -p uploads && chown -R pims:pims /app

USER pims

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
