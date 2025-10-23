import { Injectable } from '@nestjs/common';
import { getApiEndpointPath } from '@easymo/commons';
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

  private async buildInstructionsAsync(
    definition: AgentProfileDefinition,
    countryCode: string,
    userId?: string,
  ) {
    const blocks: string[] = [
      `You are the ${definition.displayName} for ${countryCode}.`,
      ...definition.instructionBlocks,
      'Always obtain recording consent referencing local policy before continuing.',
      'Use MCP tools for CRM, KYC, compliance, and pricing actions when appropriate.',
      'Offer WhatsApp follow-up summaries when the caller agrees; never take payment details over voice.',
      'Trigger a warm transfer if the caller requests a human or your confidence is low.',
    ];
    try {
      if (userId) {
        const { data } = await this.db.client
          .from('assistant_memory')
          .select('key,value')
          .eq('user_id', userId)
          .in('key', ['region', 'preferences', 'likes'])
          .limit(10);
        if (Array.isArray(data) && data.length) {
          const prefs: Record<string, any> = Object.fromEntries(
            data.map((row: any) => [row.key, row.value]),
          );
          const likes = Array.isArray(prefs.likes) ? prefs.likes : prefs.preferences?.likes;
          if (likes && Array.isArray(likes) && likes.length) {
            blocks.push(`User preferences include: ${likes.join(', ')}.`);
          }
          if (typeof prefs.region === 'string' && prefs.region) {
            blocks.push(`User region: ${prefs.region}. Prefer relevant local options.`);
          }
        }
      }
    } catch {
      // non-fatal
    }
    return blocks.join(' ');
  }

  private classifyIntent(text: string) {
    const t = (text || '').toLowerCase();
    if (/(pharmacy|medic|health|clinic|hospital)/.test(t)) return 'pharmacy';
    if (/(bar|drink|beer|wine|pub)/.test(t)) return 'bar';
    if (/(music|live)/.test(t)) return 'live-music';
    return 'general';
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

    const instructions = await this.buildInstructionsAsync(agent.definition, countryCode, body?.user_id);
    const config = {
      instructions,
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
        {
          type: 'function',
          name: 'suggest_businesses',
          parameters: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              region: { type: 'string' },
              limit: { type: 'number' },
              msisdn: { type: 'string' },
              user_id: { type: 'string' },
            },
            required: ['text'],
          },
        },
      ],
      sideband: {
        url: new URL(getApiEndpointPath('realtime', 'events'), env.baseUrl).toString(),
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

    // Attempt to pull a user_id from sideband context for session/memory updates
    const userId = (event?.data?.user_id ?? event?.data?.context?.user_id) as string | undefined;
    if (userId && typeof userId === 'string') {
      await this.db.touchAssistantSession(userId).catch(() => undefined);
    }

    if (eventType === 'conversation.item.input_audio_transcription.completed') {
      const text = event?.data?.text;
      if (text) {
        await this.db.addTranscript(callId, 'user', text, event?.data?.language ?? 'en');
        if (userId) {
          await this.db.upsertAssistantMemory(userId, 'last_user_message', { text, at: new Date().toISOString() }).catch(() => undefined);
          // Extract coarse preferences from user text (e.g., live music, pharmacy, bar)
          try {
            const likes: string[] = [];
            const t = text.toLowerCase();
            if (/(live\s*music)/.test(t)) likes.push('live music');
            if (/(pharmacy|medic|clinic|hospital)/.test(t)) likes.push('pharmacy');
            if (/(bar|drink|beer|wine|pub)/.test(t)) likes.push('bar');
            if (likes.length) {
              // Merge with existing likes
              const { data } = await this.db.client
                .from('assistant_memory')
                .select('value')
                .eq('user_id', userId)
                .eq('key', 'likes')
                .single();
              const current = Array.isArray((data as any)?.value) ? (data as any).value : [];
              const merged = Array.from(new Set([...
                (current as any[]).map((s) => String(s).toLowerCase()),
                ...likes,
              ]));
              await this.db.upsertAssistantMemory(userId, 'likes', merged).catch(() => undefined);
            }
          } catch {}
        }
      }
    }

    if (eventType === 'response.output_text.delta') {
      const text = event?.data?.text;
      if (text) {
        await this.db.addTranscript(callId, 'assistant', text, event?.data?.language ?? 'en');
        if (userId) {
          await this.db.upsertAssistantMemory(userId, 'last_assistant_message', { text, at: new Date().toISOString() }).catch(() => undefined);
        }
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
      if (name === 'suggest_businesses') {
        try {
          const limit = Math.max(1, Math.min(10, Number(args?.limit ?? 5)));
          const text = String(args?.text ?? '');
          const category = this.classifyIntent(text);
          let query = this.db.client.from('businesses').select('*').limit(limit);
          const region = typeof args?.region === 'string' ? args.region : undefined;
          if (category === 'pharmacy') query = query.eq('category', 'pharmacy');
          if (category === 'bar') query = query.eq('category', 'bar');
          if (region) query = query.ilike('region', `%${region}%`);
          if (category === 'general') query = query.ilike('name', `%${text.split(' ')[0]}%`);
          const { data } = await query;
          const items = Array.isArray(data) ? data.slice(0, limit) : [];
          if (args?.msisdn && items.length) {
            const lines = items.map((i: any, idx: number) => `${idx + 1}. ${i.name ?? i.id} — ${i.region ?? ''}`);
            await this.wa.sendText(String(args.msisdn), `Suggestions:\n${lines.join('\n')}`);
          }
        } catch (err) {
          await this.db.logEvent(callId, 'suggest_businesses.error', { error: String((err as any)?.message ?? err) });
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
