const fs = require('fs');
const path = require('path');
const readline = require('readline');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/restore-db.js prisma/backups/dev-backup-YYYY-MM-DD.db');
  process.exit(1);
}

const backupFileRaw = args[0];
const backupFilePath = path.isAbsolute(backupFileRaw) 
  ? backupFileRaw 
  : path.join(process.cwd(), backupFileRaw);

if (!fs.existsSync(backupFilePath)) {
  console.error(`❌ Backup file not found: ${backupFilePath}`);
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('⚠️  This will replace the current dev.db. Continue? (yes/no) ', (answer) => {
  if (answer.toLowerCase() !== 'yes') {
    console.log('Aborted.');
    rl.close();
    process.exit(0);
  }

  const destFile = path.join(__dirname, '../prisma/dev.db');
  try {
    fs.copyFileSync(backupFilePath, destFile);
    console.log(`✅ Restored from ${backupFilePath}`);
  } catch (error) {
    console.error(`❌ Failed to restore database: ${error.message}`);
    process.exit(1);
  }
  
  rl.close();
});
