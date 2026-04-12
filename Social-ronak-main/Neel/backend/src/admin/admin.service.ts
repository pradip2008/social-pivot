import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) { }

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        companyId: true,
        company: true,
        // password intentionally excluded
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUserRole(id: string, role: string) {
    return this.prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  async getAllCompanies() {
    const companies = await this.prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Add member counts manually since SQLite doesn't support _count in findMany inclusions easily in some Prisma versions
    const enrichedCompanies = await Promise.all(companies.map(async (company) => {
      const userCount = await this.prisma.user.count({ where: { companyId: company.id } });
      return { ...company, _count: { users: userCount } };
    }));

    return enrichedCompanies;
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Due to lack of CASCADE in some SQLite/Prisma setups, we need manual cleanup
    // We run everything in a transaction to ensure atomic deletion
    return this.prisma.$transaction([
      this.prisma.draftPost.deleteMany({ where: { userId: id } }),
      this.prisma.scheduledPost.deleteMany({ where: { userId: id } }),
      this.prisma.aiGenerationLog.deleteMany({ where: { userId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
  }

  async getUserProfileUrl(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true }
    });
    if (!user || !user.company?.slug) throw new NotFoundException('Profile not found');
    return { profileUrl: `/feed/${user.company.slug}` };
  }
}
