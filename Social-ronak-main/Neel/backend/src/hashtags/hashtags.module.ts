import { Module } from '@nestjs/common';
import { HashtagsController } from './hashtags.controller';
import { HashtagsService } from './hashtags.service';
import { MetaModule } from '../meta/meta.module';

@Module({
    imports: [MetaModule],
    controllers: [HashtagsController],
    providers: [HashtagsService],
})
export class HashtagsModule {}
