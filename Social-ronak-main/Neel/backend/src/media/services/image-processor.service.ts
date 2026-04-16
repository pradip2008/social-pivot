import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ImageProcessorService {
  private logger = new Logger('ImageProcessor');

  /**
   * Process image for Instagram compatibility
   * - Convert to JPEG
   * - Resize to max 1080px width maintaining aspect ratio
   * - Compress to reduce file size
   * - Ensure 8MB max size
   */
  async processImage(inputPath: string, outputDir: string): Promise<{
    path: string;
    filename: string;
    size: number;
    format: 'jpeg' | 'png' | 'webp';
    width?: number;
    height?: number;
  }> {
    try {
      this.logger.debug(`Processing image: ${inputPath}`);

      // Read input file
      if (!fs.existsSync(inputPath)) {
        throw new BadRequestException('Input image file not found');
      }

      const inputStats = fs.statSync(inputPath);
      const inputSize = inputStats.size;
      
      // Max input size: 50MB (before processing)
      const maxInputSize = 50 * 1024 * 1024;
      if (inputSize > maxInputSize) {
        throw new BadRequestException(
          `Image too large. Max ${maxInputSize / (1024 * 1024)}MB, got ${(inputSize / (1024 * 1024)).toFixed(2)}MB`,
        );
      }

      // Get metadata
      const metadata = await sharp(inputPath).metadata();
      this.logger.debug(`Original image: ${metadata.width}x${metadata.height}, format=${metadata.format}`);

      // Create output filename
      const outputFilename = `img_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const outputPath = path.join(outputDir, outputFilename);

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Process: Resize to max 1080px width, convert to JPEG, compress
      let pipeline = sharp(inputPath)
        .resize(1080, 1080, {
          fit: 'inside', // Maintain aspect ratio
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 85, // Good balance between quality and size
          progressive: true,
        });

      // Write to file
      const info = await pipeline.toFile(outputPath);
      
      const outputSize = info.size;
      this.logger.log(
        `✓ Image processed: ${metadata.width}x${metadata.height} → ${info.width}x${info.height}, ` +
        `${(inputSize / 1024).toFixed(0)}KB → ${(outputSize / 1024).toFixed(0)}KB`,
      );

      // Verify Instagram size limit (8MB for photos)
      const maxOutputSize = 8 * 1024 * 1024;
      if (outputSize > maxOutputSize) {
        fs.unlinkSync(outputPath); // Clean up
        throw new BadRequestException(
          `Processed image exceeds Instagram limits (${(outputSize / (1024 * 1024)).toFixed(2)}MB). ` +
          `Try a smaller original image.`,
        );
      }

      return {
        path: outputPath,
        filename: outputFilename,
        size: outputSize,
        format: 'jpeg',
        width: info.width,
        height: info.height,
      };
    } catch (error: any) {
      this.logger.error(`Image processing failed: ${error.message}`);
      // Clean up input file if processing failed
      if (fs.existsSync(inputPath)) {
        try {
          fs.unlinkSync(inputPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      throw error;
    }
  }

  /**
   * Get image dimensions
   */
  async getImageDimensions(filePath: string): Promise<{ width?: number; height?: number }> {
    try {
      const metadata = await sharp(filePath).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
      };
    } catch (error) {
      this.logger.warn(`Could not get image dimensions: ${error.message}`);
      return {};
    }
  }

  /**
   * Clean up temporary file
   */
  cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.debug(`Cleaned up: ${filePath}`);
      }
    } catch (error: any) {
      this.logger.warn(`Failed to clean up ${filePath}: ${error.message}`);
    }
  }
}
