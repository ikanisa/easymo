import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  cachedClient = new OpenAI({
    apiKey,
    organization: process.env.OPENAI_ORG_ID,
    maxRetries: 3,
    timeout: 60_000,
  });

  return cachedClient;
}

export function resetOpenAIClient() {
  cachedClient = null;
}
