import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import { OpenAI } from "openai";
import { getApiEndpointPath } from "@easymo/commons";

type AgentPersona = "broker" | "sales" | "marketing" | "cold_caller";
type AgentSendResult = {
  threadId: string | null;
  delivery: "agent" | "direct";
  response?: any;
};

type OrchestrateInput = {
  tenantId: string;
  buyerId: string;
  msisdn: string;
  categories?: string[];
  region?: string;
  intentPayload: Record<string, unknown>;
  expiresAt?: string;
};

type SettlementInput = {
  purchaseId: string;
  amount: number;
  currency: string;
};

type AttributionInput = {
  quoteId: string;
  events?: any[];
  persist?: boolean;
  evidence?: Array<{ kind: string; ref?: string; data?: any }>;
  dispute?: { reason: string; actor: string };
};

type SupportInput = {
  msisdn: string;
  message: string;
  messageId?: string;
  timestamp?: number;
};

type VoiceCallInput = {
  msisdn: string;
  tenantId?: string;
  contactName?: string;
  region?: string;
  profile?: AgentPersona;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly http: AxiosInstance;
  private readonly client: OpenAI | null;
  private readonly agentWhatsappStartPath = getApiEndpointPath("whatsappAgents", "start");

  private buyerBase?: string;
  private vendorBase?: string;
  private rankingBase?: string;
  private walletBase?: string;
  private waBase?: string;
  private attribBase?: string;
  private reconBase?: string;
  private voiceBase?: string;
  private agentApiBase?: string;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({ timeout: 8_000 });
    const apiKey = this.config.get<string>("openai.apiKey");
    const baseUrl = this.config.get<string>("openai.baseUrl") || undefined;
    this.client = apiKey ? new OpenAI({ apiKey, baseURL: baseUrl }) : null;

    this.buyerBase = process.env.MARKETPLACE_BUYER_URL;
    this.vendorBase = process.env.MARKETPLACE_VENDOR_URL;
    this.rankingBase = process.env.MARKETPLACE_RANKING_URL;
    this.walletBase = process.env.WALLET_SERVICE_URL;
    this.waBase = process.env.WHATSAPP_BOT_URL;
    this.attribBase = process.env.ATTRIBUTION_SERVICE_URL;
    this.reconBase = process.env.RECONCILIATION_SERVICE_URL;
    this.voiceBase = this.sanitizeBase(this.config.get<string>("voiceBridgeUrl") ?? process.env.VOICE_BRIDGE_URL);
    this.agentApiBase = this.sanitizeBase(this.config.get<string>("agentApi.baseUrl") ?? process.env.AGENT_API_URL);
  }

  private sanitizeBase(url?: string | null) {
    if (!url) return undefined;
    return url.replace(/\/$/, "");
  }

  private reqHeaders() {
    return {
      "x-request-id": `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      "Idempotency-Key": `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    };
  }

  private formatError(error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.response?.data) {
        try {
          return JSON.stringify(error.response.data);
        } catch {
          return String(error.response.data);
        }
      }
      return error.message;
    }
    return String(error);
  }

  private async sendAgentWhatsapp(profile: AgentPersona, msisdn: string, text: string, metadata?: Record<string, unknown>): Promise<AgentSendResult> {
    const headers = this.reqHeaders();
    if (this.agentApiBase) {
      try {
        const response = await this.http.post(
          `${this.agentApiBase}${this.agentWhatsappStartPath}`,
          {
            msisdn,
            profile,
            initialMessage: text,
            metadata,
          },
          { headers },
        );
        return {
          threadId: response.data?.threadId ?? null,
          delivery: "agent",
          response: response.data,
        };
      } catch (error) {
        this.logger.warn({
          msg: "ai.wa.agent_delivery_failed",
          profile,
          msisdn,
          error: this.formatError(error),
        });
      }
    }

    if (!this.waBase) {
      throw new Error("WHATSAPP_BOT_URL is not configured");
    }

    await this.http.post(
      `${this.waBase}/outbound/messages`,
      { to: msisdn, text },
      { headers },
    );
    return { threadId: null, delivery: "direct" };
  }

  async startAgentWhatsappConversation(input: {
    profile: AgentPersona;
    msisdn: string;
    message: string;
    metadata?: Record<string, unknown>;
    callId?: string;
  }) {
    const metadata = { ...(input.metadata ?? {}) };
    if (input.callId) {
      metadata.callId = input.callId;
    }
    const result = await this.sendAgentWhatsapp(input.profile, input.msisdn, input.message, metadata);
    return {
      msisdn: input.msisdn,
      profile: input.profile,
      delivery: result.delivery,
      threadId: result.threadId,
      response: result.response,
    };
  }

  async runBrokerOrchestrator(input: OrchestrateInput) {
    // 1) Create intent
    const intentResp = await this.http.post(
      `${this.buyerBase}/intents`,
      {
        tenantId: input.tenantId,
        buyerId: input.buyerId,
        channel: "whatsapp",
        payload: input.intentPayload,
        expiresAt: input.expiresAt,
      },
      { headers: this.reqHeaders() },
    );
    const intentId: string = intentResp.data.id;

    // 2) Rank candidates
    const rankingResp = await this.http.get(
      `${this.rankingBase}/ranking/vendors`,
      { params: { tenantId: input.tenantId, region: input.region, categories: input.categories?.join(",") }, headers: this.reqHeaders() },
    );
    const candidates: any[] = rankingResp.data?.vendors ?? [];

    // 2b) Filter candidates by entitlements: 30 free contacts or active subscription
    const entitlementChecks = await Promise.allSettled(
      candidates.map(async (v: any) => {
        try {
          const resp = await this.http.get(`${this.vendorBase}/vendors/${v.id}/entitlements`, {
            params: { tenantId: input.tenantId },
            headers: this.reqHeaders(),
          });
          const ent = resp.data as { allowed: boolean };
          return ent.allowed ? v : null;
        } catch {
          return null;
        }
      }),
    );
    const eligible = entitlementChecks
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter(Boolean);

    // 3) Fan-out vendor quotes (cap 5)
    const top = eligible.slice(0, 5);
    const quotes = await Promise.allSettled(
      top.map((v) =>
        this.http.post(
          `${this.vendorBase}/vendors/${v.id}/quotes`,
          { tenantId: input.tenantId, intentId, price: v.price ?? 0, currency: "USD", etaMinutes: v.etaMinutes },
          { headers: this.reqHeaders() },
        ),
      ),
    );
    const okQuotes = quotes
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map((r) => r.value.data);

    // 4) Build shortlist text via OpenAI
    const shortlist = okQuotes.slice(0, 5).map((q: any) => ({ vendorId: q.vendorId, price: q.price, currency: q.currency, eta: q.etaMinutes }));
    let decisionText = this.renderDecisionPack(shortlist);
    if (this.client) {
      try {
        const resp = await this.client.responses.create({
          model: "gpt-4o-mini",
          input: [
            { role: "system", content: "Format a concise WhatsApp decision pack with 3–5 options: vendor, price (USD), ETA. Max 10 lines." },
            { role: "user", content: JSON.stringify({ shortlist }) },
          ],
        });
        const text = (resp.output_text ?? "").trim();
        if (text) decisionText = text;
      } catch (err) {
        this.logger.warn(`LLM decision pack fallback: ${String(err)}`);
      }
    }

    // 5) Deliver via persona-aware WhatsApp agent
    const delivery = await this.sendAgentWhatsapp("broker", input.msisdn, decisionText, {
      intentId,
      shortlist,
      tenantId: input.tenantId,
    });

    return {
      intentId,
      shortlist,
      message: decisionText,
      threadId: delivery.threadId,
      delivery: delivery.delivery,
    };
  }

  private renderDecisionPack(items: Array<{ vendorId: string; price: number; currency: string; eta?: number }>) {
    const lines = ["Your options:"];
    items.forEach((i, idx) => {
      lines.push(`${idx + 1}. Vendor ${i.vendorId.slice(0, 6)} — ${i.price} ${i.currency}${i.eta ? `, ETA ${i.eta}m` : ""}`);
    });
    lines.push("Reply with the number to choose.");
    return lines.join("\n");
  }

  async runSettlement(input: SettlementInput) {
    // Vendor confirm then Buyer confirm; buyer-service handles postings + attribution-driven payout
    await this.http.post(
      `${this.buyerBase}/purchases/${input.purchaseId}/confirm`,
      { actor: "VENDOR", amount: input.amount, currency: input.currency },
      { headers: this.reqHeaders() },
    );
    const buyer = await this.http.post(
      `${this.buyerBase}/purchases/${input.purchaseId}/confirm`,
      { actor: "BUYER", amount: input.amount, currency: input.currency },
      { headers: this.reqHeaders() },
    );
    return buyer.data;
  }

  async runAttribution(input: AttributionInput) {
    const evalResp = await this.http.post(
      `${this.attribBase}/attribution/evaluate`,
      { quoteId: input.quoteId, events: input.events, persist: input.persist ?? true },
      { headers: this.reqHeaders() },
    );

    let evidenceId: string | undefined;
    if (input.evidence && input.evidence.length > 0) {
      const ev = await this.http.post(
        `${this.attribBase}/attribution/evidence`,
        { quoteId: input.quoteId, artifacts: input.evidence },
        { headers: this.reqHeaders() },
      );
      evidenceId = ev.data?.id;
    }

    let disputeId: string | undefined;
    if (input.dispute) {
      const disp = await this.http.post(
        `${this.attribBase}/attribution/disputes`,
        { quoteId: input.quoteId, reason: input.dispute.reason, actor: input.dispute.actor },
        { headers: this.reqHeaders() },
      );
      disputeId = disp.data?.disputeId;
    }

    return { attribution: evalResp.data?.attribution, evidenceId, disputeId };
  }

  async runReconciliation(input: { fileBase64: string }) {
    const resp = await this.http.post(
      `${this.reconBase}/reconciliation/mobile-money`,
      { file: input.fileBase64 },
      { headers: { ...this.reqHeaders(), "Content-Type": "application/json" } },
    );
    return resp.data;
  }

  async runSupport(input: SupportInput) {
    const messages = [
      { role: "system" as const, content: "You are EasyMO's helpful support agent. Provide concise, friendly assistance. If you are unsure, acknowledge and route to a human." },
      { role: "user" as const, content: input.message },
    ];

    let reply = "Thanks for reaching out! A support specialist will review your message shortly.";
    if (this.client) {
      try {
        const response = await this.client.responses.create({
          model: "gpt-4o-mini",
          input: messages,
        });
        const text = (response.output_text ?? "").trim();
        if (text) reply = text;
      } catch (error) {
        this.logger.warn({ msg: "ai.support.llm_failed", error });
      }
    }

    const delivery = await this.sendAgentWhatsapp("sales", input.msisdn, reply, {
      messageId: input.messageId,
      timestamp: input.timestamp,
    });

    return {
      msisdn: input.msisdn,
      reply,
      messageId: input.messageId,
      timestamp: input.timestamp,
      delivery: delivery.delivery,
      threadId: delivery.threadId,
    };
  }

  async runVoiceCall(input: VoiceCallInput) {
    if (!this.voiceBase) {
      this.logger.warn({ msg: "ai.voice.skipped", reason: "VOICE_BRIDGE_URL not configured" });
      return { status: "skipped", reason: "VOICE_BRIDGE_URL not configured" };
    }

    try {
      const body: Record<string, unknown> = {
        to: input.msisdn,
      };
      if (input.tenantId) body.tenantId = input.tenantId;
      if (input.contactName) body.contactName = input.contactName;
      if (input.region) body.region = input.region;
      if (input.profile) body.profile = input.profile;

      const response = await this.http.post(
        `${this.voiceBase}/calls/outbound`,
        body,
        { headers: this.reqHeaders() },
      );
      return { ...response.data, profile: input.profile ?? null };
    } catch (error) {
      this.logger.error({ msg: "ai.voice.failed", error });
      throw error;
    }
  }
}
