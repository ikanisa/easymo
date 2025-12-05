/**
 * Cold Caller Module
 * 
 * NestJS module for outbound call campaigns.
 * Based on microsoft/call-center-ai patterns.
 */

import { Module } from '@nestjs/common';
import { ColdCallerController } from './cold-caller.controller';
import { ColdCallerService } from './cold-caller.service';
import { CampaignConfigService } from './campaign-config.service';

@Module({
  controllers: [ColdCallerController],
  providers: [ColdCallerService, CampaignConfigService],
  exports: [ColdCallerService, CampaignConfigService],
})
export class ColdCallerModule {}
