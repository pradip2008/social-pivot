import { Controller, Get, UseGuards, Request, Res, Query } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';

@UseGuards(AuthGuard('jwt'))
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) { }

  @Get('overview')
  async getOverview(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.analyticsService.getOverview(req.user.companyId, startDate, endDate);
  }

  @Get('engagement')
  async getEngagement(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.analyticsService.getEngagementHistory(req.user.companyId, startDate, endDate);
  }

  @Get('export')
  async exportCsv(@Request() req: any, @Res() res: Response) {
    const csvData = await this.analyticsService.exportCsv(req.user.companyId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=analytics_export.csv');
    return res.send(csvData);
  }
}
