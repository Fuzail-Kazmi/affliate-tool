# ---- Stage 1: Install all dependencies ----
FROM oven/bun:1.4.5 AS deps
WORKDIR /app
COPY storefront/package.json storefront/bun.lock ./
RUN bun install --frozen-lockfile

# ---- Stage 2: Build the Next.js app ----
FROM oven/bun:1.4.5 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY storefront/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ---- Stage 3: Production runner ----
FROM oven/bun:1.4.5 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Copy built app
COPY --from=builder --chown=bun:bun /app/.next        ./.next
COPY --from=builder --chown=bun:bun /app/public       ./public
COPY --from=builder --chown=bun:bun /app/package.json ./package.json
COPY --from=builder --chown=bun:bun /app/drizzle      ./drizzle

# Ensure uploads directory exists (volume will mount here)
RUN mkdir -p ./public/uploads && chown bun:bun ./public/uploads

# Install only production dependencies (fresh, correct platform binaries)
COPY --from=builder --chown=bun:bun /app/bun.lock ./
RUN bun install --production --frozen-lockfile

# Migration runner and entrypoint
COPY --chown=bun:bun storefront/scripts/seed-admin.ts ./scripts/seed-admin.ts
COPY --chown=bun:bun storefront/lib/db/schema.ts ./lib/db/schema.ts
COPY --from=builder --chown=bun:bun /app/next.config.ts ./next.config.ts
COPY --chown=bun:bun storefront/scripts/migrate.mjs    ./migrate.mjs
COPY --chown=bun:bun storefront/docker-entrypoint.sh   ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

RUN apt-get update && apt-get install -y --no-install-recommends python3-venv libgl1 libglib2.0-0 libgomp1 && rm -rf /var/lib/apt/lists/* && python3 -m venv /opt/unity-python
COPY requirements.txt /tmp/unity-requirements.txt
RUN /opt/unity-python/bin/pip install --no-cache-dir -r /tmp/unity-requirements.txt
COPY --chown=bun:bun src/__init__.py src/discovery.py src/merchant_pages.py src/banner_offers.py src/offer_cli.py /src/
ENV PYTHON_BIN=/opt/unity-python/bin/python
USER bun
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
