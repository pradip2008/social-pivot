import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) { }

  async getOverview(companyId: string, startDate?: string, endDate?: string) {
    const dateRange = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };

    const where = { companyId, isDeleted: false, isPublished: true, ...(Object.keys(dateRange).length > 0 && { publishedAt: dateRange }) };

    const totalPosts = await this.prisma.post.count({ where });
    const scheduledPosts = await this.prisma.scheduledPost.count({
      where: { companyId, status: 'Scheduled' },
    });

    const engagement = await this.prisma.post.aggregate({
      where,
      _sum: { engagementCount: true },
    });
    const avgEngagement = await this.prisma.post.aggregate({
      where,
      _avg: { engagementCount: true },
    });

    const byPlatform = await this.prisma.post.groupBy({
      by: ['platform'],
      where,
      _count: true,
      _sum: { engagementCount: true },
    });

    // Get top 5 performing posts within range
    const topPosts = await this.prisma.post.findMany({
      where,
      orderBy: { engagementCount: 'desc' },
      take: 5,
      select: {
        id: true,
        content: true,
        platform: true,
        engagementCount: true,
        publishedAt: true,
      },
    });

    return {
      totalPosts,
      scheduledPosts,
      engagementRate: avgEngagement._avg?.engagementCount || 0,
      totalEngagement: engagement._sum?.engagementCount || 0,
      platformBreakdown: byPlatform.map((p) => ({
        platform: p.platform,
        count: p._count,
        engagement: p._sum?.engagementCount || 0,
      })),
      topPosts,
    };
  }

  async getEngagementHistory(companyId: string, startDate?: string, endDate?: string) {
    let since = new Date();
    since.setDate(since.getDate() - 30); // Default to last 30 days
    
    const dateRange = {
      gte: startDate ? new Date(startDate) : since,
      ...(endDate && { lte: new Date(endDate) }),
    };

    const posts = await this.prisma.post.findMany({
      where: {
        companyId,
        publishedAt: dateRange,
        isDeleted: false,
        isPublished: true,
      },
      select: {
        publishedAt: true,
        engagementCount: true,
      },
      orderBy: { publishedAt: 'asc' },
    });

    // Aggregate by date string for the frontend chart
    const grouped: Record<string, number> = {};
    for (const post of posts) {
      const dateKey = post.publishedAt
        ? post.publishedAt.toISOString().split('T')[0]
        : new Date(post.publishedAt ?? Date.now()).toISOString().split('T')[0];
      grouped[dateKey] = (grouped[dateKey] || 0) + post.engagementCount;
    }

    return Object.entries(grouped).map(([date, engagement]) => ({
      date,
      engagement,
    }));
  }

  async exportCsv(companyId: string) {
    const posts = await this.prisma.post.findMany({
      where: { companyId, isDeleted: false, isPublished: true },
      orderBy: { createdAt: 'desc' },
      select: {
        platform: true,
        engagementCount: true,
        publishedAt: true,
        content: true,
        externalPostId: true,
      }
    });

    const headers = ['Platform', 'Engagement', 'Published At', 'Content', 'External Post ID'].join(',');
    const rows = posts.map(post => {
      const escapedContent = `"${(post.content || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
      const date = post.publishedAt ? post.publishedAt.toISOString() : '';
      return `${post.platform},${post.engagementCount},${date},${escapedContent},${post.externalPostId || ''}`;
    });

    return [headers, ...rows].join('\n');
  }
}
