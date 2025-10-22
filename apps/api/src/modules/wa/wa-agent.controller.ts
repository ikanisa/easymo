import { BadRequestException, Body, Controller, NotFoundException, Param, Post } from '@nestjs/common';
import { WhatsAppAgentService } from './wa-agent.service';
import { DEFAULT_AGENT_PROFILE, AGENT_PROFILES, AgentProfileKey, isAgentProfileKey } from '../realtime/agent-profiles';
import { SupabaseService } from '../supabase/supabase.service';
import { getApiControllerBasePath, getApiEndpointSegment } from '@easymo/commons';

interface StartBody {
  msisdn?: string;
  profile?: string;
  callId?: string;
  initialMessage?: string;
  waConversationId?: string;
  metadata?: Record<string, unknown>;
}

interface SendMessageBody {
  text?: string;
  metadata?: Record<string, unknown>;
}

interface CustomerMessageBody {
  text?: string;
}

@Controller(getApiControllerBasePath('whatsappAgents'))
export class WhatsAppAgentController {
  constructor(
    private readonly agent: WhatsAppAgentService,
    private readonly db: SupabaseService,
  ) {}

  @Post(getApiEndpointSegment('whatsappAgents', 'start'))
  async startConversation(@Body() body: StartBody) {
    const msisdn = body?.msisdn;
    if (!msisdn) {
      throw new BadRequestException("Missing 'msisdn'");
    }
    const requestedProfile = body?.profile;
    const profileKey: AgentProfileKey = isAgentProfileKey(requestedProfile) ? requestedProfile : DEFAULT_AGENT_PROFILE;
    const thread = await this.agent.startConversation({
      msisdn,
      profile: profileKey,
      callId: body?.callId,
      initialMessage: body?.initialMessage,
      waConversationId: body?.waConversationId,
      metadata: body?.metadata,
    });
    const definition = AGENT_PROFILES[profileKey];
    return {
      threadId: thread.id,
      agentProfile: profileKey,
      agentDisplayName: definition.displayName,
      campaignTags: definition.campaignTags ?? [],
    };
  }

  @Post(getApiEndpointSegment('whatsappAgents', 'sendMessage'))
  async sendMessage(@Param('threadId') threadId: string, @Body() body: SendMessageBody) {
    const text = body?.text;
    if (!text) {
      throw new BadRequestException("Missing 'text'");
    }
    const { data: thread, error } = await this.db.getWaThreadById(threadId);
    if (error || !thread) {
      throw new NotFoundException(`Unable to load thread ${threadId}: ${error?.message ?? 'not found'}`);
    }
    const profile = (thread.agent_profile as AgentProfileKey) ?? DEFAULT_AGENT_PROFILE;
    const profileKey: AgentProfileKey = isAgentProfileKey(profile) ? profile : DEFAULT_AGENT_PROFILE;
    await this.agent.sendAssistantMessage({
      threadId,
      msisdn: thread.customer_msisdn as string,
      profile: profileKey,
      text,
      metadata: body?.metadata,
    });
    return { ok: true };
  }

  @Post(getApiEndpointSegment('whatsappAgents', 'customerMessage'))
  async customerMessage(@Param('threadId') threadId: string, @Body() body: CustomerMessageBody) {
    const text = body?.text;
    if (!text) {
      throw new BadRequestException("Missing 'text'");
    }
    const { data: thread, error } = await this.db.getWaThreadById(threadId);
    if (error || !thread) {
      throw new NotFoundException(`Unable to load thread ${threadId}: ${error?.message ?? 'not found'}`);
    }
    await this.agent.logCustomerMessage(threadId, text);
    return { ok: true };
  }
}
