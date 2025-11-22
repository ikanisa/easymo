import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RealtimeClient } from "openai/lib/realtime";

import type { FarmerBrokerIntent } from "../../agents/farmer-broker.js";

type RealtimeSessionConfig = {
  instructions: string;
  voice: "alloy" | "echo" | "shimmer";
  input_audio_format: "pcm16" | "g711_ulaw" | "g711_alaw";
  output_audio_format: "pcm16" | "g711_ulaw" | "g711_alaw";
  turn_detection?: {
    type: "server_vad";
    threshold: number;
    prefix_padding_ms: number;
    silence_duration_ms: number;
  };
};

type FarmerRealtimeInput = {
  msisdn: string;
  locale: string;
  intent: FarmerBrokerIntent;
  conversationId?: string;
  farmContext?: {
    farmName?: string;
    district?: string;
    commodities?: string[];
  };
};

const FARMER_REALTIME_INSTRUCTIONS = `You are EasyMO's Agricultural AI Assistant speaking to farmers in Rwanda.

LANGUAGE RULES:
- If intent is "farmer_supply": Speak in KINYARWANDA with occasional English terms for technical words (prices, measurements)
- If intent is "buyer_demand": Greet briefly in Kinyarwanda then switch to clear ENGLISH for Kigali business buyers
- Always be warm, respectful, and community-focused

CONVERSATION STYLE:
- Ask ONE question at a time
- Wait for user response before proceeding
- Confirm understanding after each answer
- Use natural pauses and acknowledgments

NUMBERED OPTIONS:
- When presenting choices, use numbered lists 1-10
- Say: "Andika numero" (Kinyarwanda) or "Reply with number" (English)
- Remember user's number selection in context

AGRICULTURAL EXPERTISE:
- Discuss: harvest timing, quantity, quality grades, location
- Explain: pooled pickups, 20-30% deposits, cooperative benefits
- Market prices: Reference typical Rwanda prices (e.g., 850 RWF/kg maize)
- Storage: Mention moisture levels, bag weights, curing times

FARMER SUPPLY FLOW:
1. Confirm crop type and quantity
2. Verify location (district, sector)
3. Assess quality/grade
4. Discuss harvest timing
5. Present pricing options (3 choices)
6. Explain deposit process if interested
7. Coordinate pickup windows

BUYER DEMAND FLOW:
1. Confirm produce needed
2. Verify quantity required
3. Check delivery location
4. Discuss quality requirements
5. Present available supply options (with farmer locations)
6. Explain logistics and payment terms
7. Coordinate delivery schedule

TONE: Professional but friendly, patient, knowledgeable about Rwandan agriculture.`;

const BUYER_REALTIME_INSTRUCTIONS = `You are EasyMO's Kigali Buyer Liaison for agricultural produce.

LANGUAGE: English (brief Kinyarwanda greeting only: "Muraho!")

CONVERSATION STYLE:
- Concise and business-focused
- Present information in numbered lists
- Confirm details efficiently
- Professional wholesale/retail terminology

BUYER NEEDS ASSESSMENT:
1. What produce are you looking for?
2. How much quantity (tonnes/bags)?
3. Delivery location in Kigali
4. Quality grade requirements
5. Frequency (one-time or recurring)

SUPPLY PRESENTATION:
- List available farmers with: crop, quantity, location, grade, price
- Format: "1️⃣ Farmer A: 200kg Grade A maize, Rwamagana, 850 RWF/kg"
- Max 10 options per response
- Highlight: pooled pickup savings, cooperative discounts

LOGISTICS:
- Explain pickup windows (reduces transport costs)
- 20-30% deposit to reserve slot
- Payment: MTN MoMo, Airtel Money, bank transfer
- Delivery timing: 2-5 days typical

TONE: Efficient, data-driven, cost-conscious, Kigali market savvy.`;

