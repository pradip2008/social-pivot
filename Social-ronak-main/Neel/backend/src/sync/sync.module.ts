import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { PostFetchWorker } from './post-fetch-worker.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MetaModule } from '../meta/meta.module';

@Module({
  imports: [PrismaModule, MetaModule],
  controllers: [SyncController],
  providers: [SyncService, PostFetchWorker],
  exports: [SyncService, PostFetchWorker],
})
export class SyncModule {}
