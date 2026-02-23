# syntax=docker/dockerfile:1
# ── Builder stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
LABEL stage="builder"

WORKDIR /app

# Enable corepack so pnpm is available
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Install dependencies in a cacheable layer (only re-runs when lockfile changes)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/*/package.json /tmp/pkg-json/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Build all workspace packages
COPY . .
RUN pnpm build

# ── Runner stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
LABEL org.opencontainers.image.source="https://github.com/marcusPrado02/ts-commons"
LABEL org.opencontainers.image.description="TypeScript Commons Platform"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs appuser

# Copy only the necessary runtime artefacts from the builder
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./

USER appuser

# Runtime environment
ENV NODE_ENV=production
ENV DOCKER_CONTAINER=true
ENV PORT=3000

EXPOSE 3000

# Lightweight health-check using the built-in Node.js HTTP client
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/healthz',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main.js"]
