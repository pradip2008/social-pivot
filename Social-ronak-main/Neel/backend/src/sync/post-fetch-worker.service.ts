import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetaService } from '../meta/meta.service';

@Injectable()
export class PostFetchWorker {
  private logger = new Logger(PostFetchWorker.name);
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    private metaService: MetaService,
  ) { }

  /**
   * Main cycle — iterates through all active connections and fetches new posts.
   * Uses a lock (isRunning) to prevent overlapping cycles.
   */
  public async runFetchCycle() {
    if (this.isRunning) {
      this.logger.log('[PostFetchWorker] Previous cycle still running, skipping this tick.');
      return;
    }

    this.isRunning = true;
    try {
      this.logger.log('[PostFetchWorker] ⏱ Running 1-minute post fetch cycle...');
      
      // Get all active social connections
      const connections = await this.prisma.metaConnection.findMany({
          where: { isActive: true },
      });

      this.logger.log(`[PostFetchWorker] Found ${connections.length} active connection(s) to check.`);

      if (connections.length === 0) {
        this.logger.log('[PostFetchWorker] No active connections found. Nothing to fetch.');
        return;
      }

      let totalNewPosts = 0;

      for (const rawConn of connections) {
          try {
              const count = await this.fetchPostsForConnection(rawConn);
              totalNewPosts += count;
          } catch (e: any) {
               const msg = e.response?.data?.error?.message || e.message;
               this.logger.warn(`[PostFetchWorker] ❌ Failed for ${rawConn.platform} / company ${rawConn.companyId}: ${msg}`);
               // SYNC FAILURE RULE: Do not crash entire job, continue with other companies
          }
      }

      this.logger.log(`[PostFetchWorker] ✅ Cycle complete. Total new posts imported: ${totalNewPosts}`);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Fetches and persists new posts for a specific connection.
   * Uses bulk lookup for performance instead of one-by-one queries.
   */
  private async fetchPostsForConnection(rawConnection: any): Promise<number> {
    const connection = await this.metaService.getConnectionForPlatform(rawConnection.companyId, rawConnection.platform);
    
    // Safety checks
    if (!connection || !connection.isActive || !connection.accessToken) {
      this.logger.log(`[PostFetchWorker] Skipping ${rawConnection.platform} (company ${rawConnection.companyId}) — inactive or missing token.`);
      return 0;
    }
    
    // Only fetch for Meta platforms (Facebook / Instagram)
    if (connection.platform !== 'facebook' && connection.platform !== 'instagram') {
      return 0;
    }

    this.logger.log(`[PostFetchWorker] 🔍 Checking ${connection.platform} for company ${connection.companyId} (since: ${rawConnection.lastFetchAt || 'beginning'})`);
    
    // Fetch latest posts from the platform via Meta Graph API
    const externalPosts = await this.metaService.fetchDirectPosts(connection, undefined);
    
    this.logger.log(`[PostFetchWorker] API returned ${externalPosts.length} post(s) from ${connection.platform}`);

    if (externalPosts.length === 0) return 0;
    
    // Bulk lookup: get all existing externalPostIds for this company
    const existingPosts = await this.prisma.post.findMany({
      where: { companyId: connection.companyId },
      select: { externalPostId: true, content: true, publishedAt: true },
    });

    const existingExternalIds = new Set(
      existingPosts.filter(p => p.externalPostId).map(p => p.externalPostId!)
    );

    const toCreate: any[] = [];
    const fiveMinMs = 5 * 60 * 1000;

    for (const p of externalPosts) {
      if (!p.externalId) continue;

      // Check 1: externalPostId match
      if (existingExternalIds.has(p.externalId)) continue;

      // Check 2: fuzzy duplicate — same content + publishedAt within ±5 minutes
      const isFuzzyDuplicate = existingPosts.some(ep => {
        if (!ep.publishedAt || !ep.content) return false;
        const timeDiff = Math.abs(ep.publishedAt.getTime() - p.publishedAt.getTime());
        if (timeDiff > fiveMinMs) return false;
        const existingContent = (ep.content || '').trim().toLowerCase();
        const incomingContent = (p.content || '').trim().toLowerCase();
        if (!existingContent && !incomingContent) return false;
        return existingContent === incomingContent;
      });

      if (isFuzzyDuplicate) continue;
      if (!p.content && !p.mediaUrl) continue;

      toCreate.push({
        companyId: connection.companyId,
        platform: connection.platform,
        externalPostId: p.externalId,
        content: p.content || '(No content)',
        mediaUrl: p.mediaUrl,
        publishedAt: p.publishedAt,
        source: 'external',
        importedAt: new Date(),
        isDeleted: false,
      });
    }

    // PERFORMANCE RULE: Bulk create via transaction
    if (toCreate.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const item of toCreate) {
          try {
            await tx.post.create({ data: item });
          } catch (e: any) {
            this.logger.warn(`[PostFetchWorker] Skipped duplicate: ${item.externalPostId} — ${e.message}`);
          }
        }
      });
      this.logger.log(`[PostFetchWorker] ✅ Imported ${toCreate.length} new post(s) from ${connection.platform} for company ${connection.companyId}`);
    } else {
      this.logger.log(`[PostFetchWorker] No new posts on ${connection.platform} for company ${connection.companyId}`);
    }

    return toCreate.length;
  }
}
