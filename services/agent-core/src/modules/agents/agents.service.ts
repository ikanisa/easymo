import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAI } from "openai";

type AgentRunMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
};

type AgentRunOptions = {
  agentId?: string;
  messages: AgentRunMessage[];
  metadata?: Record<string, string>;
};

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);
  private readonly client: OpenAI | null;
  private readonly defaultAgentId: string | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("openai.apiKey");
    const baseUrl = this.config.get<string>("openai.baseUrl") || undefined;
    this.defaultAgentId = this.config.get<string>("openai.agentId") ?? null;
    if (apiKey) {
      this.client = new OpenAI({ apiKey, baseURL: baseUrl });
      this.logger.log("OpenAI client initialised for agent runtime");
    } else {
      this.client = null;
      this.logger.warn("OpenAI API key missing; agent runtime disabled");
    }
  }

  isConfigured() {
    return Boolean(this.client && (this.defaultAgentId ?? "").length);
  }

  async runAgent(options: AgentRunOptions) {
    if (!this.client) {
      throw new Error("OpenAI client not configured");
    }
    const model = options.agentId ?? this.defaultAgentId;
    if (!model) {
      throw new Error("Agent identifier is not configured");
    }

    const input = options.messages
      .map((message) => `[${message.role}] ${message.content}`)
      .join("\n");

    const response = await this.client.responses.create({
      model,
      metadata: options.metadata,
      input,
    });

    return response;
  }
}
