import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { googleSearch } from "./google_search.ts";

export async function deepSearch(query: string, apiKey: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3" });  // Per README.md: Mandatory Gemini-3

  // 1. Generate search queries
  const planPrompt = `User query: ${query}
  Generate 3 distinct Google search queries to gather comprehensive information to answer this. Return ONLY a JSON array of strings. Example: ["query 1", "query 2"]`;
  
  try {
    const planResult = await model.generateContent(planPrompt);
    const text = planResult.response.text().replace(/```json|```/g, "").trim();
    let queries: string[] = [];
    try {
        queries = JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse deep search queries", text);
        queries = [query];
    }

    // 2. Execute searches
    let allResults: any[] = [];
    for (const q of queries) {
      const results = await googleSearch(q, 3);
      allResults = [...allResults, ...results];
    }

    // Deduplicate by link
    const uniqueResults = Array.from(new Map(allResults.map(item => [item.link, item])).values());

    if (uniqueResults.length === 0) {
        return "I couldn't find any information on the web regarding your request.";
    }

    // 3. Synthesize
    const context = uniqueResults.map(r => `Title: ${r.title}\nLink: ${r.link}\nSnippet: ${r.snippet}`).join("\n\n");
    
    const synthPrompt = `User query: ${query}
    
    Search Results:
    ${context}
    
    Synthesize a comprehensive answer based on the search results. Cite sources (links) where appropriate. Format nicely.`;
    
    const synthModel = genAI.getGenerativeModel({ model: "gemini-3" });  // Per README.md: Mandatory Gemini-3
    const synthResult = await synthModel.generateContent(synthPrompt);
    return synthResult.response.text();

  } catch (error) {
    console.error("Deep Search error:", error);
    return "I encountered an error while performing a deep search. Please try again later.";
  }
}
