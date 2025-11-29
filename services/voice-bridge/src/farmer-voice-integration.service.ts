import { CircuitBreaker, createCircuitBreaker } from "@easymo/circuit-breaker";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";

type StartVoiceCallInput = {
  fromNumber: string; // Caller's phone number
  toNumber?: string; // Called number (if outbound)
  callSid?: string; // Twilio/SIP call ID
  locale?: string;
  intent?: "farmer_supply" | "buyer_demand";
};

type VoiceCallSession = {
  callSid: string;
  sessionId: string; // Realtime API session ID
  agentCoreUrl: string;
  sseUrl: string;
  startedAt: string;
};

@Injectable()
export class FarmerVoiceIntegrationService {
  private readonly logger = new Logger(FarmerVoiceIntegrationService.name);
  private readonly http: AxiosInstance;
  private readonly circuitBreaker: CircuitBreaker;
  private agentCoreUrl: string;
  private agentCoreToken: string;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({ timeout: 10_000 });
    this.agentCoreUrl = (
      config.get<string>("agentCore.url") ||
      process.env.AGENT_CORE_URL ||
      "http://localhost:3010"
    ).replace(/\/$/, "");
    
    this.agentCoreToken = config.get<string>("agentCore.token") || process.env.AGENT_CORE_TOKEN || "";

    // Initialize circuit breaker for agent-core API calls
    this.circuitBreaker = createCircuitBreaker({
      name: "agent-core-api",
      failureThreshold: 50, // Open after 50% failures
      minimumRequests: 5, // Need at least 5 requests before opening
      windowMs: 60_000, // 60 second window
      resetTimeoutMs: 30_000, // Try recovery after 30 seconds
      requestTimeoutMs: 10_000, // 10 second timeout per request
      onStateChange: (from, to) => {
        this.logger.warn({
          msg: "circuit_breaker_state_change",
          from,
          to,
          service: "agent-core",
        });
      },
      onOpen: () => {
        this.logger.error({
          msg: "circuit_breaker_opened",
          service: "agent-core",
          action: "failing_fast_for_30s",
        });
      },
    });
  }

  async startVoiceCall(input: StartVoiceCallInput): Promise<VoiceCallSession> {
    // Detect intent from phone number routing or default to farmer_supply
    const intent = input.intent || await this.detectIntent(input.fromNumber);
    const locale = input.locale || await this.detectLocale(input.fromNumber);

    // Fetch farm context if available
    const farmContext = await this.fetchFarmContext(input.fromNumber);

    try {
      // Create Realtime API session via agent-core with circuit breaker protection
      const response = await this.circuitBreaker.execute(() =>
        this.http.post(
          `${this.agentCoreUrl}/realtime/farmer/session`,
          {
            msisdn: input.fromNumber,
            locale,
            intent,
            farmContext,
          },
          {
            headers: {
              Authorization: `Bearer ${this.agentCoreToken}`,
              "Content-Type": "application/json",
            },
          },
        )
      );

      const { sessionId, sseUrl } = response.data;

      const session: VoiceCallSession = {
        callSid: input.callSid || `call-${Date.now()}`,
        sessionId,
        agentCoreUrl: this.agentCoreUrl,
        sseUrl: `${this.agentCoreUrl}${sseUrl}`,
        startedAt: new Date().toISOString(),
      };

      this.logger.log({
        msg: "voice_call_session_started",
        callSid: session.callSid,
        sessionId,
        intent,
        locale,
      });

      return session;
    } catch (error) {
      this.logger.error({
        msg: "voice_call_session_failed",
        fromNumber: input.fromNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async sendAudio(sessionId: string, audioChunk: Buffer): Promise<void> {
    try {
      const base64Audio = audioChunk.toString("base64");
      await this.circuitBreaker.execute(() =>
        this.http.post(
          `${this.agentCoreUrl}/realtime/farmer/session/${sessionId}/audio`,
          { audioChunk: base64Audio },
          {
            headers: {
              Authorization: `Bearer ${this.agentCoreToken}`,
              "Content-Type": "application/json",
            },
          },
        )
      );
    } catch (error) {
      this.logger.error({
        msg: "send_audio_failed",
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async commitAudio(sessionId: string): Promise<void> {
    try {
      await this.http.post(
        `${this.agentCoreUrl}/realtime/farmer/session/${sessionId}/commit`,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.agentCoreToken}`,
          },
        },
      );
    } catch (error) {
      this.logger.error({
        msg: "commit_audio_failed",
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async endVoiceCall(sessionId: string): Promise<void> {
    try {
      await this.http.delete(
        `${this.agentCoreUrl}/realtime/farmer/session/${sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${this.agentCoreToken}`,
          },
        },
      );

      this.logger.log({
        msg: "voice_call_ended",
        sessionId,
      });
    } catch (error) {
      this.logger.warn({
        msg: "end_voice_call_failed",
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async detectIntent(phoneNumber: string): Promise<"farmer_supply" | "buyer_demand"> {
    // Logic: Check if number has buyer profile metadata
    // For now, default to farmer_supply (most common use case)
    // In production, query database for user profile
    return "farmer_supply";
  }

  private async detectLocale(phoneNumber: string): Promise<string> {
    // Logic: Detect from country code
    // +250 = Rwanda (rw), +254 = Kenya (sw), +255 = Tanzania (sw)
    if (phoneNumber.startsWith("+250")) return "rw";
    if (phoneNumber.startsWith("+254")) return "sw";
    if (phoneNumber.startsWith("+255")) return "sw";
    if (phoneNumber.startsWith("+225")) return "fr"; // Côte d'Ivoire
    if (phoneNumber.startsWith("+221")) return "fr"; // Senegal
    if (phoneNumber.startsWith("+233")) return "en"; // Ghana
    if (phoneNumber.startsWith("+256")) return "en"; // Uganda
    return "rw"; // Default to Kinyarwanda
  }

  private async fetchFarmContext(phoneNumber: string): Promise<{
    farmName?: string;
    district?: string;
    commodities?: string[];
  } | undefined> {
    // In production, query Supabase for farm profile
    // For now, return undefined (agent will ask for details)
    return undefined;
  }

  getAgentCoreUrl(): string {
    return this.agentCoreUrl;
  }
}
