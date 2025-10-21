import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { WAService } from './wa.service';
import { AGENT_PROFILES, AgentProfileDefinition, AgentProfileKey } from '../realtime/agent-profiles';

interface StartConversationInput {
  msisdn: string;
  profile: AgentProfileKey;
  callId?: string;
  initialMessage?: string;
  waConversationId?: string;
  metadata?: Record<string, unknown>;
}

interface SendAssistantMessageInput {
  threadId: string;
  msisdn: string;
  profile: AgentProfileKey;
  text: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class WhatsAppAgentService {
  constructor(
    private readonly wa: WAService,
    private readonly db: SupabaseService,
  ) {}

  private resolveProfile(profile: AgentProfileKey): AgentProfileDefinition {
    return AGENT_PROFILES[profile];
  }

  async startConversation(input: StartConversationInput) {
    const definition = this.resolveProfile(input.profile);
    const { data: thread, error } = await this.db.createWaThread({
      call_id: input.callId,
      wa_conversation_id: input.waConversationId,
      customer_msisdn: input.msisdn,
      agent_profile: definition.key,
      agent_display_name: definition.displayName,
      metadata: {
        ...(input.metadata ?? {}),
        campaign_tags: definition.campaignTags ?? [],
      },
    });
    if (error || !thread) {
      throw new Error(`failed to create wa_thread: ${error?.message ?? 'unknown error'}`);
    }

    if (input.initialMessage) {
      await this.sendAssistantMessage({
        threadId: thread.id as string,
        msisdn: input.msisdn,
        profile: definition.key,
        text: input.initialMessage,
        metadata: { seed: true },
      });
    } else {
      // Default greeting tailored to persona.
      const greeting = this.buildGreeting(definition);
      await this.sendAssistantMessage({
        threadId: thread.id as string,
        msisdn: input.msisdn,
        profile: definition.key,
        text: greeting,
        metadata: { seed: true },
      });
    }

    return thread;
  }

  async sendAssistantMessage(input: SendAssistantMessageInput) {
    const definition = this.resolveProfile(input.profile);
    await this.wa.sendText(input.msisdn, input.text);
    await this.db.logWaMessage({
      thread_id: input.threadId,
      direction: 'assistant',
      content: input.text,
      agent_profile: definition.key,
      agent_display_name: definition.displayName,
      metadata: input.metadata ?? {},
    });
    await this.db.updateWaThread(input.threadId, {
      last_message_at: new Date().toISOString(),
      state: 'active',
    });
  }

  async logCustomerMessage(threadId: string, text: string) {
    await this.db.logWaMessage({
      thread_id: threadId,
      direction: 'user',
      content: text,
    });
    await this.db.updateWaThread(threadId, {
      last_message_at: new Date().toISOString(),
      state: 'customer_replied',
    });
  }

  private buildGreeting(definition: AgentProfileDefinition) {
    const base = `Hi, this is the ${definition.displayName} from EasyMO.`;
    if (definition.key === 'cold_caller') {
      return `${base} I’m reaching out with a quick opportunity tailored for you—do you have a minute to chat?`;
    }
    if (definition.key === 'marketing') {
      return `${base} I’ve got a couple of offers you might like. Let me know if you’d like me to send the highlights.`;
    }
    if (definition.key === 'broker') {
      return `${base} I can help match you with the best insurance option in minutes. Shall we get started?`;
    }
    return `${base} I’m here to help finalize your coverage and answer any questions.`;
  }
}

