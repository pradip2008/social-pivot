import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FeedService } from './feed.service';
import { FanSignupDto, FanLoginDto, FanForgotPasswordDto, FanResetPasswordDto } from './dto/fan-auth.dto';
import { AddCommentDto } from './dto/comment.dto';
import { FanAuthGuard } from './fan-auth.guard';
import { OptionalFanAuthGuard } from './optional-fan-auth.guard';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';

interface AuthenticatedRequest {
  user: { sub: string; email: string; companyId: string; role: string };
}

interface FanAuthRequest {
  fanId: string | null;
  isAdmin: boolean;
  companyId: string;
}

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  // ─── Public: Company Profile by ID ───

  @Get(':companyId/profile')
  getCompanyProfile(@Param('companyId') companyId: string) {
    return this.feedService.getCompanyProfile(companyId);
  }

  // ─── Public: Company Feed by Slug ───

  @Get('slug/:slug')
  async getCompanyBySlug(@Param('slug') slug: string, @Request() req: any) {
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
       const token = authHeader.substring(7);
       const verifyRes = await this.feedService.verifyAdminToken(token);
       if (verifyRes.valid) {
          isAdmin = true;
       }
    }
    return this.feedService.getCompanyBySlug(slug, isAdmin);
  }

  // ─── Public: Feed Posts (paginated) ───

  @Get(':companyId/posts')
  getFeedPosts(
    @Param('companyId') companyId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
  ) {
    return this.feedService.getFeedPosts(companyId, page, limit);
  }

  // ─── Public: Reels (paginated) ───

  @Get(':companyId/reels')
  getReels(
    @Param('companyId') companyId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
  ) {
    return this.feedService.getReels(companyId, page, limit);
  }

  // ─── Public: Post Detail ───

  @UseGuards(OptionalFanAuthGuard)
  @Get('post/:postId')
  getPostDetail(@Param('postId') postId: string, @Request() req: { fanId?: string }) {
    return this.feedService.getPostDetail(postId, req.fanId);
  }

  // ─── Public: Reel Detail ───

  @UseGuards(OptionalFanAuthGuard)
  @Get('reel/:reelId')
  getReelDetail(@Param('reelId') reelId: string, @Request() req: { fanId?: string }) {
    return this.feedService.getReelDetail(reelId, req.fanId);
  }

  // ─── Fan Auth: Signup ───

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('fan/signup')
  fanSignup(@Body() dto: FanSignupDto) {
    return this.feedService.fanSignup(dto);
  }

  // ─── Fan Auth: Login ───

  @Post('auth/login')
  async login(@Body() dto: FanLoginDto) {
    return this.feedService.fanLogin(dto);
  }

  @Post('auth/forgot-password')
  async forgotPassword(@Body() dto: FanForgotPasswordDto) {
    return this.feedService.forgotPassword(dto.email, dto.companyId);
  }

  @Post('auth/reset-password')
  async resetPassword(@Body() dto: FanResetPasswordDto) {
    return this.feedService.resetPassword(dto);
  }

  // ─── Interactions: Like Post ───

  @UseGuards(FanAuthGuard)
  @Post('post/:postId/like')
  togglePostLike(@Param('postId') postId: string, @Request() req: FanAuthRequest) {
    return this.feedService.toggleLike(req.fanId, postId, undefined, req.isAdmin);
  }

  // ─── Interactions: Like Reel ───

  @UseGuards(FanAuthGuard)
  @Post('reel/:reelId/like')
  toggleReelLike(@Param('reelId') reelId: string, @Request() req: FanAuthRequest) {
    return this.feedService.toggleLike(req.fanId, undefined, reelId, req.isAdmin);
  }

  // ─── Interactions: Comment on Post ───

  @UseGuards(FanAuthGuard)
  @Post('post/:postId/comment')
  addPostComment(
    @Param('postId') postId: string,
    @Body() dto: AddCommentDto,
    @Request() req: FanAuthRequest,
  ) {
    dto.postId = postId;
    return this.feedService.addComment(req.fanId, dto, req.isAdmin);
  }

  // ─── Interactions: Comment on Reel ───

  @UseGuards(FanAuthGuard)
  @Post('reel/:reelId/comment')
  addReelComment(
    @Param('reelId') reelId: string,
    @Body() dto: AddCommentDto,
    @Request() req: FanAuthRequest,
  ) {
    dto.reelId = reelId;
    return this.feedService.addComment(req.fanId, dto, req.isAdmin);
  }

  // ─── Admin: Verify Frontend Token ───

  @Get('admin/verify-token')
  async verifyAdminToken(@Query('token') token: string) {
    if (!token) return { valid: false };
    return this.feedService.verifyAdminToken(token);
  }

  // ─── Admin: Get Frontend Token ───

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/frontend-token')
  getFrontendToken(@Request() req: AuthenticatedRequest) {
    return this.feedService.generateFrontendToken(req.user.companyId);
  }

  // ─── Admin: Get Fans (company-scoped) ───

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/fans')
  getAllFans(
    @Request() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.feedService.getAllFans(req.user.companyId, page, limit, search);
  }
}
