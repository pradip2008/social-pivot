import { Controller, Get, Put, Body, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SchedulerService } from './scheduler.service';

@UseGuards(AuthGuard('jwt'))
@Controller('scheduler')
export class SchedulerController {
  constructor(private schedulerService: SchedulerService) { }

  @Get('jobs')
  async getScheduledJobs(@Request() req: any) {
    return this.schedulerService.getScheduledPosts(req.user.companyId);
  }

  @Put('jobs/:id')
  async updateScheduledJob(
    @Request() req: any, 
    @Param('id') id: string,
    @Body() body: { content?: string; scheduledAt?: string; platform?: string }
  ) {
    return this.schedulerService.updateScheduledPost(req.user.companyId, id, body);
  }

  @Delete('jobs/:id')
  async deleteScheduledJob(@Request() req: any, @Param('id') id: string) {
    return this.schedulerService.deleteScheduledPost(req.user.companyId, id);
  }
}
