# syntax=docker/dockerfile:1
# Build context: nalogai/ (monorepo root)

# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

RUN npm ci --ignore-scripts

# ── Stage 2: Vite production build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY frontend ./frontend
COPY shared ./shared

# Build args for environment variables baked into the bundle
ARG VITE_API_URL=/api
ARG VITE_SENTRY_DSN=
ARG VITE_SENTRY_RELEASE=
ARG SENTRY_AUTH_TOKEN=
ARG SENTRY_ORG=
ARG SENTRY_PROJECT=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_SENTRY_RELEASE=$VITE_SENTRY_RELEASE

WORKDIR /app/frontend
RUN npm run build

# ── Stage 3: Nginx static server ─────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
