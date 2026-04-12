# Database Safety Rules — Read Before Touching Anything

## The Golden Rule  
Never run any Prisma command without creating a backup first.  
The backup runs automatically when you use the correct commands below.

## Safe Commands — Always Use These  
| Action              | Command                        |  
|---------------------|--------------------------------|  
| Start development   | `npm run dev` (auto-backs up)  |  
| Manual backup       | `npm run db:backup`            |  
| Restore a backup    | `npm run db:restore`           |  

## Forbidden Commands — Never Run These Directly  
These commands can destroy all data without warning:  
- `npx prisma migrate reset`  
- `npx prisma db push`  
- `npx prisma db push --accept-data-loss`  
- Manually deleting `prisma/dev.db`  

## Where Backups Are Stored  
All backups are saved in: `backend/prisma/backups/`  
Each backup is timestamped: `dev-backup-YYYY-MM-DD-HH-MM-SS.db`  
Backups are excluded from git — they live only on your local machine.

## How to Restore  
Run: `npm run db:restore`  
When prompted, enter the path to the backup file you want to restore.  
After restoring, run: `npx prisma migrate deploy`  
This re-applies any pending migrations without touching your data.

## Why SQLite + Prisma Is Dangerous Without These Protections  
SQLite cannot perform `ALTER TABLE` operations directly. When Prisma needs to change an existing table structure, it creates a new empty table, copies data over, drops the original, and renames the new one. If anything goes wrong during this process — or if the migration contains an error — data is permanently lost. These backup hooks exist to ensure there is always a safe restore point before any schema change is applied.
