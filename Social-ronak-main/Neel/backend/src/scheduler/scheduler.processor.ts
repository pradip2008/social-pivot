import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetaService } from '../meta/meta.service';

@Injectable()
export class ScheduledPostProcessor {
  private readonly logger = new Logger(ScheduledPostProcessor.name);

  // Meta rate limit error codes that should trigger delayed re-queue instead of retry
  private readonly RATE_LIMIT_CODES = [4, 32, 200, 9007];

  constructor(
    private prisma: PrismaService,
    private metaService: MetaService,
  ) { }

  async handlePublish(jobData: any) {
    const { scheduledPostId, companyId, platform, content, mediaUrl, mediaType, postType, mediaUrls } = jobData;
    this.logger.debug(
      `Processing post ${scheduledPostId} for platform: ${platform} (mediaType: ${mediaType || 'AUTO'}, postType: ${postType || 'SINGLE'})`,
    );

    if (platform.toLowerCase() === 'instagram') {
        this.logger.log(`[Scheduler] Initiating Instagram publication pipeline for post ${scheduledPostId}...`);
    }

    try {
      // ─── IDEMPOTENCY GUARD ────────────────────────────────────
      // Check if post is already published. Prevents double-publish on
      // retries, duplicate jobs, or race conditions between Bull and polling.
      const currentPost = await this.prisma.scheduledPost.findUnique({
        where: { id: scheduledPostId },
      });
      if (!currentPost) {
        this.logger.warn(`[Processor] Post ${scheduledPostId} not found in database. Skipping.`);
        return;
      }
      if (currentPost.status === 'Sent') {
        this.logger.warn(`[Processor] Post ${scheduledPostId} is already PUBLISHED (status=Sent). Skipping duplicate execution.`);
        return;
      }

      // Fix #5: Atomic claim with tight condition — only Scheduled or Failed posts can be claimed.
      // This is the DB-level safety: even with 2 workers hitting simultaneously,
      // only ONE can successfully move status to 'Publishing'.
      const updated = await this.prisma.scheduledPost.updateMany({
        where: { 
          id: scheduledPostId, 
          status: { in: ['Scheduled', 'Failed'] },  // NOT 'Sent', NOT 'Publishing'
        },
        data: { 
          status: 'Publishing',
          lastAttemptAt: new Date()
        },
      });

      if (updated.count === 0) {
        this.logger.warn(`[Processor] Post ${scheduledPostId} skipped: already claimed by another worker, already publishing, or already sent.`);
        return;
      }

      // Fix #1: Parse mediaUrls from JSON string (not comma-separated)
      let mediaItemsArray: string[] | undefined;
      if (mediaUrls) {
        try {
          const parsed = typeof mediaUrls === 'string' ? JSON.parse(mediaUrls) : mediaUrls;
          mediaItemsArray = Array.isArray(parsed) ? parsed : undefined;
        } catch {
          // Fallback: try comma-split for backward compatibility with old data
          mediaItemsArray = typeof mediaUrls === 'string' ? mediaUrls.split(',').filter(Boolean) : undefined;
        }
      }

      // Attempt to publish via Meta API (routes by postType for carousel/album/reel)
      const result = await this.metaService.publishPost(
        companyId,
        platform,
        content,
        mediaUrl,
        mediaType,
        postType,
        mediaItemsArray,
      );

      if (!result.success) {
        // ISSUE 5: Check if this is a rate limit error from Meta
        const isRateLimited = this.isRateLimitError(result.message, (result as any).rawError);
        if (isRateLimited) {
          throw new Error(`RATE_LIMITED: ${result.message}`);
        }
        throw new Error(result.message || 'Meta API publishing failed');
      }

      this.logger.log(
        `✅ Post ${scheduledPostId} published via Meta API (postId: ${result.postId})`,
      );

      // Only sync to Post feed if successful
      // Upsert to handle potential race condition with background sync
      await this.prisma.post.upsert({
        where: {
          companyId_externalPostId: {
            companyId,
            externalPostId: (result.postId || scheduledPostId).toString(),
          },
        },
        update: {
          publishedAt: new Date(),
          source: 'platform',
          isPublished: true,
        },
        create: {
          companyId,
          platform,
          content,
          mediaUrl,
          publishedAt: new Date(),
          externalPostId: (result.postId || scheduledPostId).toString(),
          source: 'platform',
          isPublished: true,
        },
      });

      // Update scheduled post status to Sent
      await this.prisma.scheduledPost.update({
        where: { id: scheduledPostId },
        data: {
          status: 'Sent',
          apiResponse: JSON.stringify(result),
        },
      });

      this.logger.log(`Post ${scheduledPostId} processed successfully for ${platform}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to process post ${scheduledPostId}: ${error.message}`,
        error.stack,
      );

      // We do NOT update to 'Failed' here anymore, because SchedulerService.processDuePosts
      // will catch this error and update with retry logic.
      throw error;
    }
  }

  // ISSUE 5 HELPER: Detect Meta rate limit errors by their error codes
  private isRateLimitError(message?: string, rawError?: any): boolean {
    if (!message && !rawError) return false;

    // Check error code from Meta API response
    const errorCode = rawError?.code || rawError?.error?.code;
    if (errorCode && this.RATE_LIMIT_CODES.includes(errorCode)) {
      return true;
    }

    // Check error subcode
    const subcode = rawError?.error_subcode || rawError?.error?.error_subcode;
    if (subcode && this.RATE_LIMIT_CODES.includes(subcode)) {
      return true;
    }

    // Check message patterns
    const msg = (message || '').toLowerCase();
    if (msg.includes('rate limit') || msg.includes('too many calls') || msg.includes('throttled')) {
      return true;
    }

    return false;
  }
}
