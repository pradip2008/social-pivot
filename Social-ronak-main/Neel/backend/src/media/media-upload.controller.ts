import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { ImageProcessorService } from './services/image-processor.service';
import { VideoProcessorService } from './services/video-processor.service';
import { MediaStorageService } from './services/media-storage.service';
import { InstagramService } from './services/instagram.service';

@Controller('media')
export class MediaController {
  private logger = new Logger('MediaController');
  private readonly tempDir: string;

  constructor(
    private imageProcessor: ImageProcessorService,
    private videoProcessor: VideoProcessorService,
    private storage: MediaStorageService,
    private instagram: InstagramService,
  ) {
    // Temporary directory for processing
    this.tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Upload and process media (image or video)
   * Automatically detects file type and processes accordingly
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          const tempDir = path.join(process.cwd(), 'temp');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          cb(null, tempDir);
        },
        filename: (req, file, cb) => {
          const timestamp = Date.now();
          const ext = path.extname(file.originalname);
          cb(null, `upload_${timestamp}_${Math.random().toString(36).substring(7)}${ext}`);
        },
      }),
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max
      },
    }),
  )
  async uploadMedia(
    @UploadedFile() file: Express.Multer.File,
    @Query('type') mediaType?: string, // 'image' or 'video' (optional, will auto-detect)
  ) {
    const startTime = Date.now();

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    this.logger.log(
      `📥 Upload start: ${file.originalname} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`,
    );

    const originalPath = file.path;
    const ext = path.extname(file.originalname).toLowerCase();
    const fileName = path.basename(file.originalname);

    try {
      // Detect media type
      const detectedType = this.detectMediaType(ext, file.mimetype);

      if (detectedType === 'unknown') {
        throw new BadRequestException(
          `Unsupported file format: ${ext}. Supported: images (jpg, png, webp) and videos (mp4, mov, avi, mkv)`,
        );
      }

      let processedPath: string;
      let processedFilename: string;
      let processedSize: number;
      let metadata: any = {};

      // Process based on type
      if (detectedType === 'image') {
        this.logger.log(`🖼️  Processing image: ${fileName}`);
        const result = await this.imageProcessor.processImage(originalPath, this.tempDir);
        processedPath = result.path;
        processedFilename = result.filename;
        processedSize = result.size;
        metadata = {
          format: result.format,
          width: result.width,
          height: result.height,
        };
        this.logger.log(`✅ Image processed: ${result.width}x${result.height}, ${(result.size / 1024).toFixed(0)}KB`);
      } else {
        // Video
        this.logger.log(`🎥 Processing video: ${fileName}`);
        const result = await this.videoProcessor.processVideo(originalPath, this.tempDir);
        processedPath = result.path;
        processedFilename = result.filename;
        processedSize = result.size;
        metadata = {
          format: 'mp4',
          width: result.width,
          height: result.height,
          duration: result.duration,
          fps: result.fps,
        };
        this.logger.log(
          `✅ Video processed: ${result.width}x${result.height}, ${result.duration}s, ${(result.size / (1024 * 1024)).toFixed(2)}MB`,
        );
      }

      // Save to public storage
      const stored = this.storage.saveFile(processedPath, processedFilename);
      this.logger.log(`💾 Saved to storage: ${stored.publicUrl}`);

      // Clean up temporary files
      this.cleanupFile(originalPath);
      this.cleanupFile(processedPath);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`✅ Upload complete in ${duration}s`);

      return {
        success: true,
        mediaType: detectedType,
        filename: processedFilename,
        originalName: fileName,
        url: stored.publicUrl,
        size: processedSize,
        sizeKB: Math.round(processedSize / 1024),
        sizeMB: (processedSize / (1024 * 1024)).toFixed(2),
        metadata,
        processingTime: duration,
      };
    } catch (error: any) {
      this.logger.error(`❌ Upload failed: ${error.message}`);

      // Clean up temp files
      this.cleanupFile(originalPath);

      // Return appropriate error
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        `Upload processing failed: ${error.message}. Try a different file or format.`,
      );
    }
  }

  /**
   * Publish processed media to Instagram
   * Requires the media URL from upload endpoint
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('publish/instagram')
  async publishToInstagram(
    @Query('url') mediaUrl?: string,
    @Query('type') mediaType?: string, // 'image' or 'video'
    @Query('caption') caption?: string,
    @Query('igId') igBusinessAccountId?: string,
  ) {
    if (!mediaUrl) {
      throw new BadRequestException('media URL (url parameter) is required');
    }

    if (!mediaType || !['image', 'video'].includes(mediaType)) {
      throw new BadRequestException('Invalid media type. Must be "image" or "video"');
    }

    const igId = igBusinessAccountId || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    if (!igId) {
      throw new BadRequestException('Instagram Business Account ID not configured');
    }

    this.logger.log(`📤 Publishing ${mediaType} to Instagram: ${mediaUrl}`);

    try {
      let result;

      if (mediaType === 'image') {
        result = await this.instagram.publishImage(igId, mediaUrl, caption);
      } else {
        // Assume it's a reel if query param indicates it's a short video
        const isReel = caption?.includes('#reel') || false;
        result = await this.instagram.publishVideo(igId, mediaUrl, caption, isReel);
      }

      if (result.success) {
        this.logger.log(`✅ Published to Instagram! Post ID: ${result.postId}`);
        return {
          success: true,
          postId: result.postId,
          containerId: result.containerId,
          message: 'Successfully published to Instagram!',
        };
      } else {
        this.logger.warn(`⚠️  Instagram publish failed: ${result.message}`);
        throw new BadRequestException(result.message);
      }
    } catch (error: any) {
      this.logger.error(`❌ Instagram publish error: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(`Instagram publish failed: ${error.message}`);
    }
  }

  /**
   * Health check / Configuration status
   */
  @Post('health')
  async health() {
    const igConfig = this.instagram.validateConfig();
    const storageStats = this.storage.getStorageStats();

    return {
      status: 'ok',
      instagram: {
        configured: igConfig.valid,
        status: igConfig.message,
      },
      storage: {
        directory: storageStats.directory,
        fileCount: storageStats.fileCount,
        totalSizeMB: (storageStats.totalSize / (1024 * 1024)).toFixed(2),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detect media type from extension and MIME type
   */
  private detectMediaType(ext: string, mimeType: string): 'image' | 'video' | 'unknown' {
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp'];
    const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', '3gp', 'mts', 'm2ts'];

    const cleanExt = ext.toLowerCase().replace('.', '');

    // Check by extension first
    if (imageExts.includes(cleanExt)) return 'image';
    if (videoExts.includes(cleanExt)) return 'video';

    // Check by MIME type as fallback
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';

    return 'unknown';
  }

  /**
   * Clean up temporary file
   */
  private cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.debug(`🗑️  Cleaned up: ${filePath}`);
      }
    } catch (error: any) {
      this.logger.warn(`⚠️  Failed to cleanup ${filePath}: ${error.message}`);
    }
  }
}
