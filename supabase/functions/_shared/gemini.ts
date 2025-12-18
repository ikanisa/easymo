/**
 * Gemini AI Integration Module
 * 
 * Provides robust AI-powered capabilities for the Buy & Sell agent:
 * - Intent extraction with structured JSON schema
 * - Content generation with retry logic
 * - Multimodal support (text, audio, images)
 * - Google Search and Maps grounding
 * - TTS audio generation
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { logStructuredEvent } from "./observability.ts";

// Gemini API configuration
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("API_KEY");
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// System instructions for Kwizera persona
// Kwizera (meaning "Hope" in Kinyarwanda) - The Local Fixer archetype
export const SYSTEM_INSTRUCTION_INTENT = `You are Kwizera, easyMO's AI sourcing assistant for Rwanda and East Africa.

Your role is to understand what users need when they message about products or services.

PERSONA:
- Name: Kwizera (meaning "Hope" in Kinyarwanda)
- Spirit: Embodies "Ubuntu" - helpful, communal, respectful
- Languages: English, French, Swahili, Kinyarwanda

Extract structured information from user messages:
- What product/service they need (fix typos like "Raph 4" → "RAV4")
- How much they need (quantity)
- When they need it (urgency)
- Where they are located
- Any special requirements (brand, condition)

For medical items: ONLY extract logistics (drug name, strength, quantity). NEVER give medical advice.

Be concise, friendly, and culturally aware. Use simple language.`;

export const SYSTEM_INSTRUCTION_RESPONSE = `You are Kwizera, easyMO's AI sourcing assistant for Rwanda.

Generate clear, concise responses to help users find products and services.

PERSONA:
- Embodies "Ubuntu" - helpful, communal, respectful
- Local knowledge: knows "duka" (kiosk), "bodaboda" (motorbike taxi)
- Tone: Professional but warm. Concise (WhatsApp-optimized).

Guidelines:
- Be friendly and professional
- Use simple language
- Ask clarifying questions when needed
- Confirm important details
- NEVER hallucinate availability - say you'll check with vendors
- For medical requests, add: "Please follow your doctor's prescription."

GEO-BLOCKING: If user from Kenya, Nigeria, Uganda, or South Africa - politely inform service not yet available in their region.`;

// Intent extraction schema
export const INTENT_SCHEMA = {
  type: "object",
  properties: {
    need_type: {
      type: "string",
      enum: ["product", "service", "medicine", "general"],
      description: "Type of need the user has"
    },
    description: {
      type: "string",
      description: "What the user needs (product name, service type, etc.)"
    },
    quantity: {
      type: "string",
      description: "How much they need (if specified)"
    },
    urgency: {
      type: "string",
      enum: ["urgent", "today", "this_week", "flexible"],
      description: "When they need it"
    },
    location: {
      type: "string",
      description: "Where they are or want to search"
    },
    special_requirements: {
      type: "array",
      items: { type: "string" },
      description: "Any special requirements or preferences"
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Confidence level in the extraction (0-1)"
    }
  },
  required: ["need_type", "description", "confidence"]
};

// Media encoding helpers
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: mimeType });
}

export interface GenerateContentOptions {
  model?: string;
  systemInstruction?: string;
  tools?: any[];
  toolConfig?: any;
  thinkingBudget?: number; // For Gemini 3 Pro models (32k tokens)
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    responseSchema?: any;
  };
  maxRetries?: number;
  correlationId?: string;
}

export interface GenerateContentResult {
  text?: string;
  functionCalls?: Array<{
    name: string;
    args: Record<string, any>;
  }>;
  finishReason?: string;
  error?: string;
}

/**
 * Generate content using Gemini AI with retry logic
 */
