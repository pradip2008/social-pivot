import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import FFmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';

// Helper: Convert any video to Instagram-friendly MP4 (H.264 + AAC)
async function convertVideoForInstagram(inputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new BadRequestException(`Input video not found: ${inputPath}`));
    }

    const dir = path.dirname(inputPath);
    const base = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(dir, `${base}_instagram.mp4`);

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    FFmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-c:a aac',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        "-vf scale='min(1080,iw)':-2",
        '-crf 23',
      ])
      .on('error', (err) => reject(new BadRequestException(`Video conversion failed: ${err.message}`)))
      .on('end', () => resolve(outputPath))
      .save(outputPath);
  });
}

interface InstagramPublishResult {
  success: boolean;
  postId?: string;
  containerId?: string;
  message?: string;
  error?: any;
}

@Injectable()
export class InstagramService {
  private logger = new Logger('Instagram');
  private apiVersion = 'v25.0';
  private apiBase = `https://graph.instagram.com/${this.apiVersion}`;

  /**
   * Publish image to Instagram
   */
  async publishImage(
    igBusinessAccountId: string,
    imageUrl: string,
    caption?: string,
    accessToken?: string,
  ): Promise<InstagramPublishResult> {
    const token = accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!token) {
      throw new BadRequestException('Instagram access token not configured');
    }

