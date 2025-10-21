import { Module } from '@nestjs/common';
import { TwiMLController } from './twiml.controller';

@Module({
  controllers: [TwiMLController],
})
export class TwiMLModule {}
