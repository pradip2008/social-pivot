import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, GoogleSignInDto, UpdateCompanyDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  async googleSignIn(@Body() dto: GoogleSignInDto) {
    return this.authService.googleSignIn(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('company')
  async updateCompany(
    @Request() req: any,
    @Body() data: UpdateCompanyDto,
  ) {
    return this.authService.updateCompanyProfile(req.user.companyId, data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('password')
  async changePassword(@Request() req: any, @Body() data: ChangePasswordDto) {
    return this.authService.changePassword(req.user.sub, data);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
