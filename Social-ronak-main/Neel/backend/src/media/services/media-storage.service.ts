import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MediaStorageService {
  private logger = new Logger('MediaStorage');
  private uploadsDir: string;
  private publicUrl: string;

  constructor() {
    // Use environment variables for configuration
    const uploadsPath = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
    this.uploadsDir = uploadsPath;
    
    // Public URL for accessing files (should be HTTPS in production)
    this.publicUrl = 
      process.env.PUBLIC_URL || 
      process.env.BACKEND_URL || 
      process.env.APP_URL || 
      'http://localhost:3001';
    
    // Remove trailing slash
    this.publicUrl = this.publicUrl.replace(/\/+$/, '');

    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
      this.logger.log(`Created uploads directory: ${this.uploadsDir}`);
    }

    this.logger.log(`Uploads directory: ${this.uploadsDir}`);
    this.logger.log(`Public URL: ${this.publicUrl}`);
  }

  /**
   * Get the public URL for a file
   */
  getPublicUrl(filename: string): string {
    // Ensure proper formatting
    const cleanFilename = path.basename(filename);
    return `${this.publicUrl}/uploads/${cleanFilename}`;
  }

  /**
   * Get the local filesystem path for a file
   */
  getLocalPath(filename: string): string {
    return path.join(this.uploadsDir, path.basename(filename));
  }

  /**
   * Save (move) a file to the uploads directory
   */
  saveFile(sourcePath: string, destinationFilename: string): {
    filename: string;
    path: string;
    publicUrl: string;
  } {
    try {
      const destPath = this.getLocalPath(destinationFilename);
      
      // Ensure source exists
      if (!fs.existsSync(sourcePath)) {
        throw new Error('Source file not found');
      }

      // Copy file
      fs.copyFileSync(sourcePath, destPath);
      this.logger.debug(`Saved file: ${destinationFilename}`);

      return {
        filename: destinationFilename,
        path: destPath,
        publicUrl: this.getPublicUrl(destinationFilename),
      };
    } catch (error: any) {
      this.logger.error(`Failed to save file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a file from uploads
   */
  deleteFile(filename: string): void {
    try {
      const filePath = this.getLocalPath(filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.debug(`Deleted file: ${filename}`);
      }
    } catch (error: any) {
      this.logger.warn(`Failed to delete ${filename}: ${error.message}`);
    }
  }

  /**
   * Get file size
   */
  getFileSize(filename: string): number {
    try {
      const filePath = this.getLocalPath(filename);
      if (fs.existsSync(filePath)) {
        return fs.statSync(filePath).size;
      }
      return 0;
    } catch (error: any) {
      this.logger.warn(`Failed to get file size: ${error.message}`);
      return 0;
    }
  }

  /**
   * Check if file exists
   */
  fileExists(filename: string): boolean {
    return fs.existsSync(this.getLocalPath(filename));
  }

  /**
   * Clean up old files (optional maintenance)
   * Deletes files older than specified days
   */
  cleanupOldFiles(daysOld: number = 7): number {
    let deletedCount = 0;
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

    try {
      const files = fs.readdirSync(this.uploadsDir);
      
      for (const file of files) {
        const filePath = path.join(this.uploadsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtimeMs < cutoffTime) {
          fs.unlinkSync(filePath);
          deletedCount++;
          this.logger.debug(`Cleaned up old file: ${file}`);
        }
      }

      this.logger.log(`Cleanup complete: deleted ${deletedCount} old files`);
    } catch (error: any) {
      this.logger.error(`Cleanup failed: ${error.message}`);
    }

    return deletedCount;
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): {
    totalSize: number;
    fileCount: number;
    directory: string;
  } {
    try {
      const files = fs.readdirSync(this.uploadsDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(this.uploadsDir, file);
        if (fs.statSync(filePath).isFile()) {
          totalSize += fs.statSync(filePath).size;
        }
      }

      return {
        totalSize,
        fileCount: files.length,
        directory: this.uploadsDir,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get storage stats: ${error.message}`);
      return {
        totalSize: 0,
        fileCount: 0,
        directory: this.uploadsDir,
      };
    }
  }
}
