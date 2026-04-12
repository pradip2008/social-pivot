import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class OptionalFanAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      request.fanId = undefined;
      return true;
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('FAN_JWT_SECRET'),
      });

      if (payload.type === 'fan') {
        request.fanId = payload.sub;
        request.fanEmail = payload.email;
      } else {
        request.fanId = undefined;
      }
    } catch {
      request.fanId = undefined;
    }

    return true;
  }
}
