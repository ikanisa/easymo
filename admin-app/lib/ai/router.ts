import pRetry from "p-retry";

import { GEMINI_MODELS,getGeminiClient } from "./providers/gemini-client";
import { getOpenAIClient } from "./providers/openai-client";

type Provider = "openai" | "gemini";

interface ChatMessage {
  role: string;
  content: string;
}

interface RouteRequest {
  messages: ChatMessage[];
  preferredProvider?: Provider;
  maxCost?: "low" | "medium" | "high";
  requiresVision?: boolean;
  requiresTools?: boolean;
}

interface ChatResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export async function routeChatRequest(request: RouteRequest): Promise<ChatResponse> {
  const provider = selectProvider(request);

  return pRetry(
    async () => {
      if (provider === "openai") {
        return executeOpenAI(request);
      } else {
        return executeGemini(request);
      }
    },
    {
      retries: 2,
      onFailedAttempt: async (error) => {
        console.warn(`Provider ${provider} failed, attempting fallback`, error);
        // Fallback to alternative provider
        if (provider === "openai") {
          return executeGemini(request);
        } else {
          return executeOpenAI(request);
        }
      },
    }
  );
}

function selectProvider(request: RouteRequest): Provider {
  if (request.preferredProvider) {
    return request.preferredProvider;
  }

  // Cost-based routing
  if (request.maxCost === "low") {
    return "gemini"; // Flash models are cheaper
  }

  // Default to OpenAI for compatibility
  return "openai";
}

async function executeOpenAI(request: RouteRequest): Promise<ChatResponse> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: request.messages as Array<{ role: "system" | "user" | "assistant"; content: string }>,
  });

  return {
    choices: response.choices.map((choice) => ({
      message: {
        role: choice.message.role,
        content: choice.message.content,
      },
      finish_reason: choice.finish_reason,
    })),
    usage: response.usage
      ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        }
      : undefined,
  };
}

async function executeGemini(request: RouteRequest): Promise<ChatResponse> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: GEMINI_MODELS.FLASH,
  });

  // Convert messages to Gemini format
  const geminiMessages = request.messages.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  // Use the last message as the prompt
  const prompt = geminiMessages[geminiMessages.length - 1].parts[0].text;

  // Start chat with history (all but last message)
  const chat = model.startChat({
    history: geminiMessages.slice(0, -1),
  });

  const result = await chat.sendMessage(prompt);
  const response = result.response;

  return {
    choices: [
      {
        message: {
          role: "assistant",
          content: response.text(),
        },
        finish_reason: "stop",
      },
    ],
  };
}
