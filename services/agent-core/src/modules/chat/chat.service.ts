import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAI } from "openai";
import type { AgentKind } from "@easymo/commons";
import { ChatHistoryMessage, ToolkitConfig } from "./types.js";

const RESPONSE_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "agent_response",
    strict: true,
    schema: {
      type: "object",
      properties: {
        reply: { type: "string", minLength: 1 },
        suggestions: {
          type: "array",
          items: { type: "string" },
        },
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              payload: { type: ["object", "null"] },
            },
            required: ["type"],
            additionalProperties: true,
          },
        },
      },
      required: ["reply"],
      additionalProperties: true,
    },
  },
} as const;

const BASE_PROMPTS: Record<AgentKind, string> = {
  broker: [
    "You are the EasyMO Marketplace Broker. Match buyers with vetted vendors and explain the reasoning clearly.",
    "Summarise shortlists, highlight pros and cons, and recommend next steps without committing to financial terms.",
    "When referencing live data or search results, cite the source inline using markdown footnotes.",
  ].join(" \n"),
  support: [
    "You are the EasyMO Support Specialist. Troubleshoot mobility issues and capture incident details.",
    "Offer step-by-step resolution options, escalate when safety or compliance risks are identified, and cite policies.",
  ].join(" \n"),
  sales: [
    "You are the EasyMO Sales Closer. Convert qualified leads while respecting compliance constraints.",
    "Summarise value propositions, address objections, and recommend follow-up actions with clear citations.",
  ].join(" \n"),
  marketing: [
    "You are the EasyMO Marketing Concierge. Produce campaign ideas, recap metrics, and suggest next actions.",
    "Use web and file search tools to source the latest market insights and cite references inline.",
  ].join(" \n"),
  mobility: [
    "You are the EasyMO Mobility Dispatcher. Coordinate drivers, riders, and field operations in real time.",
    "Leverage live search and knowledge bases to surface ETAs, policies, and contingency plans with citations.",
  ].join(" \n"),
};

type GenerateReplyInput = {
  sessionId: string;
  agentKind: AgentKind;
  message: string;
  profileRef?: string | null;
  history: ChatHistoryMessage[];
  toolkit: ToolkitConfig | null;
};

