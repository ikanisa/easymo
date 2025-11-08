// OpenAI Service with Assistants API v2, Realtime, and Vision support
import OpenAI from "npm:openai@^4.24.0";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

export interface AssistantConfig {
  name: string;
  instructions: string;
  model?: string;
  tools?: OpenAI.Beta.Assistants.AssistantTool[];
  fileSearch?: boolean;
  codeInterpreter?: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Create or get existing assistant
export async function getOrCreateAssistant(
  config: AssistantConfig,
): Promise<OpenAI.Beta.Assistants.Assistant> {
  const assistantKey = `assistant_${config.name.toLowerCase().replace(/\s+/g, "_")}`;
  
  // Try to get from environment or cache
  const existingId = Deno.env.get(assistantKey);
  
  if (existingId) {
    try {
      const assistant = await openai.beta.assistants.retrieve(existingId);
      return assistant;
    } catch (error) {
      console.log(`Assistant ${existingId} not found, creating new one`);
    }
  }

  // Create new assistant
  const tools: OpenAI.Beta.Assistants.AssistantTool[] = config.tools || [];
  
  if (config.fileSearch) {
    tools.push({ type: "file_search" });
  }
  
  if (config.codeInterpreter) {
    tools.push({ type: "code_interpreter" });
  }

  const assistant = await openai.beta.assistants.create({
    name: config.name,
    instructions: config.instructions,
    model: config.model || "gpt-4-turbo-preview",
    tools,
  });

  console.log(`Created assistant: ${assistant.id}`);
  return assistant;
}

// Run assistant with streaming
export async function runAssistantWithStreaming(
  assistantId: string,
  threadId: string,
  message: string,
  onUpdate: (delta: string) => void,
  onComplete: (response: string) => void,
  onToolCall?: (toolCall: any) => Promise<any>,
) {
  // Add message to thread
  await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: message,
  });

  // Run with streaming
  const stream = await openai.beta.threads.runs.create(threadId, {
    assistant_id: assistantId,
    stream: true,
  });

  let fullResponse = "";

  for await (const event of stream) {
    switch (event.event) {
      case "thread.message.delta":
        if (event.data.delta.content?.[0]?.text?.value) {
          const delta = event.data.delta.content[0].text.value;
          fullResponse += delta;
          onUpdate(delta);
        }
        break;

      case "thread.run.requires_action":
        if (onToolCall && event.data.required_action?.submit_tool_outputs) {
          const toolCalls = event.data.required_action.submit_tool_outputs.tool_calls;
          const toolOutputs = [];

          for (const toolCall of toolCalls) {
            const result = await onToolCall(toolCall);
            toolOutputs.push({
              tool_call_id: toolCall.id,
              output: JSON.stringify(result),
            });
          }

          // Submit tool outputs
          await openai.beta.threads.runs.submitToolOutputs(
            threadId,
            event.data.id,
            { tool_outputs: toolOutputs },
          );
        }
        break;

      case "thread.run.completed":
        onComplete(fullResponse);
        break;

      case "thread.run.failed":
        throw new Error(`Run failed: ${event.data.last_error?.message}`);
    }
  }
}

// Create thread
export async function createThread(
  initialMessages?: ChatMessage[],
): Promise<string> {
  const messages = initialMessages?.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const thread = await openai.beta.threads.create({
    messages,
  });

  return thread.id;
}

// Analyze image with GPT-4 Vision
export async function analyzeImage(
  imageUrl: string,
  prompt: string,
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: 1000,
  });

  return response.choices[0].message.content || "";
}

// Generate embeddings for semantic search
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
}

// Chat completion (for simple queries)
export async function chatCompletion(
  messages: ChatMessage[],
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[],
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  return await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    tools,
    tool_choice: tools ? "auto" : undefined,
  });
}

// Function calling handler
export async function executeFunctionCall(
  functionName: string,
  functionArgs: string,
  handlers: Record<string, (args: any) => Promise<any>>,
): Promise<any> {
  const handler = handlers[functionName];
  
  if (!handler) {
    throw new Error(`Unknown function: ${functionName}`);
  }

  const args = JSON.parse(functionArgs);
  return await handler(args);
}

// Web search function tool definition
export const WEB_SEARCH_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "web_search",
    description: "Search the web for current information",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
        num_results: {
          type: "integer",
          description: "Number of results to return",
          default: 5,
        },
      },
      required: ["query"],
    },
  },
};

// Location search tool definition
export const LOCATION_SEARCH_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "location_search",
    description: "Search for places or services near a location",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What to search for",
        },
        latitude: { type: "number" },
        longitude: { type: "number" },
        radius_km: {
          type: "integer",
          description: "Search radius in kilometers",
          default: 5,
        },
      },
      required: ["query", "latitude", "longitude"],
    },
  },
};

// Database query tool definition
export const DATABASE_QUERY_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "database_query",
    description: "Query the application database",
    parameters: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Database table name",
        },
        operation: {
          type: "string",
          enum: ["select", "count", "aggregate"],
        },
        filters: {
          type: "object",
          description: "Query filters",
        },
      },
      required: ["table", "operation"],
    },
  },
};

export default openai;
