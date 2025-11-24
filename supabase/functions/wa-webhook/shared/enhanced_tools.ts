/**
 * Enhanced Tool Library with External APIs
 *
 * Provides additional tools for AI agents:
 * - Web search (Tavily API)
 * - Deep research (Perplexity API)
 * - Weather information
 * - Currency conversion
 * - Translation
 */

import type { ToolDefinition, ToolExecutionContext } from "./tool_manager.ts";
import { logStructuredEvent } from "../observe/log.ts";

/**
 * Safely extract error message from unknown error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Web Search Tool using Tavily API
 */
export const webSearchTool: ToolDefinition = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for current information, news, or answers to questions. Use this when you need up-to-date information not in your training data.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return (default: 5)",
        },
      },
      required: ["query"],
    },
  },
  handler: async (args, context) => {
    const apiKey = Deno.env.get("TAVILY_API_KEY");
    if (!apiKey) {
      return {
        error: "Web search not configured",
        results: [],
      };
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: args.query,
          search_depth: "basic",
          include_answer: true,
          max_results: args.max_results || 5,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
      }

      const data = await response.json();

      await logStructuredEvent("TOOL_WEB_SEARCH_SUCCESS", {
        correlation_id: context.correlationId,
        query: args.query,
        results_count: data.results?.length || 0,
      });

      return {
        answer: data.answer,
        results: data.results?.map((r: any) => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
          score: r.score,
        })) || [],
      };
    } catch (error) {
      await logStructuredEvent("TOOL_WEB_SEARCH_ERROR", {
        correlation_id: context.correlationId,
        error: getErrorMessage(error),
      });

      return {
        error: getErrorMessage(error),
        results: [],
      };
    }
  },
};

/**
 * Deep Research Tool using Perplexity API
 */
export const deepResearchTool: ToolDefinition = {
  type: "function",
  function: {
    name: "deep_research",
    description:
      "Perform deep research on a topic with comprehensive analysis. Use this for complex questions requiring detailed, well-sourced answers.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The research query or question",
        },
        focus: {
          type: "string",
          description: "Optional focus area (e.g., 'academic', 'news', 'general')",
        },
      },
      required: ["query"],
    },
  },
  handler: async (args, context) => {
    const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
    if (!apiKey) {
      return {
        error: "Deep research not configured",
        research: "",
      };
    }

    try {
      const response = await fetch(
        "https://api.perplexity.ai/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              {
                role: "system",
                content:
                  "You are a research assistant. Provide comprehensive, well-sourced answers.",
              },
              {
                role: "user",
                content: args.query,
              },
            ],
            temperature: 0.2,
            max_tokens: 1000,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data = await response.json();

      await logStructuredEvent("TOOL_DEEP_RESEARCH_SUCCESS", {
        correlation_id: context.correlationId,
        query: args.query,
      });

      return {
        research: data.choices?.[0]?.message?.content || "",
        sources: data.citations || [],
      };
    } catch (error) {
      await logStructuredEvent("TOOL_DEEP_RESEARCH_ERROR", {
        correlation_id: context.correlationId,
        error: getErrorMessage(error),
      });

      return {
        error: getErrorMessage(error),
        research: "",
      };
    }
  },
};

/**
 * Get current weather information
 */
export const weatherTool: ToolDefinition = {
  type: "function",
  function: {
    name: "get_weather",
    description: "Get current weather information for a location",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City name or location (e.g., 'Kigali' or 'Kigali, Rwanda')",
        },
      },
      required: ["location"],
    },
  },
  handler: async (args, context) => {
    const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
    if (!apiKey) {
      return {
        error: "Weather service not configured",
        weather: null,
      };
    }

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
          args.location
        )}&appid=${apiKey}&units=metric`
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        location: data.name,
        country: data.sys?.country,
        temperature: data.main?.temp,
        feels_like: data.main?.feels_like,
        humidity: data.main?.humidity,
        description: data.weather?.[0]?.description,
        wind_speed: data.wind?.speed,
      };
    } catch (error) {
      return {
        error: getErrorMessage(error),
        weather: null,
      };
    }
  },
};

/**
 * Currency conversion tool
 */
export const currencyConversionTool: ToolDefinition = {
  type: "function",
  function: {
    name: "convert_currency",
    description: "Convert an amount from one currency to another",
    parameters: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "Amount to convert",
        },
        from_currency: {
          type: "string",
          description: "Source currency code (e.g., 'RWF', 'USD', 'EUR')",
        },
        to_currency: {
          type: "string",
          description: "Target currency code",
        },
      },
      required: ["amount", "from_currency", "to_currency"],
    },
  },
  handler: async (args, context) => {
    const apiKey = Deno.env.get("EXCHANGERATE_API_KEY");
    if (!apiKey) {
      // Fallback to public API
      try {
        const response = await fetch(
          `https://api.exchangerate-api.com/v4/latest/${args.from_currency}`
        );

        if (!response.ok) {
          throw new Error(`Exchange rate API error: ${response.status}`);
        }

        const data = await response.json();
        const rate = data.rates[args.to_currency];

        if (!rate) {
          throw new Error(
            `Conversion rate not found for ${args.to_currency}`
          );
        }

        const converted = args.amount * rate;

        return {
          original_amount: args.amount,
          from_currency: args.from_currency,
          to_currency: args.to_currency,
          converted_amount: converted,
          exchange_rate: rate,
          timestamp: data.date,
        };
      } catch (error) {
        return {
          error: getErrorMessage(error),
          converted_amount: null,
        };
      }
    }

    // Use premium API if available
    try {
      const response = await fetch(
        `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${args.from_currency}/${args.to_currency}/${args.amount}`
      );

      if (!response.ok) {
        throw new Error(`Exchange rate API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        original_amount: args.amount,
        from_currency: args.from_currency,
        to_currency: args.to_currency,
        converted_amount: data.conversion_result,
        exchange_rate: data.conversion_rate,
        timestamp: data.time_last_update_utc,
      };
    } catch (error) {
      return {
        error: getErrorMessage(error),
        converted_amount: null,
      };
    }
  },
};

/**
 * Get all enhanced tools
 */
export function getEnhancedTools(): ToolDefinition[] {
  return [
    webSearchTool,
    deepResearchTool,
    weatherTool,
    currencyConversionTool,
  ];
}

/**
 * Register all enhanced tools with a tool manager
 */
export function registerEnhancedTools(
  registerFn: (tool: ToolDefinition) => void
): void {
  const tools = getEnhancedTools();
  for (const tool of tools) {
    registerFn(tool);
  }

  logStructuredEvent("ENHANCED_TOOLS_REGISTERED", {
    tool_count: tools.length,
    tool_names: tools.map((t) => t.function.name),
  });
}
