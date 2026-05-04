# syntax=docker/dockerfile:1
# Build context: nalogai/ (monorepo root)

# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy workspace manifests for cache-friendly installs
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/

# Install all workspace deps (hoisted to root node_modules)
RUN npm ci --ignore-scripts

# ── Stage 2: Build TypeScript ──────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY backend ./backend
COPY shared ./shared

WORKDIR /app/backend
RUN npx tsc --build

# ── Stage 3: Production runtime ───────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create a non-root user to run the application
RUN groupadd --system nalogai && useradd --system --gid nalogai --no-create-home nalogai

# Copy only what's needed at runtime
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/src/assets/fonts ./dist/assets/fonts
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Generate Prisma client for the production runtime
RUN npx prisma generate --schema=./prisma/schema.prisma

# Drop privileges before starting the server
USER nalogai

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["node", "dist/index.js"]
