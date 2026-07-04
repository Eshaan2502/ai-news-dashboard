#!/bin/sh
set -e

# Run DB migrations + idempotent seed on boot unless disabled.
# The web service keeps this on; the worker service sets RUN_MIGRATIONS=false.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] applying migrations…"
  npm run db:migrate || echo "[entrypoint] migrate failed (continuing — DB may be unreachable)"
  echo "[entrypoint] seeding…"
  npm run db:seed || echo "[entrypoint] seed failed (continuing)"
fi

exec "$@"
