import { Module } from '@nestjs/common';
import { DeeplinkController } from './deeplink.controller';
import { DeeplinkService } from './deeplink.service';

@Module({
  controllers: [DeeplinkController],
  providers: [DeeplinkService],
  exports: [DeeplinkService],
})
export class DeeplinkModule {}