    try {
      this.logger.log(`[IG Image] Creating media container for account ${igBusinessAccountId}`);
      this.logger.debug(`[IG Image] Image URL: ${imageUrl}`);

      // Step 1: Create media container
      const payload = {
        image_url: imageUrl,
        caption: caption || '',
        access_token: token,
        media_type: 'IMAGE',
      };

      this.logger.debug(`[IG Image] Payload: ${JSON.stringify({ ...payload, access_token: '[REDACTED]' })}`);

      const createResponse = await axios.post(
        `${this.apiBase}/${igBusinessAccountId}/media`,
        payload,
        { timeout: 60000 },
      );

      const containerId = createResponse.data.id;
      this.logger.log(`[IG Image] ✓ Container created: ${containerId}`);

      // Step 2: Poll for container to be ready
      await this.pollMediaContainer(token, containerId, 'Image', 2 * 60 * 1000); // 2 min max

      // Step 3: Publish
      const publishResponse = await axios.post(
        `${this.apiBase}/${igBusinessAccountId}/media_publish`,
        {
          creation_id: containerId,
          access_token: token,
        },
        { timeout: 30000 },
      );

      const postId = publishResponse.data.id;
      this.logger.log(`[IG Image] ✅ Published successfully! Post ID: ${postId}`);

      return {
        success: true,
        postId,
        containerId,
      };
    } catch (error: any) {
      return this.handleInstagramError(error, 'Image publish');
    }
  }

  /**
   * Publish video/reel to Instagram
   * Ensures:
   * - media_type = REELS for video
   * - Uses PUBLIC HTTPS video URL
   * - Proper async polling until status = FINISHED
   */
  async publishVideo(
    igBusinessAccountId: string,
    videoUrl: string,
    caption?: string,
    isReel: boolean = true,
    accessToken?: string,
  ): Promise<InstagramPublishResult> {
    const token = accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!token) {
      throw new BadRequestException('Instagram access token not configured');
    }

    try {
      const mediaType = isReel ? 'REELS' : 'VIDEO';
      this.logger.log(
        `[IG ${mediaType}] 🎬 Starting ${isReel ? 'Reel' : 'Video'} upload for account ${igBusinessAccountId}`,
      );

      // Validate video URL is public HTTPS
      if (!videoUrl.startsWith('https://')) {
        throw new BadRequestException(`Video URL must be HTTPS. Got: ${videoUrl}`);
      }
      this.logger.debug(`[IG ${mediaType}] Video URL: ${videoUrl}`);

      // Convert video to Instagram-friendly format before uploading
      const localVideoPath = this.resolveLocalUploadPath(videoUrl);
      let convertedLocalPath: string | null = null;

      if (localVideoPath) {
        convertedLocalPath = await convertVideoForInstagram(localVideoPath);
        const convertedPublicUrl = videoUrl.replace(
          path.basename(localVideoPath),
          path.basename(convertedLocalPath),
        );

        if (!convertedPublicUrl.startsWith('https://')) {
          throw new BadRequestException(`Video URL must be HTTPS. Got: ${convertedPublicUrl}`);
        }

        this.logger.log(`[IG ${mediaType}] Converted video path: ${convertedLocalPath}`);
        videoUrl = convertedPublicUrl;
      } else {
        this.logger.warn(`[IG ${mediaType}] Skipping conversion: unable to map URL to local file`);
      }

      // ===== STEP 1: CREATE MEDIA CONTAINER =====
      const createPayload: any = {
        video_url: videoUrl,
        caption: caption || '',
        access_token: token,
        media_type: mediaType, // REELS or VIDEO
      };

      // For reels, add share_to_feed option
      if (isReel) {
        createPayload.share_to_feed = true;
      }

      this.logger.log(`[IG ${mediaType}] Step 1/3: Creating media container...`);
      this.logger.debug(
        `[IG ${mediaType}] CREATE Request: POST /${igBusinessAccountId}/media`,
      );
      this.logger.debug(
        `[IG ${mediaType}] Payload: ${JSON.stringify({ ...createPayload, access_token: '[REDACTED]' })}`,
      );

      const createResponse = await axios.post(
        `${this.apiBase}/${igBusinessAccountId}/media`,
        createPayload,
        { timeout: 60000 },
      );

      const containerId = createResponse.data.id;
      this.logger.log(`[IG ${mediaType}] ✓ Container created: ${containerId}`);
      this.logger.debug(`[IG ${mediaType}] CREATE Response: ${JSON.stringify(createResponse.data)}`);

      // ===== STEP 2: POLL CONTAINER STATUS UNTIL FINISHED =====
      this.logger.log(`[IG ${mediaType}] Step 2/3: Polling container status until FINISHED...`);
      const maxWaitMs = 5 * 60 * 1000; // 5 min timeout
      await this.pollMediaContainer(token, containerId, mediaType, maxWaitMs);

      // ===== STEP 3: PUBLISH MEDIA =====
      this.logger.log(`[IG ${mediaType}] Step 3/3: Publishing media...`);
      const publishPayload = {
        creation_id: containerId,
        access_token: token,
      };

      this.logger.debug(
        `[IG ${mediaType}] PUBLISH Request: POST /${igBusinessAccountId}/media_publish`,
      );
      this.logger.debug(
        `[IG ${mediaType}] Payload: ${JSON.stringify({ ...publishPayload, access_token: '[REDACTED]' })}`,
      );

      const publishResponse = await axios.post(
        `${this.apiBase}/${igBusinessAccountId}/media_publish`,
        publishPayload,
        { timeout: 30000 },
      );

      const postId = publishResponse.data.id;
      this.logger.log(`[IG ${mediaType}] ✅ Published successfully! Post ID: ${postId}`);
      this.logger.debug(`[IG ${mediaType}] PUBLISH Response: ${JSON.stringify(publishResponse.data)}`);

      if (convertedLocalPath) {
        await this.cleanupConvertedFile(convertedLocalPath);
      }

      return {
        success: true,
        postId,
        containerId,
      };
    } catch (error: any) {
      return this.handleInstagramError(error, `${isReel ? 'Reel' : 'Video'} publish`);
    }
  }

  /**
   * Poll media container status until FINISHED
   * Uses GET /{creation_id}?fields=status_code
   * Implements intelligent backoff retry mechanism
   */
  private async pollMediaContainer(
    accessToken: string,
    containerId: string,
    mediaType: string,
    maxWaitMs: number,
  ): Promise<void> {
    const startTime = Date.now();
    let pollCount = 0;
    // Backoff strategy: start fast, then slow down
    const pollIntervals = [2, 2, 3, 3, 5, 5, 5, 10, 10, 15, 15, 20, 20, 30];
    let lastStatus = '';

    this.logger.debug(`[Polling] Starting poll loop (max wait: ${Math.round(maxWaitMs / 1000)}s)`);

    while (Date.now() - startTime < maxWaitMs) {
      pollCount++;
      const elapsedMs = Date.now() - startTime;
      const elapsedSec = Math.round(elapsedMs / 1000);
      const interval = pollIntervals[Math.min(pollCount - 1, pollIntervals.length - 1)];

      try {
        this.logger.debug(
          `[Polling] Poll #${pollCount} (${elapsedSec}s elapsed): Checking GET /${containerId}?fields=status_code`,
        );

        const response = await axios.get(
          `${this.apiBase}/${containerId}?fields=status_code&access_token=${accessToken}`,
          { timeout: 10000 },
        );

        const statusCode = response.data.status_code || response.data.status;
        const statusMessage = response.data.status_code_description || '';

        // Log if status changed
        if (statusCode !== lastStatus) {
          this.logger.log(
            `[Polling] Poll #${pollCount}: status_code = ${statusCode}${statusMessage ? ` (${statusMessage})` : ''}`,
          );
          this.logger.debug(`[Polling] Full response: ${JSON.stringify(response.data)}`);
          lastStatus = statusCode;
        } else {
          this.logger.debug(`[Polling] Poll #${pollCount}: status_code = ${statusCode}`);
        }

        // ===== SUCCESS: Media is ready =====
        if (statusCode === 'FINISHED') {
          this.logger.log(
            `[Polling] ✅ ${mediaType} ready! Finished after ${pollCount} polls in ${elapsedSec}s`,
          );
          return;
        }

        // ===== IN PROGRESS: Keep polling =====
        if (statusCode === 'IN_PROGRESS') {
          this.logger.debug(`[Polling] Still processing... waiting ${interval}s before next poll`);
          await new Promise((resolve) => setTimeout(resolve, interval * 1000));
          continue;
        }

        // ===== ERROR: Processing failed =====
        if (statusCode === 'ERROR') {
          this.logger.error(
            `[Polling] ❌ Media processing failed: ${statusMessage || 'Unknown error'}`,
          );
          throw new BadRequestException(
            `Media processing failed (status=ERROR). ${statusMessage || 'Check video format/codec/size.'}`,
          );
        }

        // ===== EXPIRED: Container expired =====
        if (statusCode === 'EXPIRED') {
          this.logger.error(`[Polling] ❌ Media container expired`);
          throw new BadRequestException(`Media container expired after ${elapsedSec}s. Please try uploading again.`);
        }

        // ===== UNKNOWN STATUS: Log and retry =====
        this.logger.warn(`[Polling] Unknown status: ${statusCode}, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, interval * 1000));
      } catch (error: any) {
        // ===== 404: Container not found yet (retry) =====
        if (error.response?.status === 404) {
          this.logger.warn(`[Polling] Poll #${pollCount}: Container not found (404), retrying...`);
          this.logger.debug(`[Polling] Waiting ${interval}s before retry...`);
          await new Promise((resolve) => setTimeout(resolve, interval * 1000));
          continue;
        }

        // ===== OTHER ERRORS: Re-throw =====
        this.logger.error(`[Polling] Request error: ${error.message}`);
        this.logger.debug(`[Polling] Error details: ${JSON.stringify(error.response?.data || error)}`);
        throw error;
      }
    }

    // ===== TIMEOUT: Polling exceeded max wait time =====
    const timeoutSec = Math.round(maxWaitMs / 1000);
    this.logger.error(
      `[Polling] ❌ Timeout after ${pollCount} polls in ${timeoutSec}s`,
    );
    throw new BadRequestException(
      `${mediaType} processing timeout after ${timeoutSec}s (${pollCount} polls). ` +
      `Try: (1) Shorter video, (2) Smaller file size, (3) H.264 codec`,
    );
  }

  private resolveLocalUploadPath(videoUrl: string): string | null {
    try {
      const parsed = new URL(videoUrl);
      const localPath = path.join(process.cwd(), parsed.pathname.replace(/^\\//, ''));
      return fs.existsSync(localPath) ? localPath : null;
    } catch {
      return null;
    }
  }

  private async cleanupConvertedFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
      this.logger.debug(`[IG Cleanup] Removed converted file: ${filePath}`);
    } catch (error: any) {
      this.logger.warn(`[IG Cleanup] Failed to remove ${filePath}: ${error.message}`);
    }
  }

  /**
   * Handle Instagram API errors with context-specific guidance
   */
  private handleInstagramError(error: any, context: string): InstagramPublishResult {
    const axiosError = error as AxiosError<any>;
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;
    const errorMsg = data?.error?.message || error.message || 'Unknown error';
    const errorCode = data?.error?.code;
    const errorSubcode = data?.error?.error_subcode;

    this.logger.error(`[IG Error] ${context}`);
    this.logger.error(`  HTTP Status: ${status}`);
    this.logger.error(`  Error Code: ${errorCode}`);
    this.logger.error(`  Error Subcode: ${errorSubcode}`);
    this.logger.error(`  Message: ${errorMsg}`);
    this.logger.debug(`  Full Response: ${JSON.stringify(data)}`);

    // ===== INVALID PARAMETER (100) =====
    // Typically: media_type, video_url format, or codec issues
    if (errorCode === 100 || errorMsg.includes('Invalid parameter')) {
      let suggestion = `Invalid media format.`;
      if (context.includes('Video') || context.includes('Reel')) {
        suggestion +=
          ` Ensure: (1) MP4 format, (2) H.264 video codec, (3) AAC audio codec, (4) 9:16 or 1:1 aspect ratio, ` +
          `(5) < 100MB file size, (6) HTTPS URL, (7) Video duration <= 60s`;
      } else {
        suggestion += ` Ensure proper image format and URL.`;
      }
      return {
        success: false,
        message: suggestion,
        error: { code: errorCode, subcode: errorSubcode, message: errorMsg },
      };
    }

    // ===== VIDEO NOT TRANSCODED / ENCODING FAILED =====
    if (
      errorMsg.includes('VIDEO_NOT_TRANSCODED') ||
      errorMsg.includes('Video has not been transcoded') ||
      errorMsg.includes('transcod')
    ) {
      return {
        success: false,
        message:
          `Video encoding failed by Instagram.` +
          ` Fix: (1) Use MP4 container, (2) H.264 video codec, (3) AAC audio, ` +
          `(4) Bitrate < 5Mbps, (5) Frame rate 23-30fps, (6) Duration <= 60s, (7) Re-encode with ffmpeg`,
        error: { code: errorCode, message: errorMsg },
      };
    }

    // ===== INSUFFICIENT QUOTA =====
    if (errorMsg.includes('INSUFFICIENT_QUOTA') || errorCode === 190) {
      return {
        success: false,
        message: `Instagram API quota exceeded. Wait 24 hours or upgrade your app settings.`,
        error: { code: errorCode, message: errorMsg },
      };
    }

    // ===== BAD REQUEST (400) =====
    if (errorCode === 400 || status === 400) {
      return {
        success: false,
        message: `Bad request: ${errorMsg}`,
        error: { code: errorCode, message: errorMsg },
      };
    }

    // ===== PERMISSION DENIED (403) =====
    if (errorCode === 403 || status === 403) {
      return {
        success: false,
        message:
          `Permission denied. Ensure: (1) Instagram token has 'instagram_content_publish' permission, ` +
          `(2) Business account is properly connected, (3) App is approved for publishing`,
        error: { code: errorCode, message: errorMsg },
      };
    }

    // ===== UNAUTHORIZED (401) =====
    if (errorCode === 401 || status === 401) {
      return {
        success: false,
        message: `Unauthorized. Instagram access token expired or invalid. Regenerate token.`,
        error: { code: errorCode, message: errorMsg },
      };
    }

    // ===== INVALID MEDIA TYPE =====
    if (errorMsg.includes('media_type')) {
      return {
        success: false,
        message:
          `Invalid media_type. For videos use: media_type = 'REELS' (for reels) or 'VIDEO' ` +
          `(for regular video posts)`,
        error: { code: errorCode, message: errorMsg },
      };
    }

    // ===== INVALID VIDEO URL =====
    if (errorMsg.includes('video_url') || errorMsg.includes('url')) {
      return {
        success: false,
        message:
          `Invalid video URL. Ensure: (1) HTTPS protocol, (2) Publicly accessible, ` +
          `(3) Valid MP4 video, (4) URL doesn't contain special characters`,
        error: { code: errorCode, message: errorMsg },
      };
    }

    // ===== GENERIC ERROR =====
    return {
      success: false,
      message: `Instagram API error (${status || 'unknown'}): ${errorMsg}`,
      error: { code: errorCode, message: errorMsg },
    };
  }

  /**
   * Validate Instagram configuration
   */
  validateConfig(): {
    valid: boolean;
    message: string;
  } {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const igId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

    if (!token) {
      return {
        valid: false,
        message: 'INSTAGRAM_ACCESS_TOKEN not configured in environment',
      };
    }

    if (!igId) {
      return {
        valid: false,
        message: 'INSTAGRAM_BUSINESS_ACCOUNT_ID not configured in environment',
      };
    }

    return {
      valid: true,
      message: 'Instagram configured',
    };
  }
}
