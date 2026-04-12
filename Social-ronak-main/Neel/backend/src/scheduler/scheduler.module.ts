import { Module } from '@nestjs/common';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { ScheduledPostProcessor } from './scheduler.processor';
import { MetaModule } from '../meta/meta.module';

@Module({
  imports: [MetaModule],
  controllers: [SchedulerController],
  providers: [SchedulerService, ScheduledPostProcessor],
  exports: [SchedulerService],
})
export class SchedulerModule { }
