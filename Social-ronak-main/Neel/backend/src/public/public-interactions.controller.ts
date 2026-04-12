import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('public/posts')
export class PublicInteractionsController {
  constructor(private readonly prisma: PrismaService) {}

  // All interaction endpoints now require JWT auth to prevent abuse
  @UseGuards(AuthGuard('jwt'))
  @Post(':postId/like')
  async toggleLike(
    @Param('postId') postId: string,
    @Request() req: any,
  ) {
    // Use authenticated user's ID instead of accepting from body
    const userId = req.user.sub;

    const existingLike = await this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existingLike) {
      await this.prisma.postLike.delete({ where: { id: existingLike.id } });
      return { message: 'Post unliked', liked: false };
    } else {
      await this.prisma.postLike.create({
        data: { postId, userId },
      });
      return { message: 'Post liked', liked: true };
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':postId/comment')
  async addComment(
    @Param('postId') postId: string,
    @Request() req: any,
    @Body('content') content: string,
  ) {
    const userId = req.user.sub;
    if (!content || !content.trim()) {
      throw new BadRequestException('content is required');
    }

    // Sanitize content — strip HTML tags to prevent XSS
    const sanitizedContent = content.trim().replace(/<[^>]*>/g, '').substring(0, 500);
    const userName = req.user.name || req.user.email || 'User';

    return this.prisma.postComment.create({
      data: {
        postId,
        userId,
        content: sanitizedContent,
        userName,
      },
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':postId/comment/:commentId')
  async deleteComment(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Request() req: any,
  ) {
    // Only allow deleting own comments
    const comment = await this.prisma.postComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new BadRequestException('Comment not found');
    }

    if (comment.userId !== req.user.sub) {
      throw new BadRequestException('You can only delete your own comments');
    }

    return this.prisma.postComment.delete({
      where: { id: commentId },
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':postId/share')
  async logShare(
    @Param('postId') postId: string,
    @Request() req: any,
  ) {
    const userId = req.user.sub;
    return this.prisma.postShare.create({
      data: { postId, userId },
    });
  }
}
