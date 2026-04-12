import { Controller, Post, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SyncService } from './sync.service';

@UseGuards(AuthGuard('jwt'))
@Controller('sync')
export class SyncController {
  constructor(private syncService: SyncService) {}

  /**
   * POST /sync/manual-external
   * Triggers an immediate sync of external posts for the admin's company.
   */
  @Post('manual-external')
  async manualSync(@Request() req: any) {
    return this.syncService.manualSyncForCompany(req.user.companyId);
  }

  /**
   * GET /sync/last-log
   * Returns the most recent sync log for dashboard display.
   */
  @Get('last-log')
  async getLastSyncLog(@Request() req: any) {
    return this.syncService.getLatestSyncLog(req.user.companyId);
  }
}
