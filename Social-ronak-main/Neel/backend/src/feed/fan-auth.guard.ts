import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

interface FanTokenPayload {
  sub: string;
  email: string;
  companyId: string;
  type: 'fan';
}

interface AdminFrontendTokenPayload {
  companyId: string;
  role: 'admin';
  type: 'frontend';
}

@Injectable()
export class FanAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }

    const token = authHeader.split(' ')[1];

    // Try fan token first (FAN_JWT_SECRET)
    try {
      const payload = await this.jwtService.verifyAsync<FanTokenPayload>(token, {
        secret: this.configService.get<string>('FAN_JWT_SECRET'),
      });

      if (payload.type === 'fan') {
        request.fanId = payload.sub;
        request.fanEmail = payload.email;
        request.companyId = payload.companyId;
        request.isAdmin = false;
        return true;
      }
    } catch {
      // Fan token verification failed, try admin frontend token
    }

    // Try admin frontend token (FRONTEND_TOKEN_SECRET)
    try {
      const payload = await this.jwtService.verifyAsync<AdminFrontendTokenPayload>(token, {
        secret: this.configService.get<string>('FRONTEND_TOKEN_SECRET'),
      });

      if (payload.type === 'frontend' && payload.role === 'admin') {
        request.fanId = null;
        request.isAdmin = true;
        request.companyId = payload.companyId;
        return true;
      }
    } catch {
      // Admin token verification also failed
    }

    throw new UnauthorizedException('Invalid or expired token');
  }
}
