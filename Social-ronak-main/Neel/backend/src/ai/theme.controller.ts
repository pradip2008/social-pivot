import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ThemeService } from './theme.service';

@Controller('ai/theme')
export class ThemeController {
  constructor(private readonly themeService: ThemeService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('generate')
  async generateTheme(@Request() req: any, @Body() body: { logoUrl: string }) {
    return this.themeService.generateThemeFromLogo(req.user.companyId, body.logoUrl);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('apply')
  async applyTheme(@Request() req: any, @Body() body: { theme: any }) {
    return this.themeService.applyTheme(req.user.companyId, body.theme);
  }
}
