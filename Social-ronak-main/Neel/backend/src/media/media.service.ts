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

    // Common video formats to recognize any video file
    const commonVideoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'mts', 'm2ts', 'ts', 'vob', 'ogv', '3gp', 'quicktime'];
    const commonImageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp', 'svg'];
    
    // Detect if file is likely video or image based on extension
    const isLikelyVideo = commonVideoExts.includes(ext);

    if (plat === 'FACEBOOK') {
      if (pType === 'ALBUM') {
        maxSize = 8 * 1024 * 1024;
        allowedFormats = commonImageExts;
      } else if (pType === 'REEL') {
        // Facebook reels - accept MP4
        maxSize = 512 * 1024 * 1024;
        allowedFormats = ['mp4'];
      } else if (pType === 'VIDEO' || isLikelyVideo) {
        // Facebook videos - can accept more formats but will try MP4
        maxSize = 1024 * 1024 * 1024;
        allowedFormats = ['mp4', 'mov', 'avi'];
      } else {
        maxSize = 8 * 1024 * 1024;
        allowedFormats = commonImageExts;
      }
    } else if (plat === 'INSTAGRAM') {
      if (pType === 'CAROUSEL') {
        maxSize = 8 * 1024 * 1024;
        allowedFormats = commonImageExts;
      } else if (pType === 'REEL') {
        // Instagram Reels - support all video formats
        maxSize = 100 * 1024 * 1024;
        allowedFormats = commonVideoExts;
      } else if (pType === 'VIDEO' || isLikelyVideo) {
        // Instagram Videos - support all video formats
        maxSize = 100 * 1024 * 1024;
        allowedFormats = commonVideoExts;
      } else {
        maxSize = 8 * 1024 * 1024;
        allowedFormats = commonImageExts;
      }
    } else {
      // LinkedIn, Twitter, etc. - accept common formats
      maxSize = 100 * 1024 * 1024;
      allowedFormats = [...commonImageExts, ...commonVideoExts];
    }

    if (!allowedFormats.includes(ext)) {
      throw new BadRequestException(
        `Invalid file format: .${ext}. Supported: ${allowedFormats.join(', ')}`
      );
    }

    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      throw new BadRequestException(
        `File too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum: ${maxSizeMB.toFixed(0)}MB`
      );
    }
  }

  getPublicUrl(filename: string): string {
    // Use same fallback logic as meta.service to ensure consistency
    const baseUrl = process.env.BASE_URL || process.env.APP_URL || process.env.BACKEND_URL || 'https://social-ronak.onrender.com';
    const cleanBase = baseUrl.replace(/\/+$/, '');
    return `${cleanBase}/uploads/${filename}`;
  }
}
