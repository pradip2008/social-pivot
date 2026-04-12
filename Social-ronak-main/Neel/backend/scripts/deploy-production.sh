#!/bin/bash
set -e

echo "[1/3] Running SQLite to PostgreSQL migration..."
if ! node scripts/migrate-sqlite-to-postgres.js; then
  echo "Error: SQLite to PostgreSQL migration failed."
  exit 1
fi

echo "[2/3] Regenerating Prisma client..."
if ! npx prisma generate; then
  echo "Error: Regenerating Prisma client failed."
  exit 1
fi

echo "[3/3] Running isPublished backfill..."
if ! node scripts/backfill-is-published.js; then
  echo "Error: isPublished backfill failed."
  exit 1
fi

echo "  ✅ Production deployment sequence complete."
echo "  The database has been migrated, Prisma client regenerated,"
echo "  and all historical posts have been backfilled correctly."
echo "  You may now start the backend server."
