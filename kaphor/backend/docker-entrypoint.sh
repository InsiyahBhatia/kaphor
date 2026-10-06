#!/bin/sh
set -e
# Apply database migrations, then start the API. "exec" lets Node receive SIGTERM for graceful shutdown.
if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "Running database migrations..."
  DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}" npx prisma migrate deploy
fi
exec node dist/index.js
