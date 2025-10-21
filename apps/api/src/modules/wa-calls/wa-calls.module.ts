import { Module } from '@nestjs/common';
import { WaCallsController } from './calls.controller';
import { WaCallsService } from './calls.service';
import { WaGraphService } from './wa-graph.service';
import { IceStoreService } from './ice-store.service';
import { CallRegistryService } from './call-registry.service';
import { ToolRouterService } from './tools/tool-router.service';
import { WaWebhookGuard } from './common/guards/wa-webhook.guard';

@Module({
  controllers: [WaCallsController],
  providers: [WaCallsService, WaGraphService, IceStoreService, CallRegistryService, ToolRouterService, WaWebhookGuard],
  exports: [WaCallsService],
})
export class WaCallsModule {}
