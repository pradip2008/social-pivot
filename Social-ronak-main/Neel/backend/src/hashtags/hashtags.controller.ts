import {
    Controller,
    Get,
    Post,
    Delete,
    Query,
    Body,
    Param,
    Req,
    UseGuards,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HashtagsService } from './hashtags.service';

@Controller('hashtags')
@UseGuards(AuthGuard('jwt'))
export class HashtagsController {
    constructor(private hashtagsService: HashtagsService) {}

    // ── GET /hashtags/search?q=tech ──
    @Get('search')
    async search(@Query('q') query: string, @Req() req: any) {
        try {
            if (!query || query.trim().length === 0) {
                return { hashtag: '', count: 'Enter a hashtag', raw: 0 };
            }
            const companyId = req.user.companyId;
            return await this.hashtagsService.search(companyId, query.trim());
        } catch (error: any) {
            return {
                hashtag: query || '',
                count: 'Search failed',
                raw: 0,
            };
        }
    }

    // ── GET /hashtags/top ──
    @Get('top')
    async getTopHashtags(@Req() req: any) {
        try {
            const companyId = req.user.companyId;
            return await this.hashtagsService.getTopHashtags(companyId);
        } catch (error: any) {
            return [];
        }
    }

    // ── GET /hashtags/groups ──
    @Get('groups')
    async getGroups(@Req() req: any) {
        try {
            const companyId = req.user.companyId;
            return await this.hashtagsService.getGroups(companyId);
        } catch (error: any) {
            return [];
        }
    }

    // ── POST /hashtags/groups ──
    @Post('groups')
    async createGroup(
        @Body() body: { name: string; hashtags: string },
        @Req() req: any,
    ) {
        try {
            const companyId = req.user.companyId;
            if (!body.name || !body.hashtags) {
                throw new HttpException(
                    'Name and hashtags are required',
                    HttpStatus.BAD_REQUEST,
                );
            }
            return await this.hashtagsService.createGroup(
                companyId,
                body.name,
                body.hashtags,
            );
        } catch (error: any) {
            if (error instanceof HttpException) throw error;
            throw new HttpException(
                'Failed to create group',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // ── DELETE /hashtags/groups/:id ──
    @Delete('groups/:id')
    async deleteGroup(@Param('id') id: string, @Req() req: any) {
        try {
            const companyId = req.user.companyId;
            return await this.hashtagsService.deleteGroup(companyId, id);
        } catch (error: any) {
            return { success: false, message: 'Delete failed' };
        }
    }
}
