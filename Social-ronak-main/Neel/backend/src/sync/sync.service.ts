import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetaService } from '../meta/meta.service';
import axios from 'axios';

const GRAPH_API_BASE = 'https://graph.facebook.com/v25.0';

@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger(SyncService.name);
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private readonly SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  constructor(
    private prisma: PrismaService,
    private metaService: MetaService,
  ) { }

  onModuleInit() {
    this.startPeriodicSync();
  }

  onModuleDestroy() {
    if (this.syncInterval) clearInterval(this.syncInterval);
  }

  private startPeriodicSync() {
    this.logger.log(`Starting social feed background sync every ${this.SYNC_INTERVAL_MS / 1000 / 60}m...`);
    this.syncInterval = setInterval(() => {
      this.syncAllFeeds().catch(e => this.logger.error('Feed sync failed:', e.message));
      this.refreshAllPlatformMetadata().catch(e => this.logger.error('Metadata refresh failed:', e.message));
    }, this.SYNC_INTERVAL_MS);

    // Initial run
    setTimeout(() => {
        this.syncAllFeeds().catch(e => this.logger.error('Initial sync failed:', e.message));
    }, 10000); // 10s wait for app to be fully up
  }

  /**
   * Manual sync — triggered by admin button.
   * Returns aggregated results for UI display.
   */
  public async manualSyncForCompany(companyId: string) {
    this.logger.log(`[ManualSync] Triggered for company ${companyId}`);

    const connections = await this.prisma.metaConnection.findMany({
      where: { companyId, isActive: true },
    });

    if (connections.length === 0) {
      return { success: false, message: 'No active social media connections found. Connect Facebook or Instagram in Settings first.' };
    }

    let totalNew = 0;
    let totalDuplicates = 0;
    let totalFetched = 0;
    const errors: string[] = [];

    for (const rawConn of connections) {
      try {
        const result = await this.syncPlatform(rawConn);
        totalNew += result.newCount;
        totalDuplicates += result.duplicatesSkipped;
        totalFetched += result.totalFetched;

        await this.prisma.postSyncLog.create({
          data: {
            companyId,
            platform: rawConn.platform,
            status: 'success',
            newPosts: result.newCount,
            totalFetched: result.totalFetched,
            duplicatesSkipped: result.duplicatesSkipped,
            message: `Synced ${result.newCount} new, ${result.duplicatesSkipped} duplicates skipped out of ${result.totalFetched} total.`
          }
        });
      } catch (e: any) {
        const msg = e.response?.data?.error?.message || e.message;
        errors.push(`${rawConn.platform}: ${msg}`);
        this.logger.warn(`[ManualSync] Failed for ${rawConn.platform}: ${msg}`);

        await this.prisma.postSyncLog.create({
          data: {
            companyId,
            platform: rawConn.platform,
            status: 'failed',
            message: msg,
          },
        });
      }
    }

    return {
      success: errors.length === 0,
      newPosts: totalNew,
      duplicatesSkipped: totalDuplicates,
      totalFetched,
      errors,
      message: errors.length > 0
        ? `Sync completed with errors. ${totalNew} new posts found, ${totalDuplicates} duplicates skipped. Errors: ${errors.join('; ')}`
        : `Sync complete! ${totalNew} new posts found, ${totalDuplicates} duplicates skipped.`,
    };
  }

  /**
   * Get the latest sync log for a company (for dashboard display).
   */
  public async getLatestSyncLog(companyId: string) {
    const log = await this.prisma.postSyncLog.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    return log;
  }

  public async syncAllFeeds() {
    this.logger.log('Running background sync for external social posts...');
    
    const connections = await this.prisma.metaConnection.findMany({
        where: { isActive: true },
    });

    for (const rawConn of connections) {
        try {
            const result = await this.syncPlatform(rawConn);
            await this.prisma.postSyncLog.create({
                data: {
                    companyId: rawConn.companyId,
                    platform: rawConn.platform,
                    status: 'success',
                    newPosts: result.newCount,
                    totalFetched: result.totalFetched,
                    duplicatesSkipped: result.duplicatesSkipped,
                    message: `Synced ${result.newCount} new, ${result.duplicatesSkipped} duplicates skipped out of ${result.totalFetched} total.`
                }
            });
        } catch (e: any) {
             const msg = e.response?.data?.error?.message || e.message;
             this.logger.warn(`Failed syncing feed for ${rawConn.platform} / company ${rawConn.companyId}: ${msg}`);
             
             await this.prisma.postSyncLog.create({
                 data: {
                     companyId: rawConn.companyId,
                     platform: rawConn.platform,
                     status: 'failed',
                     message: msg
                 }
             });

             // If token is expired, mark as inactive 
             if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('token is invalid') || msg.toLowerCase().includes('session has expired')) {
                 await this.prisma.metaConnection.update({
                     where: { id: rawConn.id },
                     data: { isActive: false }
                 });
                 this.logger.error(`Deactivated expired connection for ${rawConn.platform} (Company: ${rawConn.companyId})`);
             }
        }
    }
  }

  public async refreshAllPlatformMetadata() {
    this.logger.log('Running background metadata refresh (validating tokens)...');
    const connections = await this.prisma.metaConnection.findMany({
        where: { isActive: true },
    });

    for (const conn of connections) {
        try {
            const decryptedConn = await this.metaService.getConnectionForPlatform(conn.companyId, conn.platform);
            if (!decryptedConn || !decryptedConn.accessToken) continue;

            if (decryptedConn.platform === 'facebook' && decryptedConn.pageId) {
                const res = await axios.get(`${GRAPH_API_BASE}/${decryptedConn.pageId}?fields=name&access_token=${decryptedConn.accessToken}`);
                this.logger.debug(`Validated FB Page: ${res.data.name}`);
            } else if (decryptedConn.platform === 'instagram' && decryptedConn.igAccountId) {
                const res = await axios.get(`${GRAPH_API_BASE}/${decryptedConn.igAccountId}?fields=username&access_token=${decryptedConn.accessToken}`);
                this.logger.debug(`Validated IG Account: ${res.data.username}`);
            }
            
            await this.prisma.metaConnection.update({
                where: { id: conn.id },
                data: { updatedAt: new Date() }
            });
        } catch (e: any) {
             const msg = e.response?.data?.error?.message || e.message;
             this.logger.warn(`Metadata refresh failed for ${conn.platform} / company ${conn.companyId}: ${msg}`);
             if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('token is invalid')) {
                 await this.prisma.metaConnection.update({
                     where: { id: conn.id },
                     data: { isActive: false }
                 });
             }
        }
    }
  }

  private async syncPlatform(rawConnection: any): Promise<{ newCount: number; duplicatesSkipped: number; totalFetched: number }> {
    const connection = await this.metaService.getConnectionForPlatform(rawConnection.companyId, rawConnection.platform);
    if (!connection || !connection.isActive || !connection.accessToken) {
      return { newCount: 0, duplicatesSkipped: 0, totalFetched: 0 };
    }

    try {
        this.logger.debug(`Syncing ${connection.platform} for company ${connection.companyId} (Since: ${rawConnection.lastFetchAt || 'All Time'})`);
        
        // ─── Phase 1: Fetch New Posts ───
        const posts = await this.fetchAllPostsWithPagination(connection, rawConnection.lastFetchAt);
        
        const result = await this.processIncomingPosts(connection.companyId, connection.platform, posts.map(p => ({
            externalPostId: p.externalId,
            content: p.content,
            mediaUrl: p.mediaUrl,
            publishedAt: p.publishedAt,
            engagementCount: 0
        })));

        // ─── Phase 2: Sync Engagement for Existing Posts (Last 30 Days) ───
        await this.syncEngagementForConnection(connection);

        // Update lastFetchAt
        // Update lastFetchAt with a small overlap (1 minute buffer) to ensure no posts are missed due to clock drift
        const newestPostDate = posts.length > 0 
            ? new Date(Math.max(...posts.map(p => p.publishedAt.getTime())) + 1000)
            : new Date();

        await this.prisma.metaConnection.update({
            where: { id: rawConnection.id },
            data: { lastFetchAt: newestPostDate }
        });

        if (result.newCount > 0) {
            this.logger.log(`[Sync] Finished ${connection.platform} for company ${connection.companyId}: ${result.newCount} new, ${result.duplicatesSkipped} skipped out of ${result.totalFetched} fetched.`);
        }

        return result;
    } catch (e: any) {
        throw e; 
    }
  }

  /**
   * Fetch all posts from Meta API with full pagination support.
   * Follows paging.next until no more pages exist.
   */
  private async fetchAllPostsWithPagination(connection: any, since?: Date): Promise<any[]> {
    const accessToken = connection.accessToken;
    const sinceTimestamp = since ? Math.floor(since.getTime() / 1000) : null;
    const limit = 50;
    const allPosts: any[] = [];

    try {
      let nextUrl: string | null = null;

      if (connection.platform === 'facebook' && connection.pageId) {
        // Timeline Posts
        nextUrl = `${GRAPH_API_BASE}/${connection.pageId}/posts?fields=id,message,created_time,full_picture,permalink_url,attachments{media,type,subattachments}&access_token=${accessToken}&limit=${limit}${sinceTimestamp ? `&since=${sinceTimestamp}` : ''}`;
        
        // Also fetch Reels separately for Facebook Pages
        const reelsUrl = `${GRAPH_API_BASE}/${connection.pageId}/video_reels?fields=id,description,created_time,video{source},permalink_url&access_token=${accessToken}&limit=${limit}${sinceTimestamp ? `&since=${sinceTimestamp}` : ''}`;
        try {
            const reelsRes = await axios.get(reelsUrl, { timeout: 15000 });
            if (reelsRes.data?.data) {
                for (const r of reelsRes.data.data) {
                    allPosts.push({
                        externalId: r.id,
                        content: r.description || '',
                        mediaUrl: r.video?.source || null,
                        publishedAt: new Date(r.created_time),
                        permalink: r.permalink_url,
                        isReel: true
                    });
                }
            }
        } catch (e: any) {
            this.logger.warn(`Failed to fetch Facebook Reels for Page ${connection.pageId}: ${e.message}`);
        }
      } else if (connection.platform === 'instagram' && connection.igAccountId) {
        nextUrl = `${GRAPH_API_BASE}/${connection.igAccountId}/media?fields=id,caption,media_url,media_type,timestamp,permalink,children{media_url,media_type}&access_token=${accessToken}&limit=${limit}${sinceTimestamp ? `&since=${sinceTimestamp}` : ''}`;
      } else {
        return [];
      }

      // Paginate through all results
      let pageCount = 0;
      const maxPages = 20; // Safety limit to prevent infinite loops

      while (nextUrl && pageCount < maxPages) {
        pageCount++;
        this.logger.debug(`[Pagination] Fetching page ${pageCount} for ${connection.platform}...`);
        
        const { data } = await axios.get(nextUrl, { timeout: 15000 });
        const items = data.data || [];

        for (const p of items) {
          if (connection.platform === 'facebook') {
            const mediaUrl = this.extractFacebookMediaUrl(p);
            allPosts.push({
              externalId: p.id,
              content: p.message || '',
              mediaUrl: mediaUrl,
              publishedAt: new Date(p.created_time),
              permalink: p.permalink_url,
            });
          } else {
            // Instagram
            let mediaUrl = p.media_url || null;
            // For carousel albums, get first child media
            if (p.media_type === 'CAROUSEL_ALBUM' && p.children?.data?.length > 0) {
              mediaUrl = p.children.data[0].media_url || mediaUrl;
            }
            allPosts.push({
              externalId: p.id,
              content: p.caption || '',
              mediaUrl: mediaUrl,
              publishedAt: new Date(p.timestamp),
              permalink: p.permalink,
            });
          }
        }

        // Check for next page
        nextUrl = data.paging?.next || null;
        if (items.length === 0) break;
      }

      this.logger.log(`[Pagination] Fetched ${allPosts.length} total posts across ${pageCount} page(s) for ${connection.platform}`);
      return allPosts;

    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      this.logger.error(`Failed to fetch posts with pagination for ${connection.platform}: ${msg}`);
      throw error;
    }
  }

  /**
   * Sync likes and comments for posts published in the last 30 days.
   */
  private async syncEngagementForConnection(connection: any) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const posts = await this.prisma.post.findMany({
      where: {
        companyId: connection.companyId,
        platform: connection.platform,
        externalPostId: { not: null },
        isDeleted: false,
        publishedAt: { gte: thirtyDaysAgo }
      },
      select: { id: true, externalPostId: true }
    });

    if (posts.length === 0) return;

    this.logger.debug(`[EngagementSync] Syncing ${posts.length} posts for ${connection.platform} / Company ${connection.companyId}`);

    for (const post of posts) {
      try {
        const stats = await this.metaService.fetchPostEngagement(connection, post.externalPostId!);
        const totalEngagement = stats.likes + stats.comments;
        
        await this.processEngagementUpdate(post.id, stats.likes, stats.comments, totalEngagement);
      } catch (e: any) {
        this.logger.warn(`[EngagementSync] Failed for post ${post.externalPostId}: ${e.message}`);
      }
    }
  }

  /**
   * Persist engagement data to Post record and PostMetric history.
   */
  private async processEngagementUpdate(postId: string, likes: number, comments: number, total: number) {
    await this.prisma.$transaction([
      this.prisma.post.update({
        where: { id: postId },
        data: { engagementCount: total }
      }),
      this.prisma.postMetric.create({
        data: { postId, metric: 'likes', value: likes }
      }),
      this.prisma.postMetric.create({
        data: { postId, metric: 'comments', value: comments }
      })
    ]);
  }

  /**
   * Extract correct media URL from Facebook post based on type.
   * Facebook: Use attachments -> media -> image.src for images
   *           Use attachments -> media -> video.source for videos
   *           Fallback to full_picture
   */
  private extractFacebookMediaUrl(post: any): string | null {
    try {
      if (post.attachments?.data?.length > 0) {
        const attachment = post.attachments.data[0];
        const media = attachment.media;
        if (media) {
          // Video
          if (media.source) return media.source;
          // Image
          if (media.image?.src) return media.image.src;
        }
        // Check subattachments (carousel-like)
        if (attachment.subattachments?.data?.length > 0) {
          const sub = attachment.subattachments.data[0];
          if (sub.media?.image?.src) return sub.media.image.src;
        }
      }
    } catch (e) {
      // Silently fall through to fallback
    }

    // Fallback
    return post.full_picture || null;
  }

  /**
   * Validate that a URL is a real, publicly accessible URL.
   */
  private isValidPublicUrl(url: string | null): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      const privatePattern = /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i;
      if (privatePattern.test(parsed.hostname)) return false;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Process incoming posts with:
   * - externalPostId duplicate check
   * - ±5 minute content+publishedAt fuzzy duplicate check
   * - Bulk create using transaction for performance
   */
  private async processIncomingPosts(
    companyId: string,
    platform: string,
    incomingItems: { externalPostId: string; content: string; mediaUrl: string | null; publishedAt: Date; engagementCount: number }[]
  ): Promise<{ newCount: number; duplicatesSkipped: number; totalFetched: number }> {
    const totalFetched = incomingItems.length;
    let duplicatesSkipped = 0;
    const toCreate: any[] = [];

    // Get all existing externalPostIds for this company in one query (performance)
    const existingPosts = await this.prisma.post.findMany({
      where: { companyId },
      select: { externalPostId: true, content: true, publishedAt: true },
    });

    const existingExternalIds = new Set(
      existingPosts.filter(p => p.externalPostId).map(p => p.externalPostId!)
    );

    for (const item of incomingItems) {
      if (!item.externalPostId) {
        duplicatesSkipped++;
        continue;
      }

      // Check 1: externalPostId match
      if (existingExternalIds.has(item.externalPostId)) {
        duplicatesSkipped++;
        continue;
      }

      // Check 2: fuzzy duplicate — same companyId + similar content + publishedAt within ±10 minutes
      const tenMinMs = 10 * 60 * 1000;
      const isFuzzyDuplicate = existingPosts.some(ep => {
        if (!ep.publishedAt) return false;
        
        const timeDiff = Math.abs(ep.publishedAt.getTime() - item.publishedAt.getTime());
        if (timeDiff > tenMinMs) return false;
        
        // Compare content (trimmed, lowered)
        const existingContent = (ep.content || '').trim().toLowerCase();
        const incomingContent = (item.content || '').trim().toLowerCase();
        
        // If content matches exactly
        if (existingContent === incomingContent && (existingContent.length > 0 || incomingContent.length > 0)) return true;
        
        // If both empty, check if it's very close in time (probably the same image post)
        if (!existingContent && !incomingContent && timeDiff < 60000) return true;
        
        return false;
      });

      if (isFuzzyDuplicate) {
        duplicatesSkipped++;
        continue;
      }

      // Add to tracked local set to prevent batch-internal duplicates
      existingExternalIds.add(item.externalPostId);
      
      if (!item.content && !item.mediaUrl) {
        duplicatesSkipped++;
        continue;
      }

      // Validate media URL 
      const validMediaUrl = this.isValidPublicUrl(item.mediaUrl) ? item.mediaUrl : null;

      toCreate.push({
        companyId,
        platform,
        externalPostId: item.externalPostId,
        content: item.content || '(No content)',
        mediaUrl: validMediaUrl,
        publishedAt: item.publishedAt,
        engagementCount: item.engagementCount,
        source: 'external',
        importedAt: new Date(),
        isDeleted: false,
        isPublished: true, // External synced posts are already live on social media
      });
    }

    // Bulk create using transaction for performance
    if (toCreate.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const item of toCreate) {
          try {
            await tx.post.create({ data: item });
          } catch (e: any) {
            this.logger.warn(`[BulkCreate] Skipped duplicate: ${item.externalPostId} — ${e.message}`);
          }
        }
      });
      this.logger.log(`[BulkCreate] Created ${toCreate.length} new posts for company ${companyId} on ${platform}`);
    }

    return {
      newCount: toCreate.length,
      duplicatesSkipped,
      totalFetched,
    };
  }
}
