import { GoogleGenerativeAI } from "@google/generative-ai";

let cachedClient: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY not configured");
  }

  cachedClient = new GoogleGenerativeAI(apiKey);
  return cachedClient;
}

export const GEMINI_MODELS = {
  FLASH_LITE: "gemini-2.0-flash-exp",
  FLASH: "gemini-2.0-flash",
  PRO: "gemini-1.5-pro",
} as const;

export function resetGeminiClient() {
  cachedClient = null;
}
