import { getOpenAIClient } from "./providers/openai-client";
import { toolHandlers } from "./tools/handlers";
import { toolRegistry } from "./tools/registry";

export interface AgentConfig {
  model?: string;
  systemPrompt?: string;
  maxIterations?: number;
  tools?: string[];
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export class AgentExecutor {
  private client = getOpenAIClient();
  private config: Required<AgentConfig>;

  constructor(config: AgentConfig = {}) {
    this.config = {
      model: config.model || "gpt-4o-mini",
      systemPrompt: config.systemPrompt || "You are a helpful AI assistant for EasyMO mobility platform.",
      maxIterations: config.maxIterations || 5,
      tools: config.tools || ["google_maps", "search_grounding", "database_query"],
    };
  }

  async execute(userMessage: string): Promise<{
    response: string;
    toolCalls: any[];
    iterations: number;
  }> {
    const messages: AgentMessage[] = [
      { role: "system", content: this.config.systemPrompt },
      { role: "user", content: userMessage },
    ];

    const toolCalls: any[] = [];
    let iterations = 0;

    while (iterations < this.config.maxIterations) {
      iterations++;

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages as any,
        tools: toolRegistry.getDefinitions() as any,
        tool_choice: "auto",
      });

      const choice = response.choices[0];
      const message = choice.message;

      // Add assistant message
      messages.push({
        role: "assistant",
        content: message.content || "",
        tool_calls: message.tool_calls,
      });

      // Check if we need to call tools
      if (!message.tool_calls || message.tool_calls.length === 0) {
        return {
          response: message.content || "",
          toolCalls,
          iterations,
        };
      }

      // Execute tool calls
      for (const toolCall of message.tool_calls) {
        const tool = JSON.parse(toolCall.function.arguments);
        tool.name = toolCall.function.name;

        // Validate and execute
        const validatedTool = toolRegistry.validate(tool);
        const result = await toolHandlers.execute(validatedTool);

        toolCalls.push({
          tool: toolCall.function.name,
          arguments: tool,
          result,
        });

        // Add tool result to messages
        messages.push({
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        });
      }
    }

    // Max iterations reached
    return {
      response: "Maximum iterations reached. Please try a simpler request.",
      toolCalls,
      iterations,
    };
  }

  async executeWithStreaming(
    userMessage: string,
    onToken?: (token: string) => void,
    onToolCall?: (toolCall: any) => void
  ): Promise<{
    response: string;
    toolCalls: any[];
    iterations: number;
  }> {
    // Simplified streaming version
    const result = await this.execute(userMessage);

    if (onToken) {
      for (const char of result.response) {
        onToken(char);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    if (onToolCall && result.toolCalls.length > 0) {
      result.toolCalls.forEach((call) => onToolCall(call));
    }

    return result;
  }
}

export async function runAgent(
  userMessage: string,
  config?: AgentConfig
): Promise<string> {
  const agent = new AgentExecutor(config);
  const result = await agent.execute(userMessage);
  return result.response;
}

export async function runAgentWithTools(
  userMessage: string,
  systemPrompt: string,
  enabledTools: string[]
): Promise<{
  response: string;
  toolCalls: any[];
}> {
  const agent = new AgentExecutor({
    systemPrompt,
    tools: enabledTools,
  });

  const result = await agent.execute(userMessage);

  return {
    response: result.response,
    toolCalls: result.toolCalls,
  };
}
