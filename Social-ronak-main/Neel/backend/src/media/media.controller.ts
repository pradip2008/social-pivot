import { Controller, Post, UseGuards, UseInterceptors, UploadedFile, Query, BadRequestException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import * as fs from 'fs';

@Controller('media')
export class MediaController {
  private logger = new Logger('MediaController');

  constructor(private readonly mediaService: MediaService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('platform') platform?: string,
    @Query('postType') postType?: string,
  ) {
    if (!file) {
      this.logger.error('No file uploaded');
      throw new BadRequestException('No file uploaded');
    }

    this.logger.debug(`Upload attempt: file=${file.originalname}, platform=${platform}, postType=${postType}, size=${file.size}`);

    try {
      this.mediaService.validateFile(file, platform, postType);
      this.logger.debug(`✓ Validation passed for ${file.originalname}`);
    } catch (err) {
      this.logger.warn(`✗ Validation failed for ${file.originalname}: ${err.message}`);
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        // Suppress failure trying to delete file
      }
      throw err;
    }

    const publicUrl = this.mediaService.getPublicUrl(file.filename);
    
    // Ensure proper MIME type based on file extension (Multer sometimes gets it wrong)
    let mimeType = file.mimetype;
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext === 'mp4' && !mimeType.startsWith('video/')) {
      mimeType = 'video/mp4';
      this.logger.debug(`[Media] Corrected MIME type for .mp4 file: ${mimeType}`);
    } else if (['mov', 'avi', 'mkv', 'webm'].includes(ext || '') && !mimeType.startsWith('video/')) {
      mimeType = 'video/mp4'; // Treat all video formats as MP4 for consistency
      this.logger.debug(`[Media] Corrected MIME type for .${ext} file: ${mimeType}`);
    }
    
    this.logger.log(`✅ File uploaded: ${file.filename} (${mimeType}) → ${publicUrl}`);

    return {
      url: publicUrl,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: mimeType,
      platform: platform || null,
      postType: postType || null,
    };
  }
}
