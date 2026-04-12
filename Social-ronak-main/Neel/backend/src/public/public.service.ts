import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(private prisma: PrismaService) {}

  async getCompanyFeed(slug: string) {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, logoUrl: true, bio: true, themeJson: true },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const posts = await this.prisma.post.findMany({
      where: { companyId: company.id, isDeleted: false, isPublished: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      company,
      posts,
    };
  }
}
