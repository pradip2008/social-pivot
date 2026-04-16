import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MediaController } from './media-upload.controller';
import { ImageProcessorService } from './services/image-processor.service';
import { VideoProcessorService } from './services/video-processor.service';
import { MediaStorageService } from './services/media-storage.service';
import { InstagramService } from './services/instagram.service';

@Module({
  imports: [
    // Serve static files from uploads directory
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
  ],
  controllers: [MediaController],
  providers: [ImageProcessorService, VideoProcessorService, MediaStorageService, InstagramService],
  exports: [ImageProcessorService, VideoProcessorService, MediaStorageService, InstagramService],
})
export class MediaUploadModule {}
