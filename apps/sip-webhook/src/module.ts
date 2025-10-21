import { Module } from '@nestjs/common';
import { VoiceController } from './voice.controller';
import { DialController } from './dial.controller';

@Module({
  controllers: [VoiceController, DialController]
})
export class AppModule {}
