import { Controller, Post, UseGuards, UseInterceptors, UploadedFile, Query, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import * as fs from 'fs';

@Controller('media')
export class MediaController {
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
      throw new BadRequestException('No file uploaded');
    }

    try {
      this.mediaService.validateFile(file, platform, postType);
    } catch (err) {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        // Suppress failure trying to delete an unstored or missing file
      }
      throw err;
    }

    return {
      url: this.mediaService.getPublicUrl(file.filename),
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      platform: platform || null,
      postType: postType || null,
    };
  }
}
