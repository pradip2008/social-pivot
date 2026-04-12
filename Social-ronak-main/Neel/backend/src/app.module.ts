import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { AiModule } from './ai/ai.module';
import { PostsModule } from './posts/posts.module';
import { MetaModule } from './meta/meta.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PrismaModule } from './prisma/prisma.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AdminModule } from './admin/admin.module';
import { PublicModule } from './public/public.module';
import { SyncModule } from './sync/sync.module';
import { FeedModule } from './feed/feed.module';
import { HashtagsModule } from './hashtags/hashtags.module';
import { MediaModule } from './media/media.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    // Serve /uploads directory as static files at /uploads path
    // This makes media accessible at BASE_URL/uploads/{filename}
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    AuthModule,
    AiModule,
    PostsModule,
    MetaModule,
    AnalyticsModule,
    SchedulerModule,
    AdminModule,
    PublicModule,
    SyncModule,
    FeedModule,
    HashtagsModule,
    MediaModule,
  ],
  providers: [
    // Apply rate limiting globally — 30 requests per 60 seconds per IP
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }
