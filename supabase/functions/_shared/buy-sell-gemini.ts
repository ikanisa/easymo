/**
 * Gemini AI Integration for Buy & Sell Agent
 * 
 * Provides:
 * - Intent extraction with structured JSON schema
 * - Multimodal content generation (text + audio/image)
 * - Audio transcription
 * - Response generation with retry logic
 */

import { GenerativeModel,GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";

import { ExtractedIntent } from "./buy-sell-types.ts";
import { logStructuredEvent } from "./observability.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("API_KEY");

if (!GEMINI_API_KEY) {
  console.warn("⚠️ GEMINI_API_KEY not set. Gemini features will not work.");
}

// Initialize Gemini client
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Intent extraction schema for structured output
export const INTENT_SCHEMA = {
  type: "object",
  properties: {
    need_type: {
      type: "string",
      enum: ["buy", "sell", "service", "unknown"],
      description: "Type of user need: buying, selling, or requesting a service",
    },
    query: {
      type: "string",
      description: "Normalized query describing what the user needs",
    },
    specs: {
      type: "string",
      description: "Additional specifications or requirements",
    },
    budget: {
      type: "string",
      description: "Budget range or price expectation",
    },
    urgency: {
      type: "string",
      enum: ["immediate", "soon", "flexible"],
      description: "How urgent the need is",
    },
    confidence: {
      type: "number",
      description: "Confidence score from 0 to 1",
    },
  },
  required: ["need_type", "query"],
};

/**
 * System instruction for intent extraction
 */
const INTENT_EXTRACTION_PROMPT = `You are an AI assistant helping users find products and services in East Africa.

Your task is to extract structured intent from user messages. Analyze the message and determine:

1. **need_type**: Is the user trying to "buy" something, "sell" something, request a "service", or is it "unknown"?
2. **query**: What specifically are they looking for? (normalize and clarify)
3. **specs**: Any specific requirements, brand preferences, conditions, quantities?
4. **budget**: Mentioned or implied price range?
5. **urgency**: How soon do they need it? (immediate/soon/flexible)
6. **confidence**: How confident are you in this interpretation? (0.0 to 1.0)

Examples:
- "I need a laptop for programming" → buy, laptop for programming, specs: good for coding, urgency: flexible
- "Looking for 2 bedroom apartment in Kigali urgent" → buy, 2 bedroom apartment, location: Kigali, urgency: immediate
- "Anyone selling a motorbike?" → buy, motorbike, urgency: flexible
- "I have a fridge to sell, good condition" → sell, fridge, specs: good condition, urgency: flexible

Be concise and extract only the essential information.`;

/**
 * Extract intent from text using Gemini with structured output
 */
export async function extractIntent(
  text: string,
  audioTranscript?: string,
  correlationId?: string
): Promise<ExtractedIntent | null> {
  if (!genAI) {
    await logStructuredEvent("GEMINI_NOT_CONFIGURED", { correlationId });
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", // Fast intent extraction for buy & sell
      generationConfig: {
        temperature: 0.3,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseSchema: INTENT_SCHEMA,
      },
    });

    const input = audioTranscript
      ? `Text: ${text}\nAudio Transcript: ${audioTranscript}`
      : text;

    const result = await model.generateContent([
      { text: INTENT_EXTRACTION_PROMPT },
      { text: `User message: ${input}` },
    ]);

    const response = result.response;
    const intentText = response.text();

    await logStructuredEvent("INTENT_EXTRACTED", {
      input: text.substring(0, 100),
      hasAudio: !!audioTranscript,
      correlationId,
    });

    return JSON.parse(intentText) as ExtractedIntent;
  } catch (error) {
    await logStructuredEvent("INTENT_EXTRACTION_FAILED", {
      error: error.message,
      correlationId,
    });
    return null;
  }
}

/**
 * Transcribe audio using Gemini
 */
