/**
 * Cold Caller Service
 * 
 * Core service for managing outbound calls.
 * Handles call initiation, claim capture, and disposition tracking.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CampaignConfigService, CampaignConfig } from './campaign-config.service';

export interface OutboundCallRequest {
  /** Campaign ID to use */
  campaign_id: string;
  /** Lead ID (will fetch phone from sales_leads) */
  lead_id?: string;
  /** Direct phone number (if no lead_id) */
  phone_number?: string;
  /** Language override */
  language?: string;
  /** Voice style override */
  voice_style?: string;
  /** Additional context for the agent */
  context?: Record<string, unknown>;
}

export interface OutboundCallResult {
  call_id: string;
  status: 'queued' | 'initiated' | 'failed';
  lead_id?: string;
  campaign_id: string;
  message?: string;
  error?: string;
}

export interface EndCallRequest {
  disposition: string;
  notes?: string;
  claims?: Record<string, string>;
}

@Injectable()
export class ColdCallerService {
  private readonly logger = new Logger(ColdCallerService.name);
  private readonly supabase: SupabaseClient;
  private readonly voiceBridgeUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly campaignService: CampaignConfigService,
  ) {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const supabaseKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    this.supabase = createClient(supabaseUrl || '', supabaseKey || '', {
      auth: { persistSession: false },
    });

    this.voiceBridgeUrl =
      this.config.get<string>('VOICE_BRIDGE_URL') || 'http://localhost:3020';
  }

  /**
   * Initiate an outbound call
   */
  async initiateCall(request: OutboundCallRequest): Promise<OutboundCallResult> {
    const { campaign_id, lead_id, phone_number, language, voice_style, context } = request;

    // 1. Get campaign config
    const campaign = await this.campaignService.getCampaign(campaign_id);
    if (!campaign) {
      return {
        call_id: '',
        status: 'failed',
        campaign_id,
        error: 'Campaign not found',
      };
    }

    // 2. Check campaign status
    if (campaign.status !== 'active') {
      return {
        call_id: '',
        status: 'failed',
        campaign_id,
        error: `Campaign is ${campaign.status}, not active`,
      };
    }

    // 3. Get phone number
    let targetPhone = phone_number;
    let resolvedLeadId = lead_id;

    if (lead_id && !phone_number) {
      const { data: lead, error } = await this.supabase
        .from('sales_leads')
        .select('id, phone_number, opted_out')
        .eq('id', lead_id)
        .single();

      if (error || !lead) {
        return {
          call_id: '',
          status: 'failed',
          campaign_id,
          lead_id,
          error: 'Lead not found',
        };
      }

      if (lead.opted_out) {
        return {
          call_id: '',
          status: 'failed',
          campaign_id,
          lead_id,
          error: 'Lead has opted out of calls',
        };
      }

      targetPhone = lead.phone_number;
      resolvedLeadId = lead.id;
    }

    if (!targetPhone) {
      return {
        call_id: '',
        status: 'failed',
        campaign_id,
        error: 'No phone number provided',
      };
    }

    // 4. Check call window
    if (!this.isWithinCallWindow(campaign)) {
      return {
        call_id: '',
        status: 'failed',
        campaign_id,
        error: 'Outside call window hours',
      };
    }

    // 5. Check cooldown (if lead)
    if (resolvedLeadId) {
      const cooldownOk = await this.checkCooldown(resolvedLeadId, campaign.cooldown_minutes);
      if (!cooldownOk) {
        return {
          call_id: '',
          status: 'failed',
          campaign_id,
          lead_id: resolvedLeadId,
          error: `Lead was called recently (cooldown: ${campaign.cooldown_minutes} mins)`,
        };
      }
    }

    // 6. Create call record
    const { data: call, error: callError } = await this.supabase
      .from('calls')
      .insert({
        agent_id: 'sales_ai',
        channel: 'phone',
        direction: 'outbound',
        status: 'initiated',
        to_number: targetPhone,
        metadata: {
          campaign_id,
          lead_id: resolvedLeadId,
          claim_schema: campaign.claim_schema,
          script_goal: campaign.script_goal,
          ...context,
        },
      })
      .select('id')
      .single();

    if (callError || !call) {
      this.logger.error('Failed to create call record', callError);
      return {
        call_id: '',
        status: 'failed',
        campaign_id,
        error: 'Failed to create call record',
      };
    }

    // 7. Create interaction record
    await this.supabase.from('sales_call_interactions').insert({
      call_id: call.id,
      lead_id: resolvedLeadId,
      campaign_id,
      disposition: null, // Will be set when call ends
      attempt_number: await this.getAttemptNumber(resolvedLeadId, campaign_id),
    });

    // 8. Trigger outbound call via voice bridge
    try {
      await this.triggerVoiceBridgeCall({
        callId: call.id,
        toNumber: targetPhone,
        campaign,
        language: language || campaign.language,
        voiceStyle: voice_style || campaign.voice_style,
      });
    } catch (error) {
      this.logger.error('Failed to trigger voice bridge', error);
      // Update call status
      await this.supabase
        .from('calls')
        .update({ status: 'failed' })
        .eq('id', call.id);

      return {
        call_id: call.id,
        status: 'failed',
        campaign_id,
        lead_id: resolvedLeadId,
        error: 'Failed to initiate call via voice bridge',
      };
    }

    return {
      call_id: call.id,
      status: 'initiated',
      campaign_id,
      lead_id: resolvedLeadId,
      message: 'Call initiated successfully',
    };
  }

  /**
   * Batch initiate calls for a campaign
   */
  async batchCalls(
    campaignId: string,
    options: { leadIds?: string[]; limit: number },
  ): Promise<{ queued: number; call_ids: string[] }> {
    const campaign = await this.campaignService.getCampaign(campaignId);
    if (!campaign || campaign.status !== 'active') {
      return { queued: 0, call_ids: [] };
    }

    let query = this.supabase
      .from('sales_leads')
      .select('id')
      .eq('segment', campaign.segment)
      .eq('opted_out', false)
      .limit(options.limit);

    if (options.leadIds && options.leadIds.length > 0) {
      query = query.in('id', options.leadIds);
    }

    const { data: leads } = await query;
    if (!leads || leads.length === 0) {
      return { queued: 0, call_ids: [] };
    }

    const callIds: string[] = [];

    for (const lead of leads) {
      const result = await this.initiateCall({
        campaign_id: campaignId,
        lead_id: lead.id,
      });

      if (result.status !== 'failed' && result.call_id) {
        callIds.push(result.call_id);
      }
    }

    return { queued: callIds.length, call_ids: callIds };
  }

  /**
   * Get call status
   */
  async getCallStatus(callId: string): Promise<{
    call_id: string;
    status: string;
    disposition?: string;
    claims?: Record<string, string>;
  }> {
    const { data: call } = await this.supabase
      .from('calls')
      .select('id, status')
      .eq('id', callId)
      .single();

    if (!call) {
      return { call_id: callId, status: 'not_found' };
    }

    // Get interaction
    const { data: interaction } = await this.supabase
      .from('sales_call_interactions')
      .select('disposition')
      .eq('call_id', callId)
      .single();

    // Get claims
    const { data: claims } = await this.supabase
      .from('sales_claims')
      .select('key, value')
      .eq('call_id', callId);

    const claimsMap: Record<string, string> = {};
    if (claims) {
      for (const claim of claims) {
        claimsMap[claim.key] = claim.value;
      }
    }

    return {
      call_id: callId,
      status: call.status,
      disposition: interaction?.disposition,
      claims: Object.keys(claimsMap).length > 0 ? claimsMap : undefined,
    };
  }

  /**
   * End call with disposition
   */
  async endCall(
    callId: string,
    request: EndCallRequest,
  ): Promise<{ success: boolean; call_id: string }> {
    const { disposition, notes, claims } = request;

    // Update call
    const { error: callError } = await this.supabase
      .from('calls')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('id', callId);

    if (callError) {
      this.logger.error('Failed to update call', callError);
      return { success: false, call_id: callId };
    }

    // Update interaction
    await this.supabase
      .from('sales_call_interactions')
      .update({
        disposition,
        notes,
        follow_up_at: disposition === 'CALL_BACK' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
      })
      .eq('call_id', callId);

    // Save claims
    if (claims && Object.keys(claims).length > 0) {
      const claimRows = Object.entries(claims).map(([key, value]) => ({
        call_id: callId,
        key,
        value,
        value_type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'integer' : 'text',
      }));

      await this.supabase.from('sales_claims').upsert(claimRows, {
        onConflict: 'call_id,key',
      });
    }

    // Handle disposition-specific actions
    await this.handleDisposition(callId, disposition);

    return { success: true, call_id: callId };
  }

  private async handleDisposition(callId: string, disposition: string): Promise<void> {
    const { data: interaction } = await this.supabase
      .from('sales_call_interactions')
      .select('lead_id')
      .eq('call_id', callId)
      .single();

    if (!interaction?.lead_id) return;

    switch (disposition) {
      case 'DO_NOT_CALL':
        await this.supabase
          .from('sales_leads')
          .update({
            opted_out: true,
            opted_out_at: new Date().toISOString(),
            opt_out_reason: 'Requested during call',
          })
          .eq('id', interaction.lead_id);
        break;

      case 'INTERESTED':
        await this.supabase
          .from('sales_leads')
          .update({ lead_status: 'qualified', qualified_at: new Date().toISOString() })
          .eq('id', interaction.lead_id);
        break;

      case 'NOT_INTERESTED':
        await this.supabase
          .from('sales_leads')
          .update({ lead_status: 'lost' })
          .eq('id', interaction.lead_id);
        break;
    }
  }

  private isWithinCallWindow(campaign: CampaignConfig): boolean {
    const now = new Date();
    const [startHour, startMin] = campaign.call_window_start.split(':').map(Number);
    const [endHour, endMin] = campaign.call_window_end.split(':').map(Number);

    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTime = currentHour * 60 + currentMin;
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    return currentTime >= startTime && currentTime <= endTime;
  }

  private async checkCooldown(leadId: string, cooldownMinutes: number): Promise<boolean> {
    const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1000);

    const { data } = await this.supabase
      .from('sales_call_interactions')
      .select('id')
      .eq('lead_id', leadId)
      .gte('created_at', cooldownTime.toISOString())
      .limit(1);

    return !data || data.length === 0;
  }

  private async getAttemptNumber(leadId: string | undefined, campaignId: string): Promise<number> {
    if (!leadId) return 1;

    const { count } = await this.supabase
      .from('sales_call_interactions')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .eq('campaign_id', campaignId);

    return (count || 0) + 1;
  }

  private async triggerVoiceBridgeCall(params: {
    callId: string;
    toNumber: string;
    campaign: CampaignConfig;
    language: string;
    voiceStyle?: string;
  }): Promise<void> {
    const response = await fetch(`${this.voiceBridgeUrl}/calls/outbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: params.toNumber,
        topic: 'sales_campaign',
        metadata: {
          call_id: params.callId,
          campaign_id: params.campaign.id,
          campaign_name: params.campaign.name,
          script_goal: params.campaign.script_goal,
          claim_schema: params.campaign.claim_schema,
          language: params.language,
          voice_style: params.voiceStyle,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Voice bridge error: ${error}`);
    }
  }
}