@Injectable()
export class RealtimeFarmerService {
  private readonly logger = new Logger(RealtimeFarmerService.name);
  private clients: Map<string, RealtimeClient> = new Map();
  private apiKey: string | null;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>("openai.apiKey") || null;
  }

  async createSession(input: FarmerRealtimeInput): Promise<{
    sessionId: string;
    client: RealtimeClient;
  }> {
    if (!this.apiKey) {
      throw new Error("OpenAI API key not configured for Realtime");
    }

    const sessionId = `farmer-${input.msisdn}-${Date.now()}`;
    const instructions = input.intent === "farmer_supply"
      ? FARMER_REALTIME_INSTRUCTIONS
      : BUYER_REALTIME_INSTRUCTIONS;

    // Add farm context if available
    let contextualInstructions = instructions;
    if (input.farmContext) {
      const contextParts: string[] = [];
      if (input.farmContext.farmName) {
        contextParts.push(`Farm: ${input.farmContext.farmName}`);
      }
      if (input.farmContext.district) {
        contextParts.push(`Location: ${input.farmContext.district}`);
      }
      if (input.farmContext.commodities?.length) {
        contextParts.push(`Past crops: ${input.farmContext.commodities.join(", ")}`);
      }
      if (contextParts.length) {
        contextualInstructions += `\n\nCONTEXT:\n${contextParts.join("\n")}`;
      }
    }

    // Select voice based on intent and locale
    const voice = this.selectVoice(input.intent, input.locale);

    const client = new RealtimeClient({
      apiKey: this.apiKey,
      model: "gpt-4o-realtime-preview-2024-12-17",
    });

    const sessionConfig: RealtimeSessionConfig = {
      instructions: contextualInstructions,
      voice,
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      },
    };

    try {
      await client.connect();
      await client.updateSession(sessionConfig);

      this.clients.set(sessionId, client);

      // Auto cleanup after 30 minutes
      setTimeout(() => {
        this.closeSession(sessionId);
      }, 30 * 60 * 1000);

      this.logger.log({
        msg: "realtime_session_created",
        sessionId,
        intent: input.intent,
        locale: input.locale,
        voice,
      });

      return { sessionId, client };
    } catch (error) {
      this.logger.error({
        msg: "realtime_session_create_failed",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  getSession(sessionId: string): RealtimeClient | null {
    return this.clients.get(sessionId) || null;
  }

  async closeSession(sessionId: string): Promise<void> {
    const client = this.clients.get(sessionId);
    if (client) {
      try {
        await client.disconnect();
        this.clients.delete(sessionId);
        this.logger.log({ msg: "realtime_session_closed", sessionId });
      } catch (error) {
        this.logger.warn({
          msg: "realtime_session_close_failed",
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private selectVoice(
    intent: FarmerBrokerIntent,
    locale: string,
  ): "alloy" | "echo" | "shimmer" {
    // Farmer supply (Kinyarwanda): Use warm, approachable voice
    if (intent === "farmer_supply") {
      return "shimmer"; // Female, warm tone for community trust
    }

    // Buyer demand (English): Use professional, clear voice
    return "alloy"; // Neutral, professional for business
  }

  async sendAudioChunk(sessionId: string, audioChunk: Int16Array): Promise<void> {
    const client = this.getSession(sessionId);
    if (!client) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      await client.appendInputAudio(audioChunk);
    } catch (error) {
      this.logger.error({
        msg: "realtime_audio_send_failed",
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async commitAudio(sessionId: string): Promise<void> {
    const client = this.getSession(sessionId);
    if (!client) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      await client.createResponse();
    } catch (error) {
      this.logger.error({
        msg: "realtime_commit_failed",
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  onSessionUpdate(
    sessionId: string,
    callback: (event: any) => void,
  ): void {
    const client = this.getSession(sessionId);
    if (!client) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    client.on("conversation.updated", callback);
  }

  onAudioOutput(
    sessionId: string,
    callback: (audio: Int16Array) => void,
  ): void {
    const client = this.getSession(sessionId);
    if (!client) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    client.on("response.audio.delta", (event: any) => {
      if (event.delta) {
        // Convert base64 audio to Int16Array
        const audioBuffer = Buffer.from(event.delta, "base64");
        const int16Array = new Int16Array(
          audioBuffer.buffer,
          audioBuffer.byteOffset,
          audioBuffer.byteLength / 2,
        );
        callback(int16Array);
      }
    });
  }

  onTranscript(
    sessionId: string,
    callback: (transcript: string, role: "user" | "assistant") => void,
  ): void {
    const client = this.getSession(sessionId);
    if (!client) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    client.on("conversation.item.input_audio_transcription.completed", (event: any) => {
      if (event.transcript) {
        callback(event.transcript, "user");
      }
    });

    client.on("response.audio_transcript.delta", (event: any) => {
      if (event.delta) {
        callback(event.delta, "assistant");
      }
    });
  }

  async sendTextMessage(sessionId: string, message: string): Promise<void> {
    const client = this.getSession(sessionId);
    if (!client) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      await client.sendUserMessageContent([
        { type: "input_text", text: message },
      ]);
      await client.createResponse();
    } catch (error) {
      this.logger.error({
        msg: "realtime_text_send_failed",
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async injectContext(
    sessionId: string,
    contextUpdate: {
      farmName?: string;
      district?: string;
      commodities?: string[];
      priceEstimate?: number;
    },
  ): Promise<void> {
    const client = this.getSession(sessionId);
    if (!client) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const contextParts: string[] = [];
    if (contextUpdate.farmName) {
      contextParts.push(`Farm name is ${contextUpdate.farmName}`);
    }
    if (contextUpdate.district) {
      contextParts.push(`Located in ${contextUpdate.district}`);
    }
    if (contextUpdate.commodities?.length) {
      contextParts.push(`Growing: ${contextUpdate.commodities.join(", ")}`);
    }
    if (contextUpdate.priceEstimate) {
      contextParts.push(`Market price estimate: ${contextUpdate.priceEstimate} RWF/kg`);
    }

    if (contextParts.length) {
      const contextMessage = `[System Context Update: ${contextParts.join(". ")}]`;
      await this.sendTextMessage(sessionId, contextMessage);
    }
  }

  getActiveSessions(): string[] {
    return Array.from(this.clients.keys());
  }

  async closeAllSessions(): Promise<void> {
    const sessionIds = this.getActiveSessions();
    await Promise.all(sessionIds.map((id) => this.closeSession(id)));
  }
}
