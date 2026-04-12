import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  UnauthorizedException,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { AuthService } from '../auth/auth.service';
import { RegisterDto } from '../auth/auth.dto';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('admin')
export class AdminController {
  private readonly superAdminEmails: string[];

  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    // Read super admin emails from environment variable (comma-separated)
    const raw = this.configService.get<string>('SUPER_ADMIN_EMAILS') || '';
    this.superAdminEmails = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  }

  private checkAdminRole(req: any) {
    if (
      req.user.role !== 'admin' ||
      this.superAdminEmails.length === 0 ||
      !this.superAdminEmails.includes(req.user.email?.toLowerCase())
    ) {
      throw new UnauthorizedException('Super Admin access required');
    }
  }

  @Post('users')
  async createUser(@Request() req: any, @Body() dto: RegisterDto) {
    this.checkAdminRole(req);
    // We reuse the register logic to create a company + user account
    // It returns token and user info, we just want to create it.
    const result = await this.authService.register(dto);
    // By default it makes them "admin" of their own company space.
    return result.user;
  }

  @Get('users')
  getAllUsers(@Request() req: any) {
    this.checkAdminRole(req);
    return this.adminService.getAllUsers();
  }

  @Put('users/:id/role')
  updateUserRole(
    @Request() req: any,
    @Param('id') id: string,
    @Body('role') role: string,
  ) {
    this.checkAdminRole(req);
    return this.adminService.updateUserRole(id, role);
  }

  @Post('users/:id/delete')
  async deleteUser(@Request() req: any, @Param('id') id: string) {
    this.checkAdminRole(req);
    return this.adminService.deleteUser(id);
  }

  @Get('companies')
  getAllCompanies(@Request() req: any) {
    this.checkAdminRole(req);
    return this.adminService.getAllCompanies();
  }
}
