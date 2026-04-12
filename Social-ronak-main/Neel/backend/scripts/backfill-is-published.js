require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    // Step 1 — Load all Sent ScheduledPost IDs into memory
    const sentScheduledPosts = await prisma.scheduledPost.findMany({
      where: { status: 'Sent' }
    });

    const sentScheduledPostIds = new Set();
    const sentExternalPostIds = new Set();

    for (const sp of sentScheduledPosts) {
      if (sp.id !== null && sp.id !== undefined) {
        sentScheduledPostIds.add(sp.id);
      }
      
      if (sp.externalPostId !== null && sp.externalPostId !== undefined) {
        sentExternalPostIds.add(sp.externalPostId);
      }
    }

    console.log(`Found ${sentScheduledPosts.length} Sent ScheduledPost records.`);

    // Step 2 — Update external posts
    const externalUpdateResult = await prisma.post.updateMany({
      where: {
        source: 'external',
        isDeleted: false,
        isPublished: false
      },
      data: {
        isPublished: true
      }
    });
    
    const externalUpdated = externalUpdateResult.count;

    // Step 3 — Update platform posts
    const platformPosts = await prisma.post.findMany({
      where: {
        source: 'platform',
        isPublished: false,
        externalPostId: { not: null }
      }
    });

    const platformPostIdsToPublish = [];
    for (const post of platformPosts) {
      if (
        sentScheduledPostIds.has(post.externalPostId) ||
        sentExternalPostIds.has(post.externalPostId)
      ) {
        platformPostIdsToPublish.push(post.id);
      }
    }

    let platformUpdated = 0;
    if (platformPostIdsToPublish.length > 0) {
      const platformUpdateResult = await prisma.post.updateMany({
        where: { id: { in: platformPostIdsToPublish } },
        data: { isPublished: true }
      });
      platformUpdated = platformUpdateResult.count;
    }

    // Step 4 — Count remaining false records
    const remainingFalse = await prisma.post.count({
      where: {
        isPublished: false,
        isDeleted: false
      }
    });

    // Step 5 — Log summary
    console.log(`
  ✅ Backfill Complete
  ─────────────────────────────────────
  External posts set to published : ${externalUpdated}
  Platform posts set to published  : ${platformUpdated}
  Posts remaining as unpublished  : ${remainingFalse}
  Total posts updated              : ${externalUpdated + platformUpdated}
  ─────────────────────────────────────`);

  } catch (error) {
    console.error('Error executing backfill script:', error.message);
    process.exit(1);
  } finally {
    // Step 6 — Disconnect
    await prisma.$disconnect();
  }
}

main();
