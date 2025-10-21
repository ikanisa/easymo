import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

function buildClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const baseURL = process.env.OPENAI_BASE_URL?.trim();

  cachedClient = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  return cachedClient;
}

export function getOpenAIClient(): OpenAI | null {
  if (cachedClient) {
    return cachedClient;
  }
  return buildClient();
}

export function resetOpenAIClient() {
  cachedClient = null;
}

