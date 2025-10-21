import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { signJwt, verifyOpenAIWebhook } from '../../common/crypto';
import { env } from '../../common/env';
import { WAService } from '../wa/wa.service';
import { TwilioService } from '../twilio/twilio.service';
import { AgentProfileResolver } from './agent-profile-resolver';
import { AgentProfileDefinition, AgentProfileKey } from './agent-profiles';

interface SessionConfigResponse {
  config: Record<string, unknown>;
  callId: string;
  agentProfile: AgentProfileKey;
  agentDisplayName: string;
}

@Injectable()
export class RealtimeService {
  constructor(
    private readonly db: SupabaseService,
    private readonly wa: WAService,
    private readonly twilio: TwilioService,
    private readonly agentResolver: AgentProfileResolver,
  ) {}

  private parseArgs(input: unknown): Record<string, any> {
    if (!input) {
      return {};
    }
    if (typeof input === 'string') {
      try {
        return JSON.parse(input);
      } catch (err) {
        console.warn('unable to parse function arguments', err);
        return {};
      }
    }
    if (typeof input === 'object') {
      return input as Record<string, any>;
    }
    return {};
  }

  verifySignature(signature: string | undefined, rawBody: Buffer | undefined) {
    if (!rawBody) {
      return false;
    }
    return verifyOpenAIWebhook(signature, rawBody, env.openaiWebhookSecret);
  }

  private pickVoice(definition: AgentProfileDefinition, locale?: string, country?: string) {
    if (locale === 'kin') {
      return 'africa_female_1';
    }
    if (country === 'MT') {
      return 'europe_male_1';
    }
    return definition.defaultVoice;
  }

  private buildInstructions(definition: AgentProfileDefinition, countryCode: string) {
    const blocks = [
      `You are the ${definition.displayName} for ${countryCode}.`,
      ...definition.instructionBlocks,
      'Always obtain recording consent referencing local policy before continuing.',
      'Use MCP tools for CRM, KYC, compliance, and pricing actions when appropriate.',
      'Offer WhatsApp follow-up summaries when the caller agrees; never take payment details over voice.',
      'Trigger a warm transfer if the caller requests a human or your confidence is low.',
    ];
    return blocks.join(' ');
  }

  async onIncomingWebhook(body: any): Promise<SessionConfigResponse> {
    const {
      from,
      to,
      locale,
      project_id,
      sip_session_id,
      country,
      twilio_call_sid,
    } = body;

    const agent = this.agentResolver.resolveFromWebhook(body);

    const metadata: Record<string, unknown> = {
      agent_profile: agent.key,
      agent_display_name: agent.definition.displayName,
      agent_confidence: agent.confidence,
      agent_is_outbound: !!agent.definition.isOutbound,
    };
    if (body?.metadata && typeof body.metadata === 'object') {
      metadata.webhook_metadata = body.metadata;
    }

    const { data: call, error } = await this.db.createCall({
      from_e164: from,
      to_e164: to,
      locale: locale ?? 'en',
      project_id,
      sip_session_id,
      direction: 'inbound',
      country,
      twilio_call_sid,
      agent_profile: agent.key,
      agent_profile_confidence: agent.confidence,
      channel: 'voice',
      campaign_tags: agent.definition.campaignTags?.length ? agent.definition.campaignTags : undefined,
      metadata,
    });

    let callRecord = call;
    let callError = error;

    if ((!callRecord || callError) && twilio_call_sid) {
      const isDuplicate =
        callError?.code === '23505' ||
        (typeof callError?.message === 'string' && callError.message.includes('duplicate key value'));
      if (isDuplicate) {
        const { data: existing, error: existingError } = await this.db.getCallByTwilioSid(twilio_call_sid);
        if (existing && !existingError) {
          callRecord = existing;
          callError = undefined;
        } else {
          callError = existingError ?? callError;
        }
      }
    }

    if (callError || !callRecord) {
      throw new Error(`failed to create voice call record: ${callError?.message ?? 'unknown error'}`);
    }

    const countryCode = country ?? 'RW';

    const voice = this.pickVoice(agent.definition, locale, countryCode);

    const config = {
      instructions: this.buildInstructions(agent.definition, countryCode),
      voice,
      modalities: ['audio'],
      input_audio_format: 'g711_ulaw',
      turn_detection: { type: 'server_vad' },
      tools: [
        { type: 'mcp', server: 'crm-mcp' },
        { type: 'mcp', server: 'kyc-mcp' },
        { type: 'mcp', server: 'pricing-mcp' },
        {
          type: 'function',
          name: 'create_whatsapp_followup',
          parameters: {
            type: 'object',
            properties: {
              msisdn: { type: 'string' },
              summary: { type: 'string' },
            },
            required: ['msisdn', 'summary'],
          },
        },
        {
          type: 'function',
          name: 'initiate_warm_transfer',
          parameters: {
            type: 'object',
            properties: {
              queue: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['queue'],
          },
        },
      ],
      sideband: {
        url: `${env.baseUrl}/realtime/events`,
        bearer: await signJwt({ call_id: callRecord.id }, env.jwtSigningKey),
      },
    };

    return {
      config,
      callId: callRecord.id as string,
      agentProfile: agent.key,
      agentDisplayName: agent.definition.displayName,
    };
  }

  async handleSidebandEvent(callId: string, event: any) {
    const eventType = event?.type ?? 'unknown';
    await this.db.logEvent(callId, eventType, event);

    if (eventType === 'conversation.item.input_audio_transcription.completed') {
      const text = event?.data?.text;
      if (text) {
        await this.db.addTranscript(callId, 'user', text, event?.data?.language ?? 'en');
      }
    }

    if (eventType === 'response.output_text.delta') {
      const text = event?.data?.text;
      if (text) {
        await this.db.addTranscript(callId, 'assistant', text, event?.data?.language ?? 'en');
      }
    }

    if (eventType === 'response.function.call') {
      const name = event?.data?.name;
      const args = this.parseArgs(event?.data?.arguments);
      if (name === 'create_whatsapp_followup') {
        await this.wa.sendText(args.msisdn, args.summary);
      }
      if (name === 'initiate_warm_transfer') {
        const twilioCallSid = event?.data?.context?.twilio_call_sid ?? event?.twilio_call_sid;
        if (twilioCallSid) {
          await this.twilio.warmTransfer(twilioCallSid, args.queue);
        }
      }
    }

    if (eventType === 'response.mcp.tool_call.completed') {
      const args = this.parseArgs(event?.data?.arguments);
      await this.db.logMcpToolCall(
        callId,
        event?.data?.server ?? 'unknown',
        event?.data?.tool ?? 'unknown',
        args,
        event?.data?.result ?? {},
        !!event?.data?.ok,
      );
    }
  }
}
