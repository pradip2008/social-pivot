const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  // Create _prisma_migrations table if it doesn't exist (restored DB may lack it)
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" ("id" VARCHAR(36) NOT NULL PRIMARY KEY, "checksum" VARCHAR(64) NOT NULL, "finished_at" DATETIME, "migration_name" VARCHAR(255) NOT NULL, "logs" TEXT, "rolled_back_at" DATETIME, "started_at" DATETIME NOT NULL DEFAULT current_timestamp, "applied_steps_count" INTEGER NOT NULL DEFAULT 0)`);
  // Mark the first migration as applied
  await prisma.$executeRawUnsafe(`INSERT OR IGNORE INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES (lower(hex(randomblob(16))), 'initial_baseline', datetime('now'), '20260306073829_replace_zapier_with_meta', NULL, NULL, datetime('now'), 1)`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Fan" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "password" TEXT NOT NULL, "profileImage" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Fan_email_key" ON "Fan"("email")`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "FeedPost" ("id" TEXT NOT NULL PRIMARY KEY, "companyId" TEXT NOT NULL, "imageUrl" TEXT NOT NULL, "caption" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Reel" ("id" TEXT NOT NULL PRIMARY KEY, "companyId" TEXT NOT NULL, "videoUrl" TEXT NOT NULL, "caption" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Like" ("id" TEXT NOT NULL PRIMARY KEY, "fanId" TEXT NOT NULL, "feedPostId" TEXT, "reelId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Like_fanId_feedPostId_key" ON "Like"("fanId","feedPostId")`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Like_fanId_reelId_key" ON "Like"("fanId","reelId")`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Comment" ("id" TEXT NOT NULL PRIMARY KEY, "fanId" TEXT NOT NULL, "feedPostId" TEXT, "reelId" TEXT, "text" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe(`INSERT OR IGNORE INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES (lower(hex(randomblob(16))), 'safe_manual_apply', datetime('now'), '20260314120319_add_fan_feed_system', NULL, NULL, datetime('now'), 1)`);
  console.log('Done — all 5 Fan Feed tables created. Original data untouched.');
  await prisma.$disconnect();
}
run().catch(e => { console.error(e.message); process.exit(1); });
