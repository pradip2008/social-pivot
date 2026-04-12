import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostsService {
  private logger = new Logger(PostsService.name);

  constructor(private prisma: PrismaService) {}

  async createDraft(companyId: string, userId: string, data: any) {
    return this.prisma.draftPost.create({
      data: {
        companyId,
        userId,
        platform: data.platform,
        content: data.content,
        topic: data.topic,
        tone: data.tone,
        audience: data.audience,
        cta: data.cta,
        mediaUrl: data.mediaUrl,
      },
    });
  }

  async getDrafts(companyId: string) {
    return this.prisma.draftPost.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPosts(companyId: string, platform?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const where = {
      companyId,
      platform: platform || undefined,
      isDeleted: false,
    };

    const [total, posts] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: posts,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async updatePost(
    companyId: string,
    postId: string,
    data: { content?: string; mediaUrl?: string },
  ) {
    return this.prisma.post.updateMany({
      where: { id: postId, companyId },
      data,
    });
  }

  /**
   * Delete a post:
   * Step 1 — Attempt Meta API delete (if external post)
   * Step 2 — Soft delete in database (isDeleted: true, deletedAt: now)
   * 
   * @param forceDelete — if true, skip Meta API failure and force soft-delete anyway
   */
  async deletePost(companyId: string, postId: string, forceDelete = false) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, companyId, isDeleted: false }
    });

    if (!post) {
      throw new NotFoundException('Post not found or already deleted');
    }

    let metaDeleteResult: { success: boolean; error?: string } = { success: true };

    // Step 1 — Delete from social media if applicable
    if (post.externalPostId && (post.platform === 'facebook' || post.platform === 'instagram')) {
      try {
        const connection = await this.prisma.metaConnection.findFirst({
          where: { companyId, platform: post.platform, isActive: true }
        });

        if (connection && connection.accessToken) {
          // Use the stored access token (it's encrypted in DB, but for API call we need decrypted)
          // The token stored in metaConnection is encrypted — use fetch with the raw token 
          // We can't easily decrypt here without MetaService, so we use the connection as-is
          // The frontend handles the "proceed anyway" flow
          const { decryptToken } = require('../utils/encryption.util');
          let decryptedToken = connection.accessToken;
          try {
            decryptedToken = decryptToken(connection.accessToken) || connection.accessToken;
          } catch (e) {
            // Use as-is if decryption fails
          }

          const apiVersion = 'v25.0';
          const res = await fetch(`https://graph.facebook.com/${apiVersion}/${post.externalPostId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${decryptedToken}` },
          });
          const data = await res.json();
          if (data.error) {
            const errorMsg = data.error.message || 'Unknown Meta API error';
            this.logger.warn(`Meta API delete failed for ${post.externalPostId}: ${errorMsg}`);
            metaDeleteResult = { success: false, error: errorMsg };

            // If not force-deleting, return the error and let the admin decide
            if (!forceDelete) {
              return {
                softDeleted: false,
                metaDeleteFailed: true,
                metaError: errorMsg,
                message: `Failed to delete from ${post.platform}: ${errorMsg}. You can still force-delete from Social Pivot.`,
              };
            }
          }
        }
      } catch (err: any) {
        const errorMsg = err.message || 'Network error while deleting from social media';
        this.logger.error(`Error attempting Meta Graph API delete for post ${post.externalPostId}: ${errorMsg}`);
        metaDeleteResult = { success: false, error: errorMsg };

        if (!forceDelete) {
          return {
            softDeleted: false,
            metaDeleteFailed: true,
            metaError: errorMsg,
            message: `Failed to delete from ${post.platform}: ${errorMsg}. You can still force-delete from Social Pivot.`,
          };
        }
      }
    }

    // Step 2 — Soft delete in database
    await this.prisma.post.update({
      where: { id: postId },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    return {
      softDeleted: true,
      metaDeleteFailed: !metaDeleteResult.success,
      metaError: metaDeleteResult.error || null,
      message: metaDeleteResult.success
        ? 'Post deleted from social media and hidden from Social Pivot.'
        : `Post hidden from Social Pivot. Meta API delete failed: ${metaDeleteResult.error}`,
    };
  }

  /**
   * Force-delete: soft delete in DB even if Meta API failed.
   */
  async forceDeletePost(companyId: string, postId: string) {
    return this.deletePost(companyId, postId, true);
  }

  async deleteDraft(companyId: string, draftId: string) {
    return this.prisma.draftPost.deleteMany({
      where: { id: draftId, companyId },
    });
  }
}
