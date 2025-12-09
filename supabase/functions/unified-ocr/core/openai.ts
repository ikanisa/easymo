/**
 * Unified OpenAI Vision API Client
 * Supports GPT-4o vision models for OCR extraction
 */

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
const OPENAI_MODEL = Deno.env.get("OPENAI_VISION_MODEL") ?? "gpt-4o";

export interface OpenAIVisionRequest {
  imageBase64: string;
  contentType: string;
  systemPrompt: string;
  userPrompt: string;
  schema?: any; // JSON schema for structured output
  maxTokens?: number;
  temperature?: number;
}

export interface OpenAIVisionResponse {
  raw: string;
  parsed: any;
}

export async function runOpenAIVision(
  request: OpenAIVisionRequest,
): Promise<OpenAIVisionResponse> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const requestBody: any = {
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: request.systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: request.userPrompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${request.contentType};base64,${request.imageBase64}`,
            },
          },
        ],
      },
    ],
    max_tokens: request.maxTokens ?? 1000,
    temperature: request.temperature ?? 0.1,
  };

  // Use json_object mode instead of json_schema for better compatibility
  if (request.schema) {
    requestBody.response_format = {
      type: "json_object"
    };
    
    // Add schema description to the user prompt
    requestBody.messages[1].content[0].text = 
      `${request.userPrompt}\n\nReturn a valid JSON object matching this structure:\n${JSON.stringify(request.schema, null, 2)}`;
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  
  // Log the full response for debugging
  console.log("OpenAI full response:", JSON.stringify(json, null, 2));
  
  const raw = extractContent(json);

  if (!raw) {
    console.error("OpenAI response structure:", json);
    throw new Error("OpenAI response contained no content");
  }

  console.log("Extracted raw content:", raw);

  // Parse JSON from response
  let parsed;
  try {
    const cleaned = stripJsonFence(raw);
    console.log("Cleaned JSON:", cleaned);
    parsed = JSON.parse(cleaned);
  } catch (error) {
    console.error("JSON parse error. Raw content was:", raw);
    throw new Error(`Failed to parse OpenAI JSON: ${error.message}`);
  }

  console.log("Successfully parsed:", JSON.stringify(parsed, null, 2));
  return { raw, parsed };
}

/**
 * Extract content from OpenAI response
 * Handles multiple response formats
 */
function extractContent(json: any): string | null {
  // Try standard chat completion format
  if (json.choices?.[0]?.message?.content) {
    return json.choices[0].message.content;
  }

  // Try output_text format
  if (typeof json.output_text === "string" && json.output_text.trim()) {
    return json.output_text;
  }

  // Try output array format
  if (Array.isArray(json.output) && json.output[0]?.content) {
    return json.output[0].content;
  }

  return null;
}

/**
 * Strip markdown JSON fences from response
 * Handles: ```json...``` or ```...```
 */
function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    return fenceMatch[1];
  }

  return trimmed;
}

export function hasOpenAIKey(): boolean {
  return Boolean(OPENAI_API_KEY);
}
