import {
  Controller,
  Get,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PublicService } from './public.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, basename } from 'path';
import { Response } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { BadRequestException } from '@nestjs/common';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('feed/:slug')
  getCompanyFeed(@Param('slug') slug: string) {
    return this.publicService.getCompanyFeed(slug);
  }

  @Get('profile/:slug')
  getCompanyProfile(@Param('slug') slug: string) {
    return this.publicService.getCompanyFeed(slug);
  }

  @Get('uploads/:filename')
  getFile(@Param('filename') filename: string, @Res() res: Response) {
    // Prevent path traversal
    const safeFilename = basename(filename);
    
    const ext = extname(safeFilename).toLowerCase();
    const whitelist = ['.jpg', '.jpeg', '.png', '.mp4', '.webp', '.gif', '.mov'];
    
    if (!whitelist.includes(ext)) {
      throw new BadRequestException('Invalid file extension request.');
    }

    const filePath = join(process.cwd(), 'uploads', safeFilename);
    
    if (!existsSync(filePath)) {
      throw new BadRequestException('File not found');
    }
    
    return res.sendFile(filePath);
  }
}
