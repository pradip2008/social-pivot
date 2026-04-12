import {
    Controller,
    Post,
    Body,
    Get,
    Delete,
    Param,
    Query,
    UseGuards,
    Request,
    BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MetaService } from './meta.service';

@Controller()
export class MetaController {
    constructor(private metaService: MetaService) { }

    // ── Get all platform connections ──
    @UseGuards(AuthGuard('jwt'))
    @Get('meta/platforms')
    async getPlatforms(@Request() req: any) {
        return this.metaService.getPlatformConnections(req.user.companyId);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('meta/test/:platform')
    async testPlatformConnection(@Request() req: any, @Param('platform') platform: string) {
        return this.metaService.testExistingConnection(req.user.companyId, platform);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('meta/oauth-url')
    async getOAuthUrl(
        @Request() req: any,
        @Query('platform') platform: string,
        @Query('redirectUri') redirectUri: string,
    ) {
        return { url: this.metaService.getOAuthUrl(platform, redirectUri) };
    }

    @UseGuards(AuthGuard('jwt'))
    @Post('meta/linkedin/exchange-code')
    async exchangeLinkedInCode(
        @Body() body: { code?: string; redirectUri?: string },
    ) {
        if (!body?.code) {
            throw new BadRequestException('code is required');
        }

        return this.metaService.exchangeLinkedInCode(body.code, body.redirectUri || '');
    }

    // ── Connect a platform with Meta API credentials ──
    @UseGuards(AuthGuard('jwt'))
    @Post('meta/platform-connect')
    async connectPlatform(
        @Request() req: any,
        @Body()
        body: {
            platform: string;
            accessToken: string;
            refreshToken?: string;
            tokenType?: string;
            expiresAt?: string;
            pageId?: string;
            igAccountId?: string;
            appId?: string;
            appSecret?: string;
            apiKey?: string;
            apiSecret?: string;
            accessTokenSecret?: string;
            authorUrn?: string;
        },
    ) {
        if (!body.platform || !body.accessToken) {
            throw new BadRequestException('platform and accessToken are required');
        }
        return this.metaService.connectPlatform(req.user.companyId, body.platform, {
            accessToken: body.accessToken,
            refreshToken: body.refreshToken,
            tokenType: body.tokenType,
            expiresAt: body.expiresAt,
            pageId: body.pageId,
            igAccountId: body.igAccountId,
            appId: body.appId,
            appSecret: body.appSecret,
            apiKey: body.apiKey,
            apiSecret: body.apiSecret,
            accessTokenSecret: body.accessTokenSecret,
            authorUrn: body.authorUrn,
        });
    }

    // ── Disconnect a platform ──
    @UseGuards(AuthGuard('jwt'))
    @Delete('meta/platform/:platform')
    async disconnectPlatform(
        @Request() req: any,
        @Param('platform') platform: string,
    ) {
        return this.metaService.disconnectPlatform(req.user.companyId, platform);
    }

    // ── Fetch available Meta Pages ──
    @UseGuards(AuthGuard('jwt'))
    @Post('meta/fetch-pages')
    async fetchPages(@Body('accessToken') accessToken: string) {
        if (!accessToken) throw new BadRequestException('accessToken is required');
        return this.metaService.fetchMetaPages(accessToken);
    }

    // ── Fetch available Instagram Business Accounts ──
    @UseGuards(AuthGuard('jwt'))
    @Post('meta/fetch-ig-accounts')
    async fetchIgAccounts(@Body('accessToken') accessToken: string) {
        if (!accessToken) throw new BadRequestException('accessToken is required');
        return this.metaService.fetchInstagramAccounts(accessToken);
    }

    // ── Test a connection ──
    @UseGuards(AuthGuard('jwt'))
    @Post('meta/test-connection')
    async testConnection(
        @Request() req: any,
        @Body()
        body: {
            platform: string;
            accessToken: string;
            pageId?: string;
            config?: any;
        },
    ) {
        if (!body.platform || !body.accessToken) {
            throw new BadRequestException('platform and accessToken are required');
        }
        return this.metaService.testConnection(
            req.user.companyId,
            body.platform,
            body.accessToken,
            body.pageId,
            body.config,
        );
    }

    @UseGuards(AuthGuard('jwt'))
    @Post('meta/test-and-save')
    async testAndSave(
        @Request() req: any,
        @Body()
        body: {
            platform: string;
            accessToken: string;
            pageId?: string;
            igAccountId?: string;
            appId?: string;
            appSecret?: string;
        },
    ) {
        if (!body.platform || !body.accessToken) {
            throw new BadRequestException('platform and accessToken are required');
        }
        return this.metaService.testAndSaveConnection(
            req.user.companyId,
            body.platform,
            body.accessToken,
            body.pageId,
            body.igAccountId,
            body.appId,
            body.appSecret,
        );
    }
}
