import WebSocket from "ws";
import { Logger } from "pino";
import { childLogger } from "@easymo/commons";
import { PersonaTool } from "./personas.js";
import { getSupabaseClient } from "./supabase.js";

interface ToolCall {
  call_id: string;
  name: string;
  arguments: unknown;
}

export interface RealtimeClientOptions {
  url: string;
  apiKey: string;
  model: string;
  system: string;
  tools: Array<{
    type: string;
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  logger?: Logger;
}

export class RealtimeClient {
  private ws!: WebSocket;
  private log: Logger;
  private opts: RealtimeClientOptions;
  private currentPersona: string = "waiter";

  constructor(opts: RealtimeClientOptions) {
    this.opts = opts;
    this.log = opts.logger ?? childLogger({ service: "ai-realtime" });
  }

  async connect(): Promise<void> {
    const { url, apiKey, model } = this.opts;
    const wsUrl = `${url}?model=${encodeURIComponent(model)}`;
    
    this.log.info({ model }, "Connecting to OpenAI Realtime");
    
    this.ws = new WebSocket(wsUrl, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    this.ws.on("message", (buf) => this.onMessage(buf));
    this.ws.on("error", (err) => {
      this.log.error({ err: err.message }, "WebSocket error");
    });
    this.ws.on("close", (code, reason) => {
      this.log.warn({ code, reason: reason.toString() }, "WebSocket closed");
    });

    await new Promise<void>((resolve, reject) => {
      this.ws.once("open", async () => {
        try {
          await this.bootstrapSession();
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      this.ws.once("error", reject);
    });

    this.log.info("Connected to OpenAI Realtime");
  }

  private send(event: Record<string, unknown>): void {
    const payload = JSON.stringify(event);
    this.log.debug({ event: event.type }, "→ openai");
    this.ws.send(payload);
  }

  private async bootstrapSession(): Promise<void> {
    this.send({
      type: "session.update",
      session: {
        instructions: this.opts.system,
        modalities: ["text"],
        turn_detection: { type: "server_vad" }
      }
    });
    this.send({ type: "tools.update", tools: this.opts.tools });
  }

  switchPersona(persona: string, system: string, tools: Array<{
    type: string;
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>): void {
    this.currentPersona = persona;
    this.opts.system = system;
    this.opts.tools = tools;
    
    this.log.info({ persona }, "Switching persona");
    
    this.send({ type: "session.update", session: { instructions: system } });
    this.send({ type: "tools.update", tools });
  }

  getActivePersona(): string {
    return this.currentPersona;
  }

  async say(text: string): Promise<void> {
    this.log.info({ text: text.substring(0, 50) }, "Sending user message");
    
    this.send({
      type: "response.create",
      response: {
        modalities: ["text"],
        input: [{ role: "user", content: [{ type: "input_text", text }]}],
        tool_choice: "auto"
      }
    });
  }

  private onMessage(raw: WebSocket.RawData): void {
    try {
      const msg = JSON.parse(raw.toString());
      this.log.debug({ type: msg.type }, "← openai");

      if (msg.type === "response.output_text.delta") {
        process.stdout.write(msg.delta);
      }

      if (msg.type === "response.output_text.done") {
        process.stdout.write("\n");
        this.log.info({ text: msg.text?.substring(0, 100) }, "Response completed");
      }

      if (msg.type === "response.tool_call") {
        this.handleToolCall({
          call_id: msg.call_id,
          name: msg.name,
          arguments: msg.arguments
        }).catch(err => {
          this.log.error({ err: err.message, tool: msg.name }, "Tool call failed");
        });
      }

      if (msg.type === "error") {
        this.log.error({ error: msg }, "OpenAI Realtime error");
      }
    } catch (e) {
      this.log.error({ err: (e as Error).message }, "Failed to parse WebSocket message");
    }
  }

  private async handleToolCall(call: ToolCall): Promise<void> {
    const { call_id, name, arguments: args } = call;
    
    this.log.info({ tool: name, args }, "Executing tool");
    
    let output: unknown;
    try {
      const supabase = getSupabaseClient();
      
      switch (name) {
        case "lookup_menu": {
          const query = (args as any).query ?? "";
          const { data, error } = await supabase
            .from("menu_items")
            .select("id,name,price,description,image_url")
            .ilike("name", `%${query}%`)
            .limit(5);
          
          if (error) {
            this.log.error({ error: error.message }, "lookup_menu failed");
            output = { error: error.message };
          } else {
            output = { items: data ?? [] };
          }
          break;
        }

        case "recommend_pairing": {
          const itemId = (args as any).itemId ?? "";
          const { data, error } = await supabase
            .from("pairings")
            .select("text")
            .eq("item_id", itemId)
            .limit(1)
            .single();
          
          if (error) {
            this.log.warn({ error: error.message }, "recommend_pairing failed");
            output = { upsell: "No pairing suggestions available at this time." };
          } else {
            output = { upsell: data?.text ?? "No pairing suggestions available." };
          }
          break;
        }

        case "fetch_financials": {
          const period = (args as any).period ?? "";
          // Stub implementation - replace with actual GL query
          const { data, error } = await supabase
            .from("gl_lines")
            .select("account,amount,currency")
            .gte("date", period)
            .limit(100);
          
          if (error) {
            this.log.error({ error: error.message }, "fetch_financials failed");
            output = { error: error.message, period };
          } else {
            // Aggregate into P&L summary
            const revenue = (data ?? []).filter(l => l.account?.startsWith('4')).reduce((sum, l) => sum + (l.amount ?? 0), 0);
            const cogs = (data ?? []).filter(l => l.account?.startsWith('5')).reduce((sum, l) => sum + (l.amount ?? 0), 0);
            const ebitda = revenue - cogs;
            output = { period, pnl: { revenue, cogs, ebitda } };
          }
          break;
        }

        case "check_tax_rule": {
          const jurisdiction = (args as any).jurisdiction ?? "";
          const topic = (args as any).topic ?? "";
          
          const { data, error } = await supabase
            .from("tax_rules")
            .select("rule,note")
            .eq("jurisdiction", jurisdiction)
            .ilike("topic", `%${topic}%`)
            .limit(1)
            .single();
          
          if (error) {
            this.log.warn({ error: error.message }, "check_tax_rule failed");
            output = { rule: "Not found", note: "Please consult a tax professional." };
          } else {
            output = { rule: data?.rule ?? "Not found", note: data?.note ?? "" };
          }
          break;
        }

        default:
          this.log.warn({ tool: name }, "Unknown tool");
          output = { error: `Unknown tool: ${name}` };
      }
    } catch (err) {
      this.log.error({ err: (err as Error).message, tool: name }, "Tool execution error");
      output = { error: String(err) };
    }

    this.send({ type: "tool.output", call_id, output });
    this.log.info({ tool: name, output }, "Tool result sent");
  }

  disconnect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
      this.log.info("Disconnected from OpenAI Realtime");
    }
  }
}

export function buildToolsSpec(tools: PersonaTool[]): Array<{
  type: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return tools.map(t => ({
    type: "function",
    name: t.name,
    description: t.description,
    parameters: t.schema
  }));
}
