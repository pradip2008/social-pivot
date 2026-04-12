#!/bin/bash
set -e

# Path setup
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

PRISMA_DIR="./prisma"
SQLITE_DB="$PRISMA_DIR/dev.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$PRISMA_DIR/backups/migration_$TIMESTAMP"

echo "🚀 Starting PostgreSQL Migration Pipeline..."

if [ ! -f "$SQLITE_DB" ]; then
    echo "❌ Target SQLite database ($SQLITE_DB) not found. Aborting."
    exit 1
fi

echo "📦 1. Creating detailed backups..."
mkdir -p "$BACKUP_DIR"
cp "$SQLITE_DB" "$BACKUP_DIR/dev.db.bak"

if [ -d "$PRISMA_DIR/migrations" ]; then
    cp -r "$PRISMA_DIR/migrations" "$BACKUP_DIR/migrations_bak"
    echo "   ✅ Database & migrations backed up to $BACKUP_DIR"
else
    echo "   ✅ Database backed up to $BACKUP_DIR (No migrations folder found)"
fi

echo "🧹 2. Clearing old SQLite migrations (Required for PostgreSQL compatibility)..."
rm -rf "$PRISMA_DIR/migrations"

echo "⚙️  3. Installing data migration dependencies..."
npm install better-sqlite3

echo "🏗  4. Generating fresh PostgreSQL Migrations and pushing to DB..."
# Create migration tracking for the new db correctly
npx prisma migrate dev --name postgresql_init

echo "🔄 5. Running the Data Transfer script..."
node scripts/migrate-sqlite-to-postgres.js

echo "✅ Migration Pipeline Finished!"
echo "If data looks correct, you can safely remove the old dev.db file."
