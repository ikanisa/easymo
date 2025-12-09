/**
 * Gemini Vision API Client (Fallback Provider)
 * Used when OpenAI is unavailable
 */

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_VISION_MODEL") ?? "gemini-3-vision";

export interface GeminiVisionRequest {
  imageBase64: string;
  contentType: string;
  prompt: string;
}

export interface GeminiVisionResponse {
  raw: string;
  parsed: any;
}

export async function runGeminiVision(
  request: GeminiVisionRequest,
): Promise<GeminiVisionResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  // Gemini API uses different format
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: request.prompt },
            {
              inline_data: {
                mime_type: request.contentType,
                data: request.imageBase64,
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!raw) {
    throw new Error("Gemini response contained no content");
  }

  // Parse JSON
  let parsed;
  try {
    const cleaned = stripJsonFence(raw);
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    throw new Error(`Failed to parse Gemini JSON: ${error.message}`);
  }

  return { raw, parsed };
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1] : trimmed;
}

export function hasGeminiKey(): boolean {
  return Boolean(GEMINI_API_KEY);
}
