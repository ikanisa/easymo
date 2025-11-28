import { getGeminiClient } from "../providers/gemini-client";

export interface GroundingMetadata {
  webSearchQueries?: string[];
  searchEntryPoint?: {
    renderedContent?: string;
  };
  groundingChunks?: Array<{
    web?: {
      uri?: string;
      title?: string;
    };
  }>;
  groundingSupports?: Array<{
    segment?: {
      startIndex?: number;
      endIndex?: number;
      text?: string;
    };
    groundingChunkIndices?: number[];
    confidenceScores?: number[];
  }>;
}

export interface GroundedResponse {
  text: string;
  groundingMetadata?: GroundingMetadata;
  sources?: Array<{
    uri: string;
    title: string;
  }>;
  searchQueries?: string[];
}

/**
 * Generate a response with Google Search grounding
 * The response will include citations and sources from web search
 */
export async function searchWithGrounding(query: string): Promise<GroundedResponse> {
  const client = getGeminiClient();
  
  const model = client.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    tools: [{ googleSearchRetrieval: {} }],
  });

  const result = await model.generateContent(query);
  const response = result.response;
  const candidate = response.candidates?.[0];

  // Extract grounding metadata
  const groundingMetadata = candidate?.groundingMetadata as GroundingMetadata | undefined;

  // Extract sources from grounding chunks
  const sources: Array<{ uri: string; title: string }> = [];
  if (groundingMetadata?.groundingChunks) {
    for (const chunk of groundingMetadata.groundingChunks) {
      if (chunk.web?.uri && chunk.web?.title) {
        sources.push({
          uri: chunk.web.uri,
          title: chunk.web.title,
        });
      }
    }
  }

  return {
    text: response.text(),
    groundingMetadata,
    sources: sources.length > 0 ? sources : undefined,
    searchQueries: groundingMetadata?.webSearchQueries,
  };
}

/**
 * Generate a factual response with citations
 * Best for questions requiring current information or facts
 */
export async function generateFactualResponse(
  question: string,
  context?: string
): Promise<GroundedResponse> {
  const prompt = context
    ? `Context: ${context}\n\nQuestion: ${question}\n\nPlease provide a factual answer with citations.`
    : `${question}\n\nPlease provide a factual answer with citations.`;

  return searchWithGrounding(prompt);
}

/**
 * Search for recent information about a topic
 * Useful for news, current events, or time-sensitive information
 */
export async function searchRecentInfo(topic: string): Promise<GroundedResponse> {
  const prompt = `What are the latest developments or news about: ${topic}?\n\nPlease provide recent information with sources.`;
  return searchWithGrounding(prompt);
}

/**
 * Compare information from multiple sources
 * Useful for research or fact-checking
 */
export async function compareSourcesOnTopic(topic: string): Promise<GroundedResponse> {
  const prompt = `Compare information from different sources about: ${topic}\n\nProvide a balanced view with citations.`;
  return searchWithGrounding(prompt);
}

/**
 * Extract and summarize information with sources
 */
export async function summarizeWithSources(
  topic: string,
  focusAreas?: string[]
): Promise<GroundedResponse> {
  let prompt = `Summarize information about: ${topic}`;
  
  if (focusAreas && focusAreas.length > 0) {
    prompt += `\n\nFocus on these areas:\n${focusAreas.map((area, i) => `${i + 1}. ${area}`).join("\n")}`;
  }
  
  prompt += "\n\nProvide a comprehensive summary with citations.";
  
  return searchWithGrounding(prompt);
}

/**
 * Format grounded response as markdown with citations
 */
export function formatGroundedResponseAsMarkdown(response: GroundedResponse): string {
  let markdown = response.text;

  if (response.sources && response.sources.length > 0) {
    markdown += "\n\n## Sources\n\n";
    response.sources.forEach((source, i) => {
      markdown += `${i + 1}. [${source.title}](${source.uri})\n`;
    });
  }

  if (response.searchQueries && response.searchQueries.length > 0) {
    markdown += "\n\n## Search Queries Used\n\n";
    response.searchQueries.forEach((query, i) => {
      markdown += `${i + 1}. ${query}\n`;
    });
  }

  return markdown;
}
