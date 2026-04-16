import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import FFmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

// Get ffmpeg and ffprobe from fluent-ffmpeg
const ffmpeg = FFmpeg;
const ffprobe = FFmpeg.ffprobe;

// Promisify fs functions
const fsUnlink = promisify(fs.unlink);

@Injectable()
export class VideoProcessorService {
  private logger = new Logger('VideoProcessor');

  constructor() {
    // Use system-installed FFmpeg (ensure it's in PATH)
    // You can override with: FFmpeg.setFfmpegPath('/path/to/ffmpeg')
    // For Windows: FFmpeg.setFfmpegPath('C:\\ffmpeg\\bin\\ffmpeg.exe');
  }

  /**
   * Process video for Instagram compatibility
   * - Convert to MP4 with H.264 + AAC
   * - Resize to max 1080px width
   * - Maintain aspect ratio (between 4:5 and 16:9)
   * - Trim to max 60 seconds (Instagram limit)
   * - Compress to reduce file size
   * - Ensure 100MB max size (Instagram video limit)
   */
  async processVideo(inputPath: string, outputDir: string, options?: {
    maxDuration?: number; // seconds, default 60
    crf?: number; // quality 0-51, default 23 (lower = better)
  }): Promise<{
    path: string;
    filename: string;
    size: number;
    duration: number;
    width?: number;
    height?: number;
    fps?: number;
  }> {
    return new Promise((resolve, reject) => {
      try {
        // Validate input
        if (!fs.existsSync(inputPath)) {
          throw new BadRequestException('Input video file not found');
        }

        const inputStats = fs.statSync(inputPath);
        const inputSize = inputStats.size;

        // Max input size: 500MB
        const maxInputSize = 500 * 1024 * 1024;
        if (inputSize > maxInputSize) {
          throw new BadRequestException(
            `Video too large. Max ${maxInputSize / (1024 * 1024)}MB, got ${(inputSize / (1024 * 1024)).toFixed(2)}MB`,
          );
        }

        this.logger.debug(`Processing video: ${inputPath} (${(inputSize / (1024 * 1024)).toFixed(2)}MB)`);

        // Create output filename
        const outputFilename = `vid_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`;
        const outputPath = path.join(outputDir, outputFilename);

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const maxDuration = options?.maxDuration || 60; // 60 seconds for Instagram
        const crf = options?.crf || 23; // Quality level (23 is good default)

        // Proceed with encoding directly
        this.encodeVideo(inputPath, outputPath, maxDuration, crf, inputSize)
          .then(resolve)
          .catch(reject);
      } catch (error: any) {
        this.logger.error(`Video processing failed: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Encode video with Instagram-optimized settings
   */
  private encodeVideo(
    inputPath: string,
    outputPath: string,
    maxDuration: number,
    crf: number,
    inputSize: number,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.logger.log(`Starting video encoding to ${outputPath}...`);

      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',           // H.264 video codec
          '-preset fast',             // Speed/quality trade-off (fast, medium, slow)
          `-crf ${crf}`,             // Quality (default 23)
          '-c:a aac',                // AAC audio codec
          '-b:a 128k',               // Audio bitrate
          '-vf scale=1080:1080:force_original_aspect_ratio=decrease', // Resize maintaining aspect
          '-t ' + maxDuration,       // Trim to max duration
          '-movflags +faststart',    // Enable progressive download
          '-y',                      // Overwrite output
        ])
        .on('start', (cmd) => {
          this.logger.debug(`Encoding started. FFmpeg command: ${cmd.substring(0, 100)}...`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            this.logger.debug(`Encoding progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on('error', async (err) => {
          this.logger.error(`Video encoding error: ${err.message}`);
          // Clean up output file if encoding failed
          if (fs.existsSync(outputPath)) {
            try {
              await fsUnlink(outputPath);
            } catch (e) {
              // Ignore cleanup errors
            }
          }
          reject(new BadRequestException(`Video encoding failed: ${err.message}`));
        })
        .on('end', async () => {
          try {
            // Verify output file exists and check size
            if (!fs.existsSync(outputPath)) {
              throw new BadRequestException('Encoded video file not found');
            }

            const stats = fs.statSync(outputPath);
            const outputSize = stats.size;

            // Instagram video limit: 100MB
            const maxOutputSize = 100 * 1024 * 1024;
            if (outputSize > maxOutputSize) {
              await fsUnlink(outputPath);
              throw new BadRequestException(
                `Encoded video exceeds Instagram limits (${(outputSize / (1024 * 1024)).toFixed(2)}MB). ` +
                `Try reducing CRF or trimming duration.`,
              );
            }

            this.logger.log(
              `✓ Video encoded: ${(inputSize / (1024 * 1024)).toFixed(2)}MB → ${(outputSize / (1024 * 1024)).toFixed(2)}MB, ` +
              `CRF=${crf}`,
            );

            // Get final video info
            ffprobe(outputPath, (err, metadata) => {
              if (err) {
                this.logger.warn(`Could not get video metadata: ${err.message}`);
                resolve({
                  path: outputPath,
                  filename: path.basename(outputPath),
                  size: outputSize,
                  duration: 0,
                });
                return;
              }

              const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
              const duration = metadata.format?.duration || 0;

              resolve({
                path: outputPath,
                filename: path.basename(outputPath),
                size: outputSize,
                duration: Math.round(duration),
                width: videoStream?.width,
                height: videoStream?.height,
                fps: this.calculateFps(videoStream?.r_frame_rate),
              });
            });
          } catch (error: any) {
            reject(error);
          }
        })
        .save(outputPath);
    });
  }

  /**
   * Calculate FPS from frame rate string (e.g., "30000/1001" or "24")
   */
  private calculateFps(frameRateStr?: string): number | undefined {
    if (!frameRateStr) return undefined;
    try {
      if (frameRateStr.includes('/')) {
        const [num, den] = frameRateStr.split('/').map(Number);
        return Math.round((num / den) * 10) / 10;
      }
      return parseFloat(frameRateStr);
    } catch {
      return undefined;
    }
  }

  /**
   * Get video duration
   */
  async getVideoDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(metadata.format?.duration || 0);
      });
    });
  }

  /**
   * Clean up temporary file
   */
  async cleanupFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await fsUnlink(filePath);
        this.logger.debug(`Cleaned up: ${filePath}`);
      }
    } catch (error: any) {
      this.logger.warn(`Failed to clean up ${filePath}: ${error.message}`);
    }
  }
}
