import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Module({
  imports: [
    MulterModule.register({
      dest: process.cwd() + '/uploads',
      limits: { fileSize: 1024 * 1024 * 1024 }, // Overall rigid fallback catch constraint: 1GB
      storage: diskStorage({
        destination: process.cwd() + '/uploads',
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `media-${uuidv4()}-${Date.now()}${ext}`);
        },
      }),
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
