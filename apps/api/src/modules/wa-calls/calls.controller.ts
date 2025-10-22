import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { getApiControllerBasePath, getApiEndpointSegment } from '@easymo/commons';
import { WaCallsService } from './calls.service';
import { WaWebhookGuard } from './common/guards/wa-webhook.guard';
import { parseWaCallEvent } from './common/dto/wa-calling.dto';

@Controller(getApiControllerBasePath('waCalls'))
export class WaCallsController {
  constructor(private readonly calls: WaCallsService) {}

  @Get(getApiEndpointSegment('waCalls', 'webhookVerify'))
  verify(@Query() query: Record<string, unknown>) {
    return this.calls.verifyWebhook(query);
  }

  @UseGuards(WaWebhookGuard)
  @Post(getApiEndpointSegment('waCalls', 'events'))
  async events(@Body() body: unknown) {
    const event = parseWaCallEvent(body);
    await this.calls.onEvents(event);
    return { ok: true };
  }
}
