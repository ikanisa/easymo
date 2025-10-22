import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { getApiControllerBasePath, getApiEndpointSegment } from '@easymo/commons';
import { WaCallsService } from './calls.service';
import { WaWebhookGuard } from './common/guards/wa-webhook.guard';
import type { WaCallEvent } from './common/dto/wa-calling.dto';

@Controller(getApiControllerBasePath('whatsappCalls'))
export class WaCallsController {
  constructor(private readonly calls: WaCallsService) {}

  @Get(getApiEndpointSegment('whatsappCalls', 'webhook'))
  verify(@Query() query: Record<string, unknown>) {
    return this.calls.verifyWebhook(query);
  }

  @UseGuards(WaWebhookGuard)
  @Post(getApiEndpointSegment('whatsappCalls', 'events'))
  async events(@Body() body: WaCallEvent) {
    await this.calls.onEvents(body);
    return { ok: true };
  }
}
