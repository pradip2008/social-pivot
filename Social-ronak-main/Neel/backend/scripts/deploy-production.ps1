$ErrorActionPreference = "Stop"

Write-Host "[1/3] Running SQLite to PostgreSQL migration..."
node scripts/migrate-sqlite-to-postgres.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: SQLite to PostgreSQL migration failed." -ForegroundColor Red
    exit 1
}

Write-Host "[2/3] Regenerating Prisma client..."
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Regenerating Prisma client failed." -ForegroundColor Red
    exit 1
}

Write-Host "[3/3] Running isPublished backfill..."
node scripts/backfill-is-published.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: isPublished backfill failed." -ForegroundColor Red
    exit 1
}

Write-Host "  ✅ Production deployment sequence complete."
Write-Host "  The database has been migrated, Prisma client regenerated,"
Write-Host "  and all historical posts have been backfilled correctly."
Write-Host "  You may now start the backend server."
