import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) { }

  async register(dto: {
    email: string;
    password: string;
    name: string;
    companyName: string;
  }) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    let baseSlug = dto.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    if (!baseSlug) baseSlug = 'company';

    let slug = baseSlug;
    let counter = 1;
    while (await this.prisma.company.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const company = await this.prisma.company.create({
      data: {
        name: dto.companyName,
        slug: slug,
        plan: 'free',
      },
    });

    const user = await this.prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
        name: dto.name,
        role: 'admin',
        companyId: company.id,
      },
    });


    const token = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        companyId: company.id,
        role: user.role,
      },
      { expiresIn: '7d' },
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company: {
          id: company.id,
          name: company.name,
          plan: company.plan,
        },
      },
    };
  }

  async login(dto: { email: string; password: string }) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        companyId: user.companyId,
        role: user.role,
      },
      { expiresIn: '7d' },
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company: {
          id: user.company.id,
          name: user.company.name,
          plan: user.company.plan,
        },
      },
    };
  }

  async googleSignIn(dto: { email: string; name: string }) {
    const email = dto.email.toLowerCase();
    
    // Only allow sign-in for existing users — no auto-registration
    // This prevents arbitrary account creation without real Google OAuth verification
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

    if (!user) {
      throw new UnauthorizedException('No account found with this email. Please contact your administrator.');
    }

    const token = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        companyId: user.companyId,
        role: user.role,
      },
      { expiresIn: '7d' },
    );

    return {
      token,
      userId: user.id,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company: {
          id: user.company.id,
          name: user.company.name,
        },
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user) throw new UnauthorizedException();

    // Mask sensitive keys — only expose last 4 characters
    const maskedOpenaiKey = user.company.openaiApiKey
      ? `sk-...${user.company.openaiApiKey.slice(-4)}`
      : null;

    const superAdmins = (this.configService.get<string>('SUPER_ADMIN_EMAILS') || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const isSuperAdmin = user.role === 'admin' && superAdmins.includes(user.email.toLowerCase());

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isSuperAdmin,
      company: {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug,
        plan: user.company.plan,
        logoUrl: user.company.logoUrl,
        bio: user.company.bio,
        themeJson: user.company.themeJson,
        openaiApiKey: maskedOpenaiKey,
        hasOpenaiKey: !!user.company.openaiApiKey,
      },
    };
  }

  async updateCompanyProfile(
    companyId: string,
    data: { name?: string; logoUrl?: string; bio?: string; openaiApiKey?: string },
  ) {
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.openaiApiKey !== undefined && { openaiApiKey: data.openaiApiKey }),
      },
    });
    return company;
  }

  async changePassword(userId: string, data: any) {
    const { currentPassword, newPassword } = data;

    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Both currentPassword and newPassword are required');
    }

    if (newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Incorrect current password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password updated successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return { message: 'If an account with that email exists, a reset link has been sent.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpires: expires },
    });

    this.logger.log(`[ForgotPassword] Reset token for ${user.email}: ${token}`);

    return { 
      message: 'If an account with that email exists, a reset link has been sent.',
      debugToken: process.env.NODE_ENV !== 'production' ? token : undefined 
    };
  }

  async resetPassword(dto: { token: string; newPassword: string }) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: dto.token,
        resetTokenExpires: { gte: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    return { message: 'Password reset successful' };
  }
}
