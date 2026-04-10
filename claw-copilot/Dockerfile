# =============================================================================
# claw-copilot — CopilotKit deployment assistant for Nebius
# Multi-stage build: compile Next.js, then run with nebius CLI
# Build context must be the monorepo root.
# =============================================================================

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /build

# Copy root workspace config + claw-copilot package for dependency install
COPY package.json package-lock.json ./
COPY claw-copilot/package.json claw-copilot/package.json

# Install only the claw-copilot workspace deps
RUN npm ci --workspace=claw-copilot

# Copy the app source
COPY claw-copilot/ claw-copilot/

# Copy nebius-skill so the system prompt can be resolved at build time
COPY nebius-skill/ nebius-skill/

# Build Next.js standalone output
RUN npm run build --workspace=claw-copilot

# ── Stage 2: Run ────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

# System deps for nebius CLI and health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates bash \
    && rm -rf /var/lib/apt/lists/*

# Install nebius CLI
RUN curl -sSL https://storage.eu-north1.nebius.cloud/cli/install.sh | bash \
    && ln -s /root/.nebius/bin/nebius /usr/local/bin/nebius

# Copy the nebius-skill for system prompt (SKILL.md + scripts + references)
COPY nebius-skill/ /app/nebius-skill/

# Copy Next.js standalone build
# In a monorepo, standalone output nests under the workspace name.
# Root node_modules + package.json are at .next/standalone/
# Workspace server.js + node_modules are at .next/standalone/claw-copilot/
COPY --from=builder /build/claw-copilot/.next/standalone/ ./
COPY --from=builder /build/claw-copilot/.next/static ./claw-copilot/.next/static

# Copy entrypoint and health check
COPY claw-copilot/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY claw-copilot/healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/healthcheck.sh

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD /usr/local/bin/healthcheck.sh

# The standalone server.js is inside the workspace subdirectory
WORKDIR /app/claw-copilot
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
