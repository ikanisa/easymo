import { GoogleGenerativeAI } from "@google/generative-ai";

let cachedClient: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.GOOGLE_AI_API_KEY || "PLACEHOLDER_GOOGLE_AI_KEY";
  
  // Allow placeholder for testing - will fail at API call time if invalid
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
