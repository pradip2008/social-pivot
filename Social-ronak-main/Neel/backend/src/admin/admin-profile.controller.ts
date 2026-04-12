import { Controller, Get, Param, UseGuards, UnauthorizedException, NotFoundException, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

const generateSlug = (name: string) =>
  name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

@UseGuards(AuthGuard('jwt'))
@Controller('admin')
export class AdminProfileController {
  constructor(private readonly prisma: PrismaService) {}

  private checkAdminRole(req: any) {
    const superAdmins = ['ronak@swingitservices.com', 'neel@gmail.com'];
    if (req.user.role !== 'admin' || !superAdmins.includes(req.user.email)) {
      throw new UnauthorizedException('Super Admin access required');
    }
  }

  @Get('users/:userId/profile-url')
  async getProfileUrl(@Request() req: any, @Param('userId') userId: string) {
    this.checkAdminRole(req);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.company) {
      throw new NotFoundException('User does not belong to a company');
    }

    let slug = user.company.slug;

    if (!slug) {
      slug = generateSlug(user.company.name);
      // Ensure absolute unique slug
      let isUnique = false;
      let counter = 0;
      let finalSlug = slug;
      while (!isUnique) {
        const existing = await this.prisma.company.findUnique({ where: { slug: finalSlug } });
        if (existing && existing.id !== user.company.id) {
          counter++;
          finalSlug = `${slug}-${counter}`;
        } else {
          isUnique = true;
        }
      }

      await this.prisma.company.update({
        where: { id: user.company.id },
        data: { slug: finalSlug },
      });
      slug = finalSlug;
    }

    return { profileUrl: `/feed/${slug}` };
  }

  @Get('users/:userId/profile')
  async getUserProfile(@Request() req: any, @Param('userId') userId: string) {
    this.checkAdminRole(req);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Stats
    const totalPosts = await this.prisma.post.count({
      where: { companyId: user.companyId, isDeleted: false },
    });

    const scheduledPosts = await this.prisma.scheduledPost.count({
      where: { companyId: user.companyId, status: 'Scheduled' },
    });

    const failedPosts = await this.prisma.scheduledPost.count({
      where: { companyId: user.companyId, status: 'Failed' },
    });

    // Recent 9 posts — use _count include to avoid N+1 queries
    const recentPosts = await this.prisma.post.findMany({
      where: { companyId: user.companyId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 9,
      select: {
        id: true,
        content: true,
        mediaUrl: true,
        platform: true,
        source: true,
        publishedAt: true,
        createdAt: true,
        engagementCount: true,
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    const enrichedPosts = recentPosts.map((post) => ({
      ...post,
      status: post.publishedAt ? 'Published' : 'Scheduled',
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      _count: undefined,
    }));

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        company: user.company,
      },
      stats: {
        totalPosts,
        scheduledPosts,
        failedPosts,
      },
      recentPosts: enrichedPosts,
    };
  }
}