export async function transcribeAudio(
  audioData: Uint8Array,
  mimeType: string,
  correlationId?: string
): Promise<string | null> {
  if (!genAI) {
    await logStructuredEvent("GEMINI_NOT_CONFIGURED", { correlationId });
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", // Fast transcription
    });

    const result = await model.generateContent([
      {
        text: "Transcribe this audio message accurately. Return only the transcription without any additional text.",
      },
      {
        inlineData: {
          data: btoa(String.fromCharCode(...audioData)),
          mimeType,
        },
      },
    ]);

    const transcript = result.response.text();

    await logStructuredEvent("AUDIO_TRANSCRIBED", {
      transcriptLength: transcript.length,
      correlationId,
    });

    return transcript;
  } catch (error) {
    await logStructuredEvent("AUDIO_TRANSCRIPTION_FAILED", {
      error: error.message,
      correlationId,
    });
    return null;
  }
}

/**
 * Generate response using Gemini with retry logic
 */
export async function generateResponse(
  prompt: string,
  context?: Record<string, unknown>,
  correlationId?: string,
  maxRetries = 2
): Promise<string | null> {
  if (!genAI) {
    await logStructuredEvent("GEMINI_NOT_CONFIGURED", { correlationId });
    return null;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash", // Fast transcription
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048,
        },
      });

      const contextStr = context ? `\n\nContext: ${JSON.stringify(context)}` : "";
      const result = await model.generateContent(prompt + contextStr);
      const response = result.response.text();

      await logStructuredEvent("RESPONSE_GENERATED", {
        promptLength: prompt.length,
        responseLength: response.length,
        attempt,
        correlationId,
      });

      return response;
    } catch (error) {
      lastError = error;
      await logStructuredEvent("RESPONSE_GENERATION_FAILED", {
        error: error.message,
        attempt,
        correlationId,
      });

      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  await logStructuredEvent("RESPONSE_GENERATION_EXHAUSTED", {
    error: lastError?.message,
    correlationId,
  });

  return null;
}

/**
 * Analyze image with Gemini Vision
 */
export async function analyzeImage(
  imageData: Uint8Array,
  mimeType: string,
  prompt: string,
  correlationId?: string
): Promise<string | null> {
  if (!genAI) {
    await logStructuredEvent("GEMINI_NOT_CONFIGURED", { correlationId });
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", // Fast transcription
    });

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          data: btoa(String.fromCharCode(...imageData)),
          mimeType,
        },
      },
    ]);

    const analysis = result.response.text();

    await logStructuredEvent("IMAGE_ANALYZED", {
      analysisLength: analysis.length,
      correlationId,
    });

    return analysis;
  } catch (error) {
    await logStructuredEvent("IMAGE_ANALYSIS_FAILED", {
      error: error.message,
      correlationId,
    });
    return null;
  }
}

/**
 * Execute sourcing with Google Search and Maps grounding
 */
export async function executeSourcing(
  intent: ExtractedIntent,
  userLocation?: { lat: number; lng: number },
  correlationId?: string
): Promise<{ candidates: unknown[]; summary: string } | null> {
  if (!genAI) {
    await logStructuredEvent("GEMINI_NOT_CONFIGURED", { correlationId });
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash", // Complex reasoning for vendor search with tools
      tools: [
        { googleSearch: {} },
        ...(userLocation ? [{ googleMaps: {} }] : []),
      ],
    });

    const locationContext = userLocation
      ? `User location: ${userLocation.lat}, ${userLocation.lng}\n`
      : "";

    const prompt = `${locationContext}Find businesses or vendors for the following need:
- Type: ${intent.need_type}
- Query: ${intent.query}
- Specs: ${intent.specs || "none"}
- Budget: ${intent.budget || "not specified"}

Use Google Search and ${userLocation ? "Google Maps to find nearby options" : "to find options"}.
Return a list of candidate businesses with names, addresses, and phone numbers if available.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    await logStructuredEvent("SOURCING_EXECUTED", {
      intent: intent.query,
      hasLocation: !!userLocation,
      correlationId,
    });

    return {
      candidates: [], // Will be extracted from response
      summary: response,
    };
  } catch (error) {
    await logStructuredEvent("SOURCING_FAILED", {
      error: error.message,
      correlationId,
    });
    return null;
  }
}
