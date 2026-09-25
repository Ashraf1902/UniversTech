#!/bin/sh
set -e

cd /var/www/html

# Recreate Laravel dirs (named volumes hide the ones created at build time).
mkdir -p \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache \
    public/uploads/events \
    public/uploads/images/courses/covers \
    public/uploads/images/events \
    public/uploads/images/schedules \
    public/uploads/lectures

# Bootstrap .env from example when missing (keeps images reusable across projects).
if [ ! -f .env ]; then
    cp .env.example .env
fi

# Generate an APP_KEY when one is not set yet.
if ! grep -q "^APP_KEY=base64:" .env 2>/dev/null && [ -z "${APP_KEY:-}" ]; then
    php artisan key:generate --force --no-interaction
fi

# Run pending migrations on every start (idempotent and safe).
if [ -z "${SKIP_MIGRATIONS:-}" ]; then
    php artisan migrate --force --no-interaction
fi

exec "$@"