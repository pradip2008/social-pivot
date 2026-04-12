import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ThemeController } from './theme.controller';
import { ThemeService } from './theme.service';

@Module({
  controllers: [AiController, ThemeController],
  providers: [AiService, ThemeService],
  exports: [AiService, ThemeService],
})
export class AiModule {}
