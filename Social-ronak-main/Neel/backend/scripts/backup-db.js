const fs = require('fs');
const path = require('path');

const date = new Date();
const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}`;

const backupDir = path.join(__dirname, '../prisma/backups');
const sourceFile = path.join(__dirname, '../prisma/dev.db');
const destFile = path.join(backupDir, `dev-backup-${timestamp}.db`);

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

if (!fs.existsSync(sourceFile)) {
  console.error(`❌ dev.db not found at ${sourceFile}`);
  process.exit(1);
}

try {
  fs.copyFileSync(sourceFile, destFile);
  console.log(`✅ Backup saved: ${destFile}`);
} catch (error) {
  console.error(`❌ Failed to copy dev.db to backup folder: ${error.message}`);
  process.exit(1);
}
