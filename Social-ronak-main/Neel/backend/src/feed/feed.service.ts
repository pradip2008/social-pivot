import { Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { FanSignupDto, FanLoginDto } from './dto/fan-auth.dto';
import { AddCommentDto } from './dto/comment.dto';

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Public: Company Profile by ID ───

  async getCompanyProfile(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const postCount = await this.prisma.post.count({
      where: { companyId, isDeleted: false, isPublished: true },
    });
    const reelCount = await this.prisma.reel.count({ where: { companyId } });

    return {
      id: company.id,
      name: company.name,
      logo: company.logoUrl || null,
      bio: company.bio || null,
      postCount,
      reelCount,
    };
  }

  // ─── Public: Company Profile by Slug ───

  async getCompanyBySlug(slug: string, isAdmin: boolean = false) {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      include: {
        _count: { select: { fans: true } },
      },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const [posts, reels] = await Promise.all([
      this.prisma.post.findMany({
        where: { companyId: company.id, isDeleted: false, isPublished: true },
        orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            mediaUrl: true,
            content: true,
            createdAt: true,
            externalPostId: true,
            isPublished: true,
            _count: { select: { likes: true, comments: true } },
          },
      }),
      this.prisma.reel.findMany({
        where: { companyId: company.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          videoUrl: true,
          caption: true,
          createdAt: true,
          _count: { select: { likes: true, comments: true } },
        },
      }),
    ]);

    let scheduledPosts: any[] = [];
    if (isAdmin) {
      scheduledPosts = await this.prisma.scheduledPost.findMany({
        where: { companyId: company.id, status: 'Scheduled' },
        orderBy: { scheduledAt: 'asc' },
      });
    }

    const allPosts = [
      ...scheduledPosts.map((sp) => {
        let firstMediaUrl = sp.mediaUrl;
        if (!firstMediaUrl && sp.mediaUrls) {
          try {
            const parsed = typeof sp.mediaUrls === 'string' ? JSON.parse(sp.mediaUrls) : sp.mediaUrls;
            if (Array.isArray(parsed) && parsed.length > 0) {
              firstMediaUrl = parsed[0];
            }
          } catch { }
        }
        return {
          id: sp.id,
          imageUrl: firstMediaUrl,
          caption: sp.content,
          type: 'post' as const,
          createdAt: sp.scheduledAt.toISOString(),
          likeCount: 0,
          commentCount: 0,
          isPending: true,
        };
      }),
      ...posts.map((p) => ({
        id: p.id,
        imageUrl: p.mediaUrl,
        caption: p.content,
        type: 'post' as const,
        createdAt: p.createdAt.toISOString(),
        likeCount: p._count.likes,
        commentCount: p._count.comments,
        isPending: false,
      })),
    ];

    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        bio: company.bio || null,
        avatar: company.logoUrl || null,
      },
      posts: allPosts,
      reels: reels.map((r) => ({
        id: r.id,
        videoUrl: r.videoUrl,
        caption: r.caption,
        type: 'reel' as const,
        createdAt: r.createdAt.toISOString(),
        likeCount: r._count.likes,
        commentCount: r._count.comments,
      })),
      fanCount: company._count.fans,
    };
  }

  // ─── Public: Feed Posts (paginated) ───

  async getFeedPosts(companyId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [total, posts] = await Promise.all([
      this.prisma.post.count({ where: { companyId, isDeleted: false, isPublished: true } }),
      this.prisma.post.findMany({
        where: { companyId, isDeleted: false, isPublished: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          mediaUrl: true,
          content: true,
          createdAt: true,
          externalPostId: true,
          isPublished: true,
          _count: {
            select: { likes: true, comments: true },
          },
        },
      }),
    ]);

    const data = posts.map((post) => ({
      id: post.id,
      imageUrl: post.mediaUrl,
      caption: post.content,
      createdAt: post.createdAt.toISOString(),
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      isPending: !post.isPublished,
    }));

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ─── Public: Reels (paginated) ───

  async getReels(companyId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [total, reels] = await Promise.all([
      this.prisma.reel.count({ where: { companyId } }),
      this.prisma.reel.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          videoUrl: true,
          caption: true,
          createdAt: true,
          _count: {
            select: { likes: true, comments: true },
          },
        },
      }),
    ]);

    const data = reels.map((reel) => ({
      id: reel.id,
      videoUrl: reel.videoUrl,
      caption: reel.caption,
      createdAt: reel.createdAt.toISOString(),
      likeCount: reel._count.likes,
      commentCount: reel._count.comments,
    }));

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ─── Public: Post Detail ───

  async getPostDetail(postId: string, fanId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        _count: { select: { likes: true, comments: true } },
        comments: {
          orderBy: { createdAt: 'desc' },
          include: { fan: true },
        },
      },
    });

    if (!post) throw new NotFoundException('Post not found');

    let hasLiked = false;
    if (fanId) {
      const like = await this.prisma.like.findUnique({
        where: {
          fanId_postId: { fanId, postId },
        },
      });
      hasLiked = !!like;
    }

    return {
      id: post.id,
      imageUrl: post.mediaUrl,
      caption: post.content,
      createdAt: post.createdAt.toISOString(),
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      hasLiked,
      isPending: !post.isPublished,
      comments: post.comments.map((c) => ({
        id: c.id,
        text: c.text,
        createdAt: c.createdAt.toISOString(),
        fan: {
          id: c.fan.id,
          name: c.fan.name,
          profileImage: c.fan.profileImage,
        },
      })),
    };
  }

  // ─── Public: Reel Detail ───

  async getReelDetail(reelId: string, fanId?: string) {
    const reel = await this.prisma.reel.findUnique({
      where: { id: reelId },
      include: {
        _count: { select: { likes: true, comments: true } },
        comments: {
          orderBy: { createdAt: 'desc' },
          include: { fan: true },
        },
      },
    });

    if (!reel) throw new NotFoundException('Reel not found');

    let hasLiked = false;
    if (fanId) {
      const like = await this.prisma.like.findUnique({
        where: {
          fanId_reelId: { fanId, reelId },
        },
      });
      hasLiked = !!like;
    }

    return {
      id: reel.id,
      videoUrl: reel.videoUrl,
      caption: reel.caption,
      createdAt: reel.createdAt.toISOString(),
      likeCount: reel._count.likes,
      commentCount: reel._count.comments,
      hasLiked,
      comments: reel.comments.map((c) => ({
        id: c.id,
        text: c.text,
        createdAt: c.createdAt.toISOString(),
        fan: {
          id: c.fan.id,
          name: c.fan.name,
          profileImage: c.fan.profileImage,
        },
      })),
    };
  }

  // ─── Fan Auth: Token Generation ───

  private async generateFanToken(fanId: string, email: string, companyId: string) {
    const payload = { sub: fanId, email, companyId, type: 'fan' };
    const secret = this.configService.get<string>('FAN_JWT_SECRET');
    return this.jwtService.signAsync(payload, { secret, expiresIn: '7d' });
  }

  // ─── Fan Auth: Signup ───

  async fanSignup(dto: FanSignupDto) {
    // Check uniqueness per company (@@unique([email, companyId]))
    const existing = await this.prisma.fan.findFirst({
      where: { email: dto.email, companyId: dto.companyId },
    });
    if (existing) {
      throw new ConflictException('Email already registered for this community');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Sanitize name
    const cleanName = dto.name.replace(/<[^>]*>?/gm, '').trim();

    const fan = await this.prisma.fan.create({
      data: {
        name: cleanName,
        email: dto.email,
        password: hashedPassword,
        companyId: dto.companyId,
      },
    });

    const token = await this.generateFanToken(fan.id, fan.email, dto.companyId);
    return {
      token,
      fan: {
        id: fan.id,
        name: fan.name,
        email: fan.email,
        profileImage: null,
      },
    };
  }

  // ─── Fan Auth: Login ───

  async fanLogin(dto: FanLoginDto) {
    // Look up fan by email + companyId
    const fan = await this.prisma.fan.findFirst({
      where: { email: dto.email, companyId: dto.companyId },
    });
    if (!fan) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, fan.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = await this.generateFanToken(fan.id, fan.email, dto.companyId);
    return {
      token,
      fan: {
        id: fan.id,
        name: fan.name,
        email: fan.email,
        profileImage: fan.profileImage,
      },
    };
  }

  // ─── Interactions: Toggle Like ───

  async toggleLike(fanId: string | null, postId?: string, reelId?: string, isAdmin?: boolean) {
    // Admin likes are acknowledged but not persisted
    if (isAdmin) {
      if (postId) {
        const post = await this.prisma.post.findUnique({ where: { id: postId } });
        if (!post) throw new NotFoundException('Post not found');
        const count = await this.prisma.like.count({ where: { postId } });
        return { success: true, liked: true, likeCount: count };
      }
      if (reelId) {
        const reel = await this.prisma.reel.findUnique({ where: { id: reelId } });
        if (!reel) throw new NotFoundException('Reel not found');
        const count = await this.prisma.like.count({ where: { reelId } });
        return { success: true, liked: true, likeCount: count };
      }
      throw new BadRequestException('Must provide postId or reelId');
    }

    if (!fanId) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!postId && !reelId) {
      throw new BadRequestException('Must provide postId or reelId');
    }

    if (postId) {
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
      });
      if (!post) throw new NotFoundException('Post not found');

      const existing = await this.prisma.like.findUnique({
        where: { fanId_postId: { fanId, postId } },
      });

      if (existing) {
        await this.prisma.like.delete({ where: { id: existing.id } });
      } else {
        await this.prisma.like.create({ data: { fanId, postId } });
      }

      const count = await this.prisma.like.count({ where: { postId } });
      return { liked: !existing, likeCount: count };
    } else {
      const targetReelId = reelId!;
      const reel = await this.prisma.reel.findUnique({ where: { id: targetReelId } });
      if (!reel) throw new NotFoundException('Reel not found');

      const existing = await this.prisma.like.findUnique({
        where: { fanId_reelId: { fanId, reelId: targetReelId } },
      });

      if (existing) {
        await this.prisma.like.delete({ where: { id: existing.id } });
      } else {
        await this.prisma.like.create({ data: { fanId, reelId: targetReelId } });
      }

      const count = await this.prisma.like.count({ where: { reelId: targetReelId } });
      return { liked: !existing, likeCount: count };
    }
  }

  // ─── Interactions: Add Comment ───

  async addComment(fanId: string | null, dto: AddCommentDto, isAdmin?: boolean) {
    // Admin comments are acknowledged but not persisted
    if (isAdmin) {
      const parsedText = dto.text.replace(/<[^>]*>?/gm, '').trim();
      return {
        id: 'admin_comment_' + Date.now(),
        text: parsedText || 'Admin Comment',
        createdAt: new Date().toISOString(),
        fan: {
          id: 'admin',
          name: 'Admin',
          profileImage: null,
        }
      };
    }

    if (!fanId) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!dto.postId && !dto.reelId) {
      throw new BadRequestException('Must provide postId or reelId');
    }

    const cleanText = dto.text.replace(/<[^>]*>?/gm, '').trim();
    if (!cleanText) {
      throw new BadRequestException('Comment text cannot be empty');
    }

    let createdComment;
    if (dto.postId) {
      const post = await this.prisma.post.findUnique({
        where: { id: dto.postId },
      });
      if (!post) throw new NotFoundException('Post not found');

      createdComment = await this.prisma.comment.create({
        data: {
          text: cleanText,
          fanId,
          postId: dto.postId,
        },
        include: { fan: true },
      });
    } else {
      const reel = await this.prisma.reel.findUnique({
        where: { id: dto.reelId },
      });
      if (!reel) throw new NotFoundException('Reel not found');

      createdComment = await this.prisma.comment.create({
        data: {
          text: cleanText,
          fanId,
          reelId: dto.reelId!,
        },
        include: { fan: true },
      });
    }

    return {
      id: createdComment.id,
      text: createdComment.text,
      createdAt: createdComment.createdAt.toISOString(),
      fan: {
        id: createdComment.fan.id,
        name: createdComment.fan.name,
        profileImage: createdComment.fan.profileImage,
      },
    };
  }

  // ─── Admin: Get All Fans (company-scoped) ───

  async getAllFans(companyId: string, page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;

    const whereClause: any = {
      companyId,
      ...(search ? {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } }
        ]
      } : {})
    };

    const [total, fans] = await Promise.all([
      this.prisma.fan.count({ where: whereClause }),
      this.prisma.fan.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          profileImage: true,
          createdAt: true,
          _count: {
            select: { likes: true, comments: true },
          },
        },
      }),
    ]);

    const data = fans.map((f) => ({
      id: f.id,
      name: f.name,
      email: f.email,
      profileImage: f.profileImage,
      createdAt: f.createdAt.toISOString(),
      totalLikes: f._count.likes,
      totalComments: f._count.comments,
    }));

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ─── Admin: Generate Frontend Token ───

  async generateFrontendToken(companyId: string) {
    const secret = this.configService.get<string>('FRONTEND_TOKEN_SECRET');
    const payload = { companyId, role: 'admin', type: 'frontend' };
    const token = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn: '15m',
    });
    return { token };
  }

  // ─── Admin: Verify Frontend Token ───

  async verifyAdminToken(token: string) {
    try {
      const secret = this.configService.get<string>('FRONTEND_TOKEN_SECRET');
      const payload = await this.jwtService.verifyAsync(token, { secret });
      
      if (payload.type === 'frontend') {
        return { valid: true, companyId: payload.companyId };
      }
      return { valid: false };
    } catch (e) {
      return { valid: false };
    }
  }

  async forgotPassword(email: string, companyId: string) {
    const fan = await this.prisma.fan.findFirst({
      where: {
        email: email.toLowerCase(),
        companyId: companyId,
      },
    });

    if (!fan) {
      return { message: 'If an account with that email exists, a reset link has been sent.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.fan.update({
      where: { id: fan.id },
      data: { resetToken: token, resetTokenExpires: expires },
    });

    this.logger.log(`[FanForgotPassword] Reset token for ${fan.email} (Company: ${companyId}): ${token}`);

    return {
      message: 'If an account with that email exists, a reset link has been sent.',
      debugToken: process.env.NODE_ENV !== 'production' ? token : undefined
    };
  }

  async resetPassword(dto: { token: string; newPassword: string }) {
    const fan = await this.prisma.fan.findFirst({
      where: {
        resetToken: dto.token,
        resetTokenExpires: { gte: new Date() },
      },
    });

    if (!fan) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.fan.update({
      where: { id: fan.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    return { message: 'Password reset successful' };
  }
}