export async function generateContent(
  prompt: string | any[],
  options: GenerateContentOptions = {}
): Promise<GenerateContentResult> {
  const {
    model = "gemini-2.5-flash", // Default to 2.5 Flash for general tasks (best balance of speed/cost)
    systemInstruction,
    tools,
    toolConfig,
    thinkingBudget,
    generationConfig,
    maxRetries = 3,
    correlationId
  } = options;

  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY not configured");
      }

      // Build request payload
      const payload: any = {
        contents: Array.isArray(prompt)
          ? [{ role: "user", parts: prompt }]
          : [{ role: "user", parts: [{ text: prompt }] }],
      };

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      if (tools && tools.length > 0) {
        payload.tools = tools;
      }

      if (toolConfig) {
        payload.toolConfig = toolConfig;
      }

      if (generationConfig) {
        payload.generationConfig = generationConfig;
      }

      // Add thinking budget for Gemini 3 Pro models
      if (thinkingBudget && thinkingBudget > 0) {
        if (!payload.generationConfig) {
          payload.generationConfig = {};
        }
        payload.generationConfig.thinkingConfig = {
          thinkingBudget: thinkingBudget
        };
      }

      // Make API request
      const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Gemini API error (${response.status}): ${
            errorData.error?.message || response.statusText
          }`
        );
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      // Log successful generation
      await logStructuredEvent("GEMINI_CONTENT_GENERATED", {
        model,
        duration,
        attempt: attempt + 1,
        correlationId,
        hasTools: !!tools,
        hasSchema: !!generationConfig?.responseSchema
      });

      // Parse response
      const candidate = data.candidates?.[0];
      if (!candidate) {
        throw new Error("No candidate in response");
      }

      const content = candidate.content;
      const finishReason = candidate.finishReason;

      // Check for function calls
      const functionCalls = content.parts
        ?.filter((part: any) => part.functionCall)
        .map((part: any) => ({
          name: part.functionCall.name,
          args: part.functionCall.args
        }));

      // Extract text (may be present even with function calls)
      const text = content.parts
        ?.filter((part: any) => part.text)
        ?.map((part: any) => part.text)
        .filter(Boolean)
        .join("") || undefined;

      // Return both if present
      if (functionCalls && functionCalls.length > 0) {
        return { functionCalls, text, finishReason };
      }

      return { text: text || "", finishReason };

    } catch (error) {
      lastError = error as Error;
      
      await logStructuredEvent("GEMINI_GENERATION_ERROR", {
        error: lastError.message,
        attempt: attempt + 1,
        model,
        correlationId,
        willRetry: attempt < maxRetries - 1
      }, "error");

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  return {
    error: lastError?.message || "Failed to generate content after retries",
    finishReason: "ERROR"
  };
}

/**
 * Generate audio using Gemini TTS
 */
export async function generateAudio(
  text: string,
  voice: string = "Aoede",
  correlationId?: string
): Promise<Blob | null> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const model = "gemini-2.5-flash"; // Fast audio transcription
    const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text }]
        }
      ],
      generationConfig: {
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice
            }
          }
        }
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Audio generation failed: ${response.status}`);
    }

    const data = await response.json();
    const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;

    if (!audioData) {
      throw new Error("No audio data in response");
    }

    await logStructuredEvent("GEMINI_AUDIO_GENERATED", {
      voice,
      textLength: text.length,
      correlationId
    });

    // Convert base64 to blob
    return base64ToBlob(audioData.data, audioData.mimeType);

  } catch (error) {
    await logStructuredEvent("GEMINI_AUDIO_ERROR", {
      error: (error as Error).message,
      correlationId
    }, "error");
    return null;
  }
}

/**
 * Extract intent from user message using structured schema
 */
export async function extractIntent(
  message: string,
  context?: Record<string, any>,
  correlationId?: string
): Promise<any> {
  const contextText = context
    ? `\n\nContext: ${JSON.stringify(context)}`
    : "";

  const result = await generateContent(
    `Extract the user's intent from this message:\n\n"${message}"${contextText}`,
    {
      model: "gemini-2.5-flash", // Fast intent extraction
      systemInstruction: SYSTEM_INSTRUCTION_INTENT,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema: INTENT_SCHEMA
      },
      correlationId
    }
  );

  if (result.error || !result.text) {
    throw new Error(result.error || "Failed to extract intent");
  }

  try {
    return JSON.parse(result.text);
  } catch (error) {
    throw new Error(`Invalid JSON response: ${result.text}`);
  }
}