type GenerateReplyResult = {
  reply: string;
  suggestions?: string[];
  citations?: unknown[];
  sources?: unknown[];
  tool_calls?: unknown[];
  images?: Array<{ data: string; format?: string; revised_prompt?: string }>;
  retrieval_context?: string;
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly client: OpenAI | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("openai.apiKey");
    const baseUrl = this.config.get<string>("openai.baseUrl") || undefined;
    this.client = apiKey ? new OpenAI({ apiKey, baseURL: baseUrl }) : null;
    if (!this.client) {
      this.logger.warn("OpenAI client not configured; agent responses will be unavailable");
    }
  }

  async generateReply(input: GenerateReplyInput): Promise<GenerateReplyResult> {
    if (!this.client) {
      throw new Error("openai_client_unavailable");
    }

    const { tools, include } = this.buildTools(input.toolkit);
    const retrievalContext = await this.buildRetrievalContext(input.toolkit, input.message);
    const historyMessages = this.normaliseHistory(input.history);
    const systemPrompt = this.buildSystemPrompt(input.agentKind, input.toolkit);

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (retrievalContext) {
      messages.push({
        role: "system",
        content: `Relevant knowledge base excerpts:\n${retrievalContext}`,
      });
    }

    for (const msg of historyMessages) {
      messages.push(msg);
    }

    messages.push({ role: "user", content: input.message });

    const response = await this.client.responses.create({
      model: input.toolkit?.model ?? "gpt-5",
      input: messages,
      tools: tools.length > 0 ? tools : undefined,
      reasoning: { effort: input.toolkit?.reasoning_effort ?? "medium" },
      text: {
        verbosity: input.toolkit?.text_verbosity ?? "medium",
        format: RESPONSE_SCHEMA,
      },
      metadata: {
        session_id: input.sessionId,
        agent_kind: input.agentKind,
        profile_ref: input.profileRef ?? undefined,
      },
      tool_choice: this.buildToolChoice(input.toolkit),
      include: include.length > 0 ? include : undefined,
    });

    const parsed = this.parseStructuredOutput(response.output_text ?? "");
    const reply = parsed?.reply?.trim().length ? parsed.reply.trim() : this.extractFallbackText(response) ?? "I have logged your request.";
    const suggestions = this.extractSuggestions(parsed) ?? this.extractToolkitSuggestions(input.toolkit);
    const citations = this.extractCitations(response);
    const sources = this.extractSources(response);
    const toolCalls = this.extractToolCalls(response);
    const images = this.extractImages(response);

    return {
      reply,
      suggestions,
      citations,
      sources,
      tool_calls: toolCalls,
      images,
      retrieval_context: retrievalContext ?? undefined,
    };
  }

  private buildSystemPrompt(agentKind: AgentKind, toolkit: ToolkitConfig | null) {
    const base = BASE_PROMPTS[agentKind] ?? "You are a helpful EasyMO assistant.";
    const extra = [] as string[];
    const meta = toolkit?.metadata;
    if (meta && typeof meta === "object") {
      const systemPrompt = (meta as Record<string, unknown>).system_prompt;
      if (typeof systemPrompt === "string" && systemPrompt.trim().length > 0) {
        extra.push(systemPrompt.trim());
      }
      const instructions = (meta as Record<string, unknown>).instructions;
      if (Array.isArray(instructions)) {
        const parts = instructions
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim());
        if (parts.length > 0) {
          extra.push(parts.join("\n"));
        }
      }
    }
    extra.push(
      "Use the provided tools when helpful. Always attribute facts from web or file search using inline references (e.g. [1]).",
      "Return JSON matching the schema so the admin console can render your response.",
    );
    return [base, ...extra].join("\n\n");
  }

  private normaliseHistory(history: ChatHistoryMessage[]) {
    return history
      .map((item) => {
        const content = typeof item.text === "string" && item.text.trim().length > 0
          ? item.text.trim()
          : typeof item.payload?.text === "string" && item.payload.text.trim().length > 0
            ? item.payload.text.trim()
            : null;
        if (!content) return null;
        const mappedRole = item.role === "agent" ? "assistant" : item.role;
        if (mappedRole === "user" || mappedRole === "assistant") {
          return { role: mappedRole, content } as const;
        }
        if (mappedRole === "system") {
          return { role: "system" as const, content };
        }
        return null;
      })
      .filter((msg): msg is { role: "system" | "user" | "assistant"; content: string } => Boolean(msg));
  }

  private buildTools(toolkit: ToolkitConfig | null) {
    const tools: any[] = [];
    const include: string[] = [];

    if (toolkit?.web_search_enabled) {
      const entry: Record<string, unknown> = { type: "web_search" };
      if (Array.isArray(toolkit.web_search_allowed_domains) && toolkit.web_search_allowed_domains.length > 0) {
        entry.filters = { allowed_domains: toolkit.web_search_allowed_domains };
      }
      if (toolkit.web_search_user_location && typeof toolkit.web_search_user_location === "object") {
        entry.user_location = toolkit.web_search_user_location;
      }
      tools.push(entry);
      include.push("web_search_call.action.sources");
    }

    if (toolkit?.file_search_enabled && toolkit.file_vector_store_id) {
      const entry: Record<string, unknown> = {
        type: "file_search",
        vector_store_ids: [toolkit.file_vector_store_id],
      };
      if (typeof toolkit.file_search_max_results === "number") {
        entry.max_num_results = toolkit.file_search_max_results;
      }
      tools.push(entry);
    }

    if (toolkit?.image_generation_enabled) {
      const entry: Record<string, unknown> = { type: "image_generation" };
      if (toolkit.image_preset && typeof toolkit.image_preset === "object") {
        Object.assign(entry, toolkit.image_preset);
      }
      if (typeof toolkit.streaming_partial_images === "number") {
        const clamped = Math.min(Math.max(toolkit.streaming_partial_images, 1), 3);
        entry.partial_images = clamped;
      }
      tools.push(entry);
    }

    return { tools, include };
  }

  private buildToolChoice(toolkit: ToolkitConfig | null) {
    if (!toolkit?.allowed_tools || !Array.isArray(toolkit.allowed_tools) || toolkit.allowed_tools.length === 0) {
      return undefined;
    }
    return {
      type: "allowed_tools" as const,
      mode: "auto" as const,
      tools: toolkit.allowed_tools,
    };
  }

  private async buildRetrievalContext(toolkit: ToolkitConfig | null, query: string) {
    if (!toolkit?.retrieval_enabled || !toolkit.retrieval_vector_store_id) {
      return null;
    }
    try {
      const results = await this.client!.vector_stores.search({
        vector_store_id: toolkit.retrieval_vector_store_id,
        query,
        max_num_results: toolkit.retrieval_max_results ?? 5,
        rewrite_query: toolkit.retrieval_rewrite ?? true,
      });
      if (!results?.data || results.data.length === 0) {
        return null;
      }
      const formatted = results.data
        .map((item: any, index: number) => {
          const snippets = (item.content ?? [])
            .map((part: any) => {
              if (typeof part === "string") return part;
              if (typeof part?.text === "string") return part.text;
              if (typeof part?.text?.text === "string") return part.text.text;
              return "";
            })
            .filter((fragment: string) => fragment.trim().length > 0)
            .join("\n");
          const origin = item.filename ?? item.file_name ?? item.file_id ?? `result-${index + 1}`;
          const score = typeof item.score === "number" ? ` (score ${item.score.toFixed(2)})` : "";
          if (!snippets) return null;
          return `Source: ${origin}${score}\n${snippets}`;
        })
        .filter((block: string | null): block is string => Boolean(block))
        .join("\n\n");
      return formatted.length > 0 ? formatted : null;
    } catch (error) {
      this.logger.warn("chat.retrieval_failed", { error: this.formatError(error) });
      return null;
    }
  }

  private parseStructuredOutput(raw: string) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      this.logger.warn("chat.output_parse_failed", { error: this.formatError(error) });
      return null;
    }
  }

  private extractFallbackText(response: any) {
    for (const item of response.output ?? []) {
      if (item?.type === "message") {
        for (const part of item.content ?? []) {
          if (part?.type === "output_text" && typeof part.text === "string" && part.text.trim().length > 0) {
            return part.text.trim();
          }
        }
      }
    }
    return null;
  }

  private extractSuggestions(parsed: any) {
    if (!parsed || !Array.isArray(parsed.suggestions)) {
      return undefined;
    }
    const items = parsed.suggestions
      .filter((item: unknown): item is string => typeof item === "string")
      .map((item: string) => item.trim())
      .filter((item: string) => item.length > 0);
    return items.length > 0 ? items : undefined;
  }

  private extractToolkitSuggestions(toolkit: ToolkitConfig | null | undefined) {
    if (!toolkit || !Array.isArray(toolkit.suggestions)) {
      return undefined;
    }
    const items = toolkit.suggestions
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return items.length > 0 ? items : undefined;
  }

  private extractCitations(response: any) {
    const citations: unknown[] = [];
    for (const item of response.output ?? []) {
      if (item?.type === "message") {
        for (const part of item.content ?? []) {
          if (part?.type === "output_text" && Array.isArray(part.annotations)) {
            for (const annotation of part.annotations) {
              if (annotation && typeof annotation === "object") {
                citations.push(annotation);
              }
            }
          }
        }
      }
    }
    return citations.length > 0 ? citations : undefined;
  }

  private extractSources(response: any) {
    const sources: unknown[] = [];
    for (const item of response.output ?? []) {
      if (item?.type === "web_search_call" && item.action && typeof item.action === "object") {
        const list = (item.action as Record<string, unknown>).sources;
        if (Array.isArray(list)) {
          sources.push(...list);
        }
      }
    }
    return sources.length > 0 ? sources : undefined;
  }

  private extractToolCalls(response: any) {
    const calls: unknown[] = [];
    for (const item of response.output ?? []) {
      if (item && typeof item.type === "string" && item.type.endsWith("_call")) {
        const snapshot: Record<string, unknown> = {
          type: item.type,
          id: item.id,
          status: item.status,
        };
        if ("name" in item && typeof item.name === "string") {
          snapshot.name = item.name;
        }
        if ("call_id" in item && typeof item.call_id === "string") {
          snapshot.call_id = item.call_id;
        }
        if ("arguments" in item) {
          snapshot.arguments = item.arguments;
        }
        if ("input" in item) {
          snapshot.input = item.input;
        }
        if ("action" in item) {
          snapshot.action = item.action;
        }
        calls.push(snapshot);
      }
    }
    return calls.length > 0 ? calls : undefined;
  }

  private extractImages(response: any) {
    const images: Array<{ data: string; format?: string; revised_prompt?: string }> = [];
    for (const item of response.output ?? []) {
      if (item?.type === "image_generation_call" && item.result) {
        const data = typeof item.result === "string"
          ? item.result
          : typeof item.result?.data === "string"
            ? item.result.data
            : null;
        if (!data) continue;
        const image: { data: string; format?: string; revised_prompt?: string } = { data };
        if (typeof item.format === "string") {
          image.format = item.format;
        }
        if (typeof item.revised_prompt === "string") {
          image.revised_prompt = item.revised_prompt;
        }
        images.push(image);
      }
    }
    return images.length > 0 ? images : undefined;
  }

  private formatError(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
