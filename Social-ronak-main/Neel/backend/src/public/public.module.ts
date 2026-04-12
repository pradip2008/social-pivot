import { Module } from '@nestjs/common';
import { PublicService } from './public.service';
import { PublicController } from './public.controller';
import { PublicInteractionsController } from './public-interactions.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PublicController, PublicInteractionsController],
  providers: [PublicService],
})
export class PublicModule {}
