$ErrorActionPreference = "Stop"

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_DIR = Split-Path -Parent $SCRIPT_DIR
Set-Location $PROJECT_DIR

$PRISMA_DIR = ".\prisma"
$SQLITE_DB = "$PRISMA_DIR\dev.db"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_DIR = "$PRISMA_DIR\backups\migration_$TIMESTAMP"

Write-Host "🚀 Starting PostgreSQL Migration Pipeline..." -ForegroundColor Cyan

if (-not (Test-Path $SQLITE_DB)) {
    Write-Host "❌ Target SQLite database ($SQLITE_DB) not found. Aborting." -ForegroundColor Red
    exit 1
}

Write-Host "📦 1. Creating detailed backups..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $BACKUP_DIR | Out-Null
Copy-Item $SQLITE_DB "$BACKUP_DIR\dev.db.bak" -Force

if (Test-Path "$PRISMA_DIR\migrations") {
    Copy-Item "$PRISMA_DIR\migrations" "$BACKUP_DIR\migrations_bak" -Recurse -Force
    Write-Host "   ✅ Database & migrations backed up to $BACKUP_DIR" -ForegroundColor Green
} else {
    Write-Host "   ✅ Database backed up to $BACKUP_DIR (No migrations folder found)" -ForegroundColor Green
}

Write-Host "🧹 2. Clearing old SQLite migrations (Required for PostgreSQL compatibility)..." -ForegroundColor Yellow
if (Test-Path "$PRISMA_DIR\migrations") {
    Remove-Item -Recurse -Force "$PRISMA_DIR\migrations"
}

Write-Host "⚙️  3. Installing data migration dependencies..." -ForegroundColor Yellow
npm install better-sqlite3

Write-Host "🏗  4. Generating fresh PostgreSQL Migrations and pushing to DB..." -ForegroundColor Yellow
# Run exact migrations generator against targeted postgres
npx prisma migrate dev --name postgresql_init

Write-Host "🔄 5. Running the Data Transfer script..." -ForegroundColor Yellow
node scripts/migrate-sqlite-to-postgres.js

Write-Host "✅ Migration Pipeline Finished!" -ForegroundColor Green
Write-Host "If data looks correct, you can safely remove the old dev.db file." -ForegroundColor Cyan
