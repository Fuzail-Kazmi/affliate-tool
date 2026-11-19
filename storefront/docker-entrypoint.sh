#!/bin/sh
set -e

echo "==> Running database migrations..."
bun migrate.mjs

echo "==> Starting Next.js server..."
exec bun --bun next start
