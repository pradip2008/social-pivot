import { Injectable, BadRequestException } from '@nestjs/common';
import { extname } from 'path';

@Injectable()
export class MediaService {
  validateFile(file: Express.Multer.File, platform?: string, postType?: string): void {
    const pType = postType?.toUpperCase() || 'POST';
    const plat = platform?.toUpperCase() || 'UNKNOWN';

    const ext = extname(file.originalname).toLowerCase().replace('.', '');
    let allowedFormats: string[] = [];
    let maxSize = 0;

    if (plat === 'FACEBOOK') {
      if (pType === 'ALBUM') {
        maxSize = 8 * 1024 * 1024;
        allowedFormats = ['jpg', 'jpeg', 'png'];
      } else if (pType === 'REEL') {
        maxSize = 512 * 1024 * 1024;
        allowedFormats = ['mp4', 'mov'];
      } else if (pType === 'VIDEO' || ['mp4', 'mov'].includes(ext)) {
        maxSize = 1024 * 1024 * 1024;
        allowedFormats = ['mp4', 'mov'];
      } else {
        maxSize = 8 * 1024 * 1024;
        allowedFormats = ['jpg', 'jpeg', 'png', 'webp'];
      }
    } else if (plat === 'INSTAGRAM') {
      if (pType === 'CAROUSEL') {
        maxSize = 8 * 1024 * 1024;
        allowedFormats = ['jpg', 'jpeg', 'png', 'mp4'];
      } else if (pType === 'REEL') {
        maxSize = 100 * 1024 * 1024;
        allowedFormats = ['mp4', 'mov'];
      } else if (pType === 'VIDEO' || ['mp4', 'mov'].includes(ext)) {
        maxSize = 100 * 1024 * 1024;
        allowedFormats = ['mp4', 'mov'];
      } else {
        maxSize = 8 * 1024 * 1024;
        allowedFormats = ['jpg', 'jpeg', 'png', 'heic', 'webp'];
      }
    } else {
      maxSize = 50 * 1024 * 1024;
      allowedFormats = ['jpg', 'jpeg', 'png', 'mp4', 'mov'];
    }

    if (!allowedFormats.includes(ext)) {
      throw new BadRequestException(`Invalid file format for ${platform} ${postType}. Allowed: ${allowedFormats.join(', ')}`);
    }

    if (file.size > maxSize) {
      throw new BadRequestException(`File too large for ${platform} ${postType}. Maximum allowed: ${maxSize}`);
    }
  }

  getPublicUrl(filename: string): string {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    return `${baseUrl}/uploads/${filename}`;
  }
}
