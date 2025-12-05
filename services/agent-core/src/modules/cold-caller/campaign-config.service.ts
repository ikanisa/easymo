/**
 * Campaign Config Service
 * 
 * Manages campaign configurations for cold calling.
 * Campaigns define: target segment, script goals, claim schema, call rules.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Claim field definition (what data to capture during call)
 */
export interface ClaimField {
  /** Field name */
  name: string;
  /** Data type */
  type: 'text' | 'integer' | 'boolean' | 'date' | 'enum';
  /** Is this field required? */
  required?: boolean;
  /** Enum values (if type is enum) */
  enum_values?: string[];
  /** Description for the agent */
  description?: string;
}

/**
 * Campaign configuration
 */
export interface CampaignConfig {
  /** Unique ID */
  id: string;
  /** Campaign name */
  name: string;
  /** Campaign description */
  description?: string;
  /** Target segment (pharmacies, bars, moto_drivers, etc.) */
  segment: string;
  /** What we want to achieve from the call */
  script_goal: string;
  /** Expected success outcome */
  target_outcome?: string;
  /** Fields to collect during the call */
  claim_schema: ClaimField[];
  /** Max attempts per lead */
  max_attempts: number;
  /** Call window start time (HH:MM) */
  call_window_start: string;
  /** Call window end time (HH:MM) */
  call_window_end: string;
  /** Timezone for call window */
  call_window_timezone: string;
  /** Minutes between calls to same lead */
  cooldown_minutes: number;
  /** Language code */
  language: string;
  /** Voice style (professional, friendly, etc.) */
  voice_style?: string;
  /** Campaign status */
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  /** Campaign start date */
  started_at?: string;
  /** Campaign end date */
  ended_at?: string;
}

@Injectable()
export class CampaignConfigService {
  private readonly logger = new Logger(CampaignConfigService.name);
  private readonly supabase: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const supabaseKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    this.supabase = createClient(supabaseUrl || '', supabaseKey || '', {
      auth: { persistSession: false },
    });
  }

  /**
   * Get a campaign by ID
   */
  async getCampaign(campaignId: string): Promise<CampaignConfig | null> {
    const { data, error } = await this.supabase
      .from('sales_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToCampaignConfig(data);
  }

  /**
   * List all active campaigns
   */
  async listActiveCampaigns(): Promise<CampaignConfig[]> {
    const { data, error } = await this.supabase
      .from('sales_campaigns')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(this.mapToCampaignConfig);
  }

  /**
   * List campaigns by segment
   */
  async listCampaignsBySegment(segment: string): Promise<CampaignConfig[]> {
    const { data, error } = await this.supabase
      .from('sales_campaigns')
      .select('*')
      .eq('segment', segment)
      .in('status', ['active', 'paused'])
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(this.mapToCampaignConfig);
  }

  /**
   * Create a new campaign
   */
  async createCampaign(campaign: Omit<CampaignConfig, 'id'>): Promise<CampaignConfig> {
    const { data, error } = await this.supabase
      .from('sales_campaigns')
      .insert({
        name: campaign.name,
        description: campaign.description,
        segment: campaign.segment,
        script_goal: campaign.script_goal,
        target_outcome: campaign.target_outcome,
        claim_schema: campaign.claim_schema,
        max_attempts: campaign.max_attempts,
        call_window_start: campaign.call_window_start,
        call_window_end: campaign.call_window_end,
        call_window_timezone: campaign.call_window_timezone,
        cooldown_minutes: campaign.cooldown_minutes,
        language: campaign.language,
        voice_style: campaign.voice_style,
        status: campaign.status || 'draft',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create campaign: ${error.message}`);
    }

    return this.mapToCampaignConfig(data);
  }

  /**
   * Update campaign status
   */
  async updateCampaignStatus(
    campaignId: string,
    status: CampaignConfig['status'],
  ): Promise<void> {
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };

    if (status === 'active' && !await this.hasStartDate(campaignId)) {
      updates.started_at = new Date().toISOString();
    }

    if (status === 'completed' || status === 'archived') {
      updates.ended_at = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from('sales_campaigns')
      .update(updates)
      .eq('id', campaignId);

    if (error) {
      throw new Error(`Failed to update campaign status: ${error.message}`);
    }
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string): Promise<{
    total_calls: number;
    completed_calls: number;
    interested_count: number;
    not_interested_count: number;
    call_back_count: number;
    no_answer_count: number;
    do_not_call_count: number;
    avg_call_duration_seconds: number;
  }> {
    // Get call counts by disposition
    const { data: interactions } = await this.supabase
      .from('sales_call_interactions')
      .select('disposition')
      .eq('campaign_id', campaignId);

    const stats = {
      total_calls: interactions?.length || 0,
      completed_calls: 0,
      interested_count: 0,
      not_interested_count: 0,
      call_back_count: 0,
      no_answer_count: 0,
      do_not_call_count: 0,
      avg_call_duration_seconds: 0,
    };

    if (interactions) {
      for (const i of interactions) {
        if (i.disposition) {
          stats.completed_calls++;
          switch (i.disposition) {
            case 'INTERESTED':
              stats.interested_count++;
              break;
            case 'NOT_INTERESTED':
              stats.not_interested_count++;
              break;
            case 'CALL_BACK':
              stats.call_back_count++;
              break;
            case 'NO_ANSWER':
              stats.no_answer_count++;
              break;
            case 'DO_NOT_CALL':
              stats.do_not_call_count++;
              break;
          }
        }
      }
    }

    // Get average duration
    const { data: calls } = await this.supabase.rpc('get_campaign_avg_duration', {
      p_campaign_id: campaignId,
    });

    if (calls) {
      stats.avg_call_duration_seconds = calls;
    }

    return stats;
  }

  private async hasStartDate(campaignId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('sales_campaigns')
      .select('started_at')
      .eq('id', campaignId)
      .single();

    return !!data?.started_at;
  }

  private mapToCampaignConfig(data: Record<string, unknown>): CampaignConfig {
    return {
      id: data.id as string,
      name: data.name as string,
      description: data.description as string | undefined,
      segment: data.segment as string,
      script_goal: data.script_goal as string,
      target_outcome: data.target_outcome as string | undefined,
      claim_schema: (data.claim_schema as ClaimField[]) || [],
      max_attempts: (data.max_attempts as number) || 3,
      call_window_start: (data.call_window_start as string) || '09:00',
      call_window_end: (data.call_window_end as string) || '18:00',
      call_window_timezone: (data.call_window_timezone as string) || 'Africa/Kigali',
      cooldown_minutes: (data.cooldown_minutes as number) || 60,
      language: (data.language as string) || 'rw',
      voice_style: data.voice_style as string | undefined,
      status: (data.status as CampaignConfig['status']) || 'draft',
      started_at: data.started_at as string | undefined,
      ended_at: data.ended_at as string | undefined,
    };
  }
}
