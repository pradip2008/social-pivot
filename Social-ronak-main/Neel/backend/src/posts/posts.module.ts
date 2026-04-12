import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { MetaModule } from '../meta/meta.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [SchedulerModule, MetaModule, PrismaModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
