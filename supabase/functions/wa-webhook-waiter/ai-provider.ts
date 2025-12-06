/**
 * Dual-Provider AI Integration
 * 
 * GROUND_RULES Compliance:
 * - Primary: OpenAI GPT-5 (conversation, reasoning)
 * - Fallover: Google Gemini-3 (vision, OCR, document parsing)
 * 
 * Auto-failover: If primary fails, retry with backup
 */

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AIResponse {
  message: string;
  action: "none" | "add_to_cart" | "remove_from_cart" | "show_cart" | "checkout" | "set_table";
  items?: Array<{ id?: string; name: string; quantity: number }>;
  table_number?: string;
}

/**
 * Call AI with automatic failover
 * Primary: GPT-5 → Fallback: Gemini-3
 */
export async function callAI(
  systemPrompt: string,
  messages: AIMessage[]
): Promise<AIResponse> {
  // Try GPT-5 first (primary provider)
  try {
    return await callOpenAI(systemPrompt, messages);
  } catch (error) {
    console.warn("GPT-5 failed, falling back to Gemini-3:", error);
    
    // Fallback to Gemini-3
    try {
      return await callGemini(systemPrompt, messages);
    } catch (fallbackError) {
      console.error("Both AI providers failed:", fallbackError);
      throw new Error("AI service unavailable");
    }
  }
}

/**
 * Call OpenAI GPT-5 (Primary)
 * For conversation, reasoning, intent classification
 */
async function callOpenAI(
  systemPrompt: string,
  messages: AIMessage[]
): Promise<AIResponse> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5", // README mandatory model
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-10), // Last 10 messages for context
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content in OpenAI response");
  }

  return JSON.parse(content);
}

/**
 * Call Google Gemini-3 (Fallback)
 * For vision/OCR, document parsing, Maps integration
 */
async function callGemini(
  systemPrompt: string,
  messages: AIMessage[]
): Promise<AIResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] },
          ...messages.slice(-10).map((m) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.content }],
          })),
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Parse JSON response (Gemini doesn't have native JSON mode)
  const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // Fallback: return text as message
    return {
      message: aiResponseText,
      action: "none",
    };
  }

  return JSON.parse(jsonMatch[0]);
}
