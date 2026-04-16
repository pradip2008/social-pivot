import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduledPostProcessor } from './scheduler.processor';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger(SchedulerService.name);
  private publishQueue: any = null;
  private pollingTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly POLL_INTERVAL_MS = 60000; // Requirement: Check every minute
  private readonly MAX_CONCURRENT_PUBLISH = 5; // Prevent overwhelming the server

  constructor(
    private prisma: PrismaService,
    private processor: ScheduledPostProcessor,
  ) {
    // Try to connect to Redis/Bull queue, but don't fail if Redis is unavailable
    this.initQueue();
  }

  onModuleInit() {
    // Always start the polling mechanism as a safety net
    // Even if Bull queue is available, this ensures posts are never missed
    this.startPolling();
  }

  onModuleDestroy() {
    this.stopPolling();
  }

  private startPolling() {
    this.logger.log(
      `Starting scheduled post polling (every ${this.POLL_INTERVAL_MS / 1000}s)...`,
    );
    
    const poll = async () => {
      try {
        await this.processDuePosts();
      } catch (err: any) {
        this.logger.error('Error during scheduled post polling:', err.message);
      } finally {
        // Schedule next poll ONLY after the previous one finishes
        this.pollingTimeout = setTimeout(poll, this.POLL_INTERVAL_MS);
      }
    };

    poll();
  }

  private stopPolling() {
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
      this.logger.log('Stopped scheduled post polling.');
    }
  }

  /**
   * Finds all pending scheduled posts whose scheduledAt time has passed
   * and processes them (publishes them).
   */
  private async processDuePosts() {
    const now = new Date();

    // Find posts that are Scheduled/Failed, passed their scheduled time
    const duePosts = await this.prisma.scheduledPost.findMany({
      where: {
        status: { in: ['Scheduled', 'Failed'] },
        scheduledAt: { lte: now },
        retryCount: { lt: 3 },
      },
      take: 20, // Process in batches
    });

    if (duePosts.length === 0) return;

    // Process in limited chunks to prevent CPU spikes
    const chunks: any[][] = [];
    for (let i = 0; i < duePosts.length; i += this.MAX_CONCURRENT_PUBLISH) {
      chunks.push(duePosts.slice(i, i + this.MAX_CONCURRENT_PUBLISH));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (post) => {
        // Faster Backoff for "Very Fast" requirement: 5s, 10s, 20s...
        const backoffSeconds = Math.pow(2, post.retryCount) * 5;
        const nextAllowedAttempt = post.lastAttemptAt 
          ? new Date(post.lastAttemptAt.getTime() + backoffSeconds * 1000)
          : now;

        if (nextAllowedAttempt > now) return;

        try {
          // The claim is now handled inside handlePublish to unify Bull & Polling
          await this.processor.handlePublish({
            scheduledPostId: post.id,
            companyId: post.companyId,
            platform: post.platform,
            content: post.content,
            mediaUrl: post.mediaUrl,
            mediaType: (post as any).mediaType,
            postType: (post as any).postType,
            mediaUrls: (post as any).mediaUrls,
          });
        } catch (error: any) {
          // ISSUE 5 FIX: Detect rate limit errors and re-queue with 30-minute delay
          // without consuming a retry attempt
          const isRateLimited = error.message?.startsWith('RATE_LIMITED:');
          if (isRateLimited) {
            const RATE_LIMIT_DELAY_MS = 30 * 60 * 1000; // 30 minutes
            this.logger.warn(
              `⏳ Rate limited for post ${post.id}. Re-queuing with 30-minute delay (retry count NOT incremented).`,
            );

            await this.prisma.scheduledPost.update({
              where: { id: post.id },
              data: { 
                status: 'Scheduled', // Keep as Scheduled, NOT Failed
                lastAttemptAt: new Date(Date.now() + RATE_LIMIT_DELAY_MS), // Push next attempt 30min out
                apiResponse: `[Rate Limited] ${error.message}. Will retry after ${new Date(Date.now() + RATE_LIMIT_DELAY_MS).toISOString()}.`,
                // retryCount is NOT incremented — rate limits don't count as a "real" failure
              },
            });
            return; // Don't re-throw, the post is safely re-queued
          }

          // Normal error handling (fatal vs retriable)
          const isFatal = error.message.includes('Instagram requires') || error.message.includes('Invalid OAuth access token');
          const newRetryCount = isFatal ? 3 : post.retryCount + 1;
          const willRetry = newRetryCount < 3;
          
          this.logger.error(
            `❌ Failed post ${post.id}${!isFatal ? ` (Retry ${newRetryCount}/3)` : ' (Fatal Error)'}: ${error.message}`,
          );

          await this.prisma.scheduledPost.update({
            where: { id: post.id },
            data: { 
              status: willRetry ? 'Scheduled' : 'Failed',
              retryCount: newRetryCount,
              apiResponse: `[Attempt ${newRetryCount}/3] ${error.message}${!willRetry ? ' - Max retries reached.' : ''}`,
            },
          });
        }
      }));
    }
  }

  private async initQueue() {
    try {
      const Bull = require('bull');
      this.publishQueue = new Bull('publish-queue', {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      });
      await this.publishQueue.isReady();
      this.logger.log('Bull queue connected to Redis successfully');

      // Register the processor for Bull queue jobs
      this.publishQueue.process('publish', async (job: any) => {
        const { scheduledPostId } = job.data;
        
        try {
          this.logger.log(`[Bull] Processing job ${job.id} for post ${scheduledPostId}`);
          await this.processor.handlePublish(job.data);
        } catch (error: any) {
          this.logger.error(`[Bull] Job ${job.id} failed: ${error.message}`);
          
          // ISSUE 5 FIX: Rate limit handling in Bull queue
          const isRateLimited = error.message?.startsWith('RATE_LIMITED:');
          if (isRateLimited) {
            const RATE_LIMIT_DELAY_MS = 30 * 60 * 1000; // 30 minutes
            this.logger.warn(
              `⏳ [Bull] Rate limited for post ${scheduledPostId}. Re-queuing with 30-minute delay.`,
            );

            await this.prisma.scheduledPost.update({
              where: { id: scheduledPostId },
              data: { 
                status: 'Scheduled',
                lastAttemptAt: new Date(Date.now() + RATE_LIMIT_DELAY_MS),
                apiResponse: `[Bull Rate Limited] ${error.message}. Will retry after ${new Date(Date.now() + RATE_LIMIT_DELAY_MS).toISOString()}.`,
              },
            });
            return; // Don't re-throw — post is safely re-queued via polling
          }

          // Re-fetch post to update failed status in DB
          const post = await this.prisma.scheduledPost.findUnique({ where: { id: scheduledPostId } });
          if (post && post.status !== 'Sent') {
            const isFatal = error.message.includes('Instagram requires') || error.message.includes('Invalid OAuth access token');
            const newRetryCount = isFatal ? 3 : post.retryCount + 1;
            const willRetry = newRetryCount < 3;
            
            await this.prisma.scheduledPost.update({
              where: { id: scheduledPostId },
              data: { 
                status: willRetry ? 'Scheduled' : 'Failed',
                retryCount: newRetryCount,
                apiResponse: `[Bull Attempt ${newRetryCount}/3] ${error.message}${!willRetry ? ' - Max retries reached or Fatal Error.' : ''}`,
              },
            });
          }
          
          throw error; // Let Bull handle internal retry if applicable
        }
      });
    } catch (error) {
      this.logger.warn(
        'Redis/Bull queue not available. Using DB polling for scheduling.',
      );
      this.publishQueue = null;
    }
  }

  async schedulePost(userId: string, companyId: string, data: any) {
    const { platform, content, scheduledAt, mediaUrl, mediaType, postType, mediaUrls, linkUrl } = data;

    // DEBUG: Log all incoming data
    this.logger.debug(`[SchedulerService.schedulePost] Received params:`, {
      platform,
      contentLength: content?.length,
      mediaUrl: mediaUrl || 'undefined',
      mediaType: mediaType || 'undefined',
      postType: postType || 'undefined',
      mediaUrls: mediaUrls ? (Array.isArray(mediaUrls) ? `[${mediaUrls.length} items]` : mediaUrls) : 'undefined',
      linkUrl: linkUrl || 'undefined',
      scheduledAt,
      allDataKeys: Object.keys(data),
    });

    // ISSUE FIX: Validate required fields before scheduling
    const p = platform.toLowerCase();
    
    // Instagram always requires media
    if (p === 'instagram') {
      if (!mediaUrl && (!mediaUrls || mediaUrls.length === 0)) {
        throw new Error(`Instagram posts require media (image, video, or reel). Please upload a media file before scheduling.`);
      }
    }
    
    // Facebook posts require media or link
    if (p === 'facebook') {
      const hasMedia = mediaUrl || (mediaUrls && mediaUrls.length > 0);
      const hasLink = linkUrl;
      if (!hasMedia && !hasLink) {
        throw new Error(`Facebook posts require either media (image/video) or a link URL. Please add media or a link before scheduling.`);
      }
    }

    // Validate content is not empty
    if (!content || content.trim().length === 0) {
      throw new Error(`Post content is required. Please enter post text before scheduling.`);
    }

    // Fix #1: Store mediaUrls as JSON string (not comma-separated) for ordered arrays and no parsing bugs
    const mediaUrlsString = Array.isArray(mediaUrls) && mediaUrls.length > 0
      ? JSON.stringify(mediaUrls)
      : (typeof mediaUrls === 'string' ? mediaUrls : null);

    const scheduledDate = new Date(scheduledAt);
    const now = new Date();
    const delay = scheduledDate.getTime() - now.getTime();

    // If scheduled time is in the past → save as 'failed'
    if (delay < 0) {
      const failedPost = await this.prisma.scheduledPost.create({
        data: {
          companyId,
          userId,
          platform,
          content,
          mediaUrl,
          mediaType: mediaType || null,
          postType: postType || null,
          mediaUrls: mediaUrlsString,
          scheduledAt: scheduledDate,
          status: 'Failed',
          apiResponse: 'Scheduled time was in the past',
        },
      });

      // DO NOT create a Post record here — failed posts should NOT appear on the public feed.
      // Post records are only created in scheduler.processor.ts after successful Meta API publication.
      this.logger.warn(
        `Post ${failedPost.id} marked as failed — scheduled time was in the past.`,
      );
      return failedPost;
    }

    // Save to DB first
    const scheduledPost = await this.prisma.scheduledPost.create({
        data: {
          companyId,
          userId,
          platform,
          content,
          mediaUrl,
          mediaType: mediaType || null,
          postType: postType || null,
          mediaUrls: mediaUrlsString,
          scheduledAt: scheduledDate,
          status: 'Scheduled',
        },
    });

    // DO NOT create a Post record here. Posts should only appear on the public feed
    // AFTER they are actually published via Meta API. The processor.handlePublish()
    // creates the Post record upon successful publication.

    // Try to add to Bull Queue if Redis is available
    if (this.publishQueue) {
      try {
        const job = await this.publishQueue.add(
          'publish',
          {
            scheduledPostId: scheduledPost.id,
            companyId,
            platform,
            content,
            mediaUrl,
            mediaType: mediaType || null,
            postType: postType || null,
            mediaUrls: mediaUrlsString,
            source: 'platform',
          },
          {
            delay,
            jobId: scheduledPost.id,
            attempts: 3,
            backoff: 60000, // Changed from 5000 to 60000
          },
        );

        await this.prisma.scheduledPost.update({
          where: { id: scheduledPost.id },
          data: { jobId: job.id.toString() },
        });

        this.logger.log(`Post ${scheduledPost.id} scheduled via Bull queue`);
      } catch (error: any) {
        this.logger.warn(
          `Bull queue failed, post will be processed via polling: ${error.message}`,
        );
      }
    } else {
      this.logger.log(
        `Post ${scheduledPost.id} saved to DB — will be processed via polling when time arrives.`,
      );
    }

    return scheduledPost;
  }

  async getScheduledPosts(companyId: string) {
    return this.prisma.scheduledPost.findMany({
      where: { companyId },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async deleteScheduledPost(companyId: string, id: string) {
    // Also remove from bull queue if available
    const post = await this.prisma.scheduledPost.findFirst({ where: { id, companyId } });
    if (post && post.jobId && this.publishQueue) {
      try {
        const job = await this.publishQueue.getJob(post.jobId);
        if (job) await job.remove();
      } catch (e) {
        this.logger.warn(`Failed to remove job ${post.jobId} from queue`);
      }
    }

    return this.prisma.scheduledPost.deleteMany({
      where: { id, companyId },
    });
  }

  async updateScheduledPost(companyId: string, id: string, data: { content?: string; scheduledAt?: string; platform?: string }) {
    const post = await this.prisma.scheduledPost.findFirst({ where: { id, companyId } });
    if (!post) throw new BadRequestException('Scheduled post not found');
    if (post.status !== 'Scheduled') throw new BadRequestException('Only posts with "Scheduled" status can be edited');

    return this.prisma.scheduledPost.update({
      where: { id },
      data: {
        ...(data.content !== undefined && { content: data.content }),
        ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
        ...(data.platform && { platform: data.platform }),
      },
    });
  }
}
