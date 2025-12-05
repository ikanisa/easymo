/**
 * Cold Caller Controller
 * 
 * HTTP API for triggering outbound calls.
 * POST /cold-caller/call - Initiate an outbound call
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ColdCallerService, OutboundCallRequest, OutboundCallResult } from './cold-caller.service';
import { CampaignConfigService, CampaignConfig } from './campaign-config.service';

// Simple API key guard (replace with your auth guard)
// import { ServiceAuthGuard } from '../../common/guards/service-auth.guard';

@Controller('cold-caller')
export class ColdCallerController {
  constructor(
    private readonly coldCallerService: ColdCallerService,
    private readonly campaignService: CampaignConfigService,
  ) {}

  /**
   * POST /cold-caller/call
   * 
   * Initiate an outbound call to a lead.
   * Similar to microsoft/call-center-ai's POST /call endpoint.
   */
  @Post('call')
  @HttpCode(HttpStatus.ACCEPTED)
  // @UseGuards(ServiceAuthGuard)
  async initiateCall(
    @Body() request: OutboundCallRequest,
  ): Promise<OutboundCallResult> {
    return this.coldCallerService.initiateCall(request);
  }

  /**
   * GET /cold-caller/campaigns
   * 
   * List all available campaigns.
   */
  @Get('campaigns')
  async listCampaigns(): Promise<{ campaigns: CampaignConfig[] }> {
    const campaigns = await this.campaignService.listActiveCampaigns();
    return { campaigns };
  }

  /**
   * GET /cold-caller/campaigns/:id
   * 
   * Get a specific campaign by ID.
   */
  @Get('campaigns/:id')
  async getCampaign(
    @Param('id') campaignId: string,
  ): Promise<CampaignConfig | null> {
    return this.campaignService.getCampaign(campaignId);
  }

  /**
   * POST /cold-caller/campaigns/:id/calls/batch
   * 
   * Initiate calls to multiple leads in a campaign.
   */
  @Post('campaigns/:id/calls/batch')
  @HttpCode(HttpStatus.ACCEPTED)
  async batchCalls(
    @Param('id') campaignId: string,
    @Body() body: { lead_ids?: string[]; limit?: number },
  ): Promise<{ queued: number; call_ids: string[] }> {
    return this.coldCallerService.batchCalls(campaignId, {
      leadIds: body.lead_ids,
      limit: body.limit || 10,
    });
  }

  /**
   * GET /cold-caller/calls/:id/status
   * 
   * Get status of an outbound call.
   */
  @Get('calls/:id/status')
  async getCallStatus(
    @Param('id') callId: string,
  ): Promise<{
    call_id: string;
    status: string;
    disposition?: string;
    claims?: Record<string, string>;
  }> {
    return this.coldCallerService.getCallStatus(callId);
  }

  /**
   * POST /cold-caller/calls/:id/end
   * 
   * End an active call with disposition.
   */
  @Post('calls/:id/end')
  @HttpCode(HttpStatus.OK)
  async endCall(
    @Param('id') callId: string,
    @Body() body: {
      disposition: string;
      notes?: string;
      claims?: Record<string, string>;
    },
  ): Promise<{ success: boolean; call_id: string }> {
    return this.coldCallerService.endCall(callId, body);
  }
}
