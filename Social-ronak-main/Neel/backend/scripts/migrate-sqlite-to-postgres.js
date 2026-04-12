const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function main() {
  const sqliteDbPath = path.join(__dirname, '../prisma/dev.db');
  
  if (!fs.existsSync(sqliteDbPath)) {
    console.error(`❌ SQLite database not found at ${sqliteDbPath}`);
    process.exit(1);
  }

  // Open SQLite database in READ-ONLY mode. Safe.
  const sqlite = new Database(sqliteDbPath, { readonly: true });
  // Target DB connection uses standard Prisma environment.
  const prisma = new PrismaClient();

  // Exactly ordered layout mapped dynamically to satisfy Foreign Keys constraints
  const tables = [
    'SystemConfig', 'Company', 'User', 'Theme', 'Fan', 'Post', 'ScheduledPost',
    'DraftPost', 'MetaConnection', 'Reel', 'Like', 'Comment', 'PostMetric',
    'PostSyncLog', 'WebhookLog', 'AiGenerationLog', 'HashtagGroup', 'HashtagCache',
    'PostLike', 'PostComment', 'PostShare'
  ];

  console.log('🔄 Starting SQLite to PostgreSQL Data Transfer...\n');

  // PRE-READ: Construct sentScheduledPostIds set for mapping Post.isPublished
  const sentScheduledPostIds = new Set();
  const scheduledPostExists = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='ScheduledPost'`).get();
  if (scheduledPostExists) {
    const scheduledPosts = sqlite.prepare(`SELECT id, status FROM "ScheduledPost"`).all();
    for (const sp of scheduledPosts) {
      if (sp.status === 'Sent') {
        sentScheduledPostIds.add(sp.id);
      }
    }
    console.log(`📌 Found ${sentScheduledPostIds.size} successfully sent scheduled posts.\n`);
  }

  for (const table of tables) {
    console.log(`\n⏳ Migrating table: ${table}...`);
    
    // Check if table exists in SQLite 
    const tableExists = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
    if (!tableExists) {
      console.log(`⚠️  Table ${table} does not exist in SQLite. Skipping.`);
      continue;
    }

    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
    console.log(`📋 Found ${rows.length} records.`);
    if (rows.length === 0) continue;

    // Transform rows correctly mappings types
    const transformedRows = rows.map(row => {
      const newRow = { ...row };
      
      for (const [key, value] of Object.entries(newRow)) {
        if (value === null) continue;
        
        // SQLite maps booleans poorly. Correct explicit boolean fields.
        if (key === 'isDeleted' || key === 'isActive') {
          newRow[key] = value === 1 || value === '1' || value === 'true' || value === true;
        }

        // Convert SQLite mixed Date Epochs & ISO Strings down into valid JS Dates
        if (key.endsWith('At') || key === 'resetTokenExpires') {
          if (value) {
            let dateVal = value;
            // Catch raw seconds timestamps
            if (typeof dateVal === 'number' && dateVal.toString().length === 10) {
                dateVal = dateVal * 1000;
            }
            const date = new Date(dateVal);
            if (!isNaN(date.getTime())) {
              newRow[key] = date;
            }
          }
        }
      }

      // Automatically satisfy the new Boolean column added historically
      if (table === 'Post' && !('isPublished' in row)) {
        // SQLite booleans are 0 or 1.
        const isDeleted = row.isDeleted === 1 || row.isDeleted === '1' || row.isDeleted === 'true' || row.isDeleted === true;

        if (row.source === 'external' && !isDeleted) {
          newRow.isPublished = true;
        } else if (row.source === 'platform' && sentScheduledPostIds.has(row.externalPostId)) {
          newRow.isPublished = true;
        } else {
          newRow.isPublished = false;
        }
      }

      return newRow;
    });

    const BATCH_SIZE = 100;
    let inserted = 0;

    for (let i = 0; i < transformedRows.length; i += BATCH_SIZE) {
      const batch = transformedRows.slice(i, i + BATCH_SIZE);
      const modelName = table.charAt(0).toLowerCase() + table.slice(1);
      
      try {
        await prisma[modelName].createMany({
          data: batch,
          skipDuplicates: true, // Idempotent block ensures partial restarts drop nicely
        });
        inserted += batch.length;
        process.stdout.write(`\r✅ Inserted ${inserted} / ${transformedRows.length}`);
      } catch (err) {
        console.error(`\n❌ Error inserting batch in ${table}: ${err.message}`);
        
        // Fine-resolution Fallback: Insert record independently to surface corrupt row mappings
        console.log(`⚠️  Falling back to single-row insertion for problem batch...`);
        for (const row of batch) {
          try {
            await prisma[modelName].create({ data: row });
          } catch (e) {
            console.error(`❌ Failed tracking insertion constraint in ${table} (ID: ${row.id}):`, e.message);
          }
        }
      }
    }
    console.log(); 
  }

  console.log('\n🎉 Data Migration completed successfully!');
  await prisma.$disconnect();
  sqlite.close();
}

main().catch(async (e) => {
  console.error('\n🚨 Migration Script Failed:', e);
  process.exit(1);
});
