import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Delete,
  Param,
  UseGuards,
  Request,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PostsService } from './posts.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { MetaService } from '../meta/meta.service';
import { PrismaService } from '../prisma/prisma.service';
import { IsString, IsOptional, IsDateString } from 'class-validator';

class CreateDraftDto {
  @IsString() platform: string;
  @IsString() content: string;
  @IsOptional() @IsString() topic: string;
  @IsOptional() @IsString() tone: string;
  @IsOptional() @IsString() audience: string;
  @IsOptional() @IsString() cta: string;
  @IsOptional() @IsString() mediaUrl: string;
}

class SchedulePostDto {
  @IsString() platform: string;
  @IsString() content: string;
  @IsDateString() scheduledAt: string;
  @IsOptional() @IsString() mediaUrl?: string;
  @IsOptional() @IsString() mediaType?: string;   // IMAGE | VIDEO | REEL
  @IsOptional() @IsString() postType?: string;    // SINGLE_IMAGE | CAROUSEL | ALBUM | REEL | VIDEO | TEXT | LINK
  @IsOptional() mediaUrls?: string[];             // For carousel and album multi-media
  @IsOptional() @IsString() linkUrl?: string;     // For Facebook LINK post type
}

@UseGuards(AuthGuard('jwt'))
@Controller('posts')
export class PostsController {
  constructor(
    private postsService: PostsService,
    private schedulerService: SchedulerService,
    private metaService: MetaService,
    private prisma: PrismaService,
  ) {}

  @Post('draft')
  async createDraft(@Request() req: any, @Body() body: CreateDraftDto) {
    return this.postsService.createDraft(
      req.user.companyId,
      req.user.sub,
      body,
    );
  }

  @Post('schedule')
  async schedulePost(@Request() req: any, @Body() body: SchedulePostDto) {
    console.log('[Posts Controller] Schedule request received:', {
      platform: body.platform,
      contentLength: body.content?.length,
      mediaUrl: body.mediaUrl,
      mediaType: body.mediaType,
      postType: body.postType,
      mediaUrls: body.mediaUrls ? (Array.isArray(body.mediaUrls) ? `[${body.mediaUrls.length} items]` : body.mediaUrls) : 'undefined',
      scheduledAt: body.scheduledAt,
      allKeys: Object.keys(body),
    });
    try {
      return await this.schedulerService.schedulePost(
        req.user.sub,
        req.user.companyId,
        body,
      );
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to schedule post');
    }
  }

  @Post('publish-now')
  async publishNow(@Request() req: any, @Body() body: Partial<SchedulePostDto>) {
    if (!body.platform || !body.content) {
      throw new BadRequestException('Platform and content are required');
    }
    
    // DEBUG: Log incoming payload
    console.log('[Posts Controller] Publish-now request:', {
      platform: body.platform,
      contentLength: body.content?.length,
      mediaUrl: body.mediaUrl,
      mediaType: body.mediaType,
      postType: body.postType,
      mediaUrls: body.mediaUrls ? `[${body.mediaUrls.length} items]` : 'undefined',
    });
    
    // ISSUE FIX: Validate required fields before publishing
    const p = (body.platform || '').toLowerCase();
    if (p === 'instagram') {
      if (!body.mediaUrl && (!body.mediaUrls || body.mediaUrls.length === 0)) {
        throw new BadRequestException('Instagram posts require media (image, video, or reel). Please upload a media file before publishing.');
      }
      // VALIDATE mediaType for Instagram
      if (!body.mediaType) {
        console.warn('[Posts Controller] WARNING: mediaType is not set for Instagram! Will auto-detect from URL.');
      }
    }
    if (p === 'facebook') {
      const hasMedia = body.mediaUrl || (body.mediaUrls && body.mediaUrls.length > 0);
      const hasLink = body.linkUrl;
      if (!hasMedia && !hasLink) {
        throw new BadRequestException('Facebook posts require either media (image/video) or a link URL. Please add media or a link before publishing.');
      }
    }
    
    const result = await this.metaService.publishPost(
      req.user.companyId,
      body.platform,
      body.content,
      body.mediaUrl,
      body.mediaType,
      body.postType,
      body.mediaUrls,
      body.linkUrl
    );

    if (result.success) {
      try {
        await this.prisma.post.create({
          data: {
            companyId: req.user.companyId,
            platform: body.platform,
            content: body.content,
            mediaUrl: body.mediaUrl || null,
            publishedAt: new Date(),
            externalPostId: result.postId,
            source: 'platform',
            isPublished: true,
          },
        });
        return { success: true, postId: result.postId, message: 'Published successfully' };
      } catch (dbError) {
        // If the database insert fails, the post is on Meta but not in our DB.
        // We log it and return a message indicating partial success.
        console.error('Failed to save published post to database:', dbError);
        return { 
          success: true, 
          postId: result.postId, 
          message: 'Published to Meta successfully, but failed to save to local database.',
          warning: 'Database synchronization error.'
        };
      }
    } else {
      throw new BadRequestException(result.message);
    }
  }

  @Get()
  async getPosts(
    @Request() req: any,
    @Query('platform') platform?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.postsService.getPosts(
      req.user.companyId,
      platform,
      parseInt(page, 10),
      parseInt(limit, 10)
    );
  }

  @Get('drafts')
  async getDrafts(@Request() req: any) {
    return this.postsService.getDrafts(req.user.companyId);
  }

  @Put(':id')
  async updatePost(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { content?: string; mediaUrl?: string },
  ) {
    return this.postsService.updatePost(req.user.companyId, id, body);
  }

  @Delete(':id')
  async deletePost(@Request() req: any, @Param('id') id: string) {
    return this.postsService.deletePost(req.user.companyId, id);
  }

  /**
   * Force-delete: soft delete locally even if Meta API delete failed.
   */
  @Delete(':id/force')
  async forceDeletePost(@Request() req: any, @Param('id') id: string) {
    return this.postsService.forceDeletePost(req.user.companyId, id);
  }

  @Delete('drafts/:id')
  async deleteDraft(@Request() req: any, @Param('id') id: string) {
    return this.postsService.deleteDraft(req.user.companyId, id);
  }
}
