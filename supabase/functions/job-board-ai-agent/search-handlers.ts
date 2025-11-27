export async function handleGoogleSearch(
  args: any,
  _supabase: SupabaseClient,
  _openai: OpenAI,
  phoneNumber: string
): Promise<any> {
  const correlationId = crypto.randomUUID();
  try {
    const apiKey = Deno.env.get("GOOGLE_SEARCH_API_KEY");
    const cx = Deno.env.get("GOOGLE_SEARCH_CX");

    if (!apiKey || !cx) {
      throw new Error("Google Search configuration missing");
    }

    const params = new URLSearchParams({
      key: apiKey,
      cx: cx,
      q: args.query,
      num: (args.num_results || 10).toString(),
    });

    if (args.country) {
      params.append("gl", args.country);
    }

    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Google Search failed: ${response.status}`);
    }

    const data = await response.json();
    
    await logStructuredEvent("GOOGLE_SEARCH_PERFORMED", {
      query: args.query,
      phoneNumber,
      correlationId
    });

    return {
      success: true,
      items: (data.items || []).map((item: any) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet
      }))
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function handleWebSearch(
  args: any,
  _supabase: SupabaseClient,
  openai: OpenAI,
  phoneNumber: string
): Promise<any> {
  const correlationId = crypto.randomUUID();
  try {
    // Try to use Responses API if available
    if ((openai as any).responses) {
      const response = await (openai as any).responses.create({
        model: "gpt-4o",
        input: args.query,
        tools: [{ type: "web_search_preview" }],
      });
      
      await logStructuredEvent("WEB_SEARCH_PERFORMED", {
        query: args.query,
        phoneNumber,
        provider: "openai_responses",
        correlationId
      });

      return {
        success: true,
        results: response.output_text || response.choices?.[0]?.message?.content,
        citations: response.citations || []
      };
    }

    // Fallback to chat completion
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant with access to real-time web information. 
          Search the web for: "${args.query}". 
          Provide a structured summary of findings with source URLs if possible.`
        },
        { role: "user", content: args.query }
      ]
    });

    await logStructuredEvent("WEB_SEARCH_PERFORMED", {
      query: args.query,
      phoneNumber,
      provider: "chat_completion_fallback",
      correlationId
    });

    return {
      success: true,
      results: completion.choices[0].message.content
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
