# =============================================================
# Multi-stage Dockerfile for PIMS Frontend
# Builds a static SPA served by Nginx.
# =============================================================

# ── Stage 1: Build ───────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Build args for Vite env vars
ARG VITE_API_URL=/api
ARG VITE_STRIPE_PK
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_STRIPE_PK=$VITE_STRIPE_PK

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Serve ───────────────────────────────────────────
FROM nginx:1.25-alpine AS production

# Copy built SPA
COPY --from=build /app/dist /usr/share/nginx/html

# SPA routing — all paths serve index.html
COPY docker-nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
