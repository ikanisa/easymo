export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export async function googleSearch(query: string, num: number = 5): Promise<SearchResult[]> {
  const apiKey = Deno.env.get("GOOGLE_SEARCH_API_KEY");
  const cx = Deno.env.get("GOOGLE_SEARCH_CX");

  if (!apiKey || !cx) {
    console.warn("Google Search API key or CX not set. Returning empty results.");
    return [];
  }

  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=${num}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Google Search API error: ${response.status} ${response.statusText}`);
      return [];
    }
    const data = await response.json();

    if (!data.items) {
      return [];
    }

    return data.items.map((item: any) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
    }));
  } catch (error) {
    console.error("Google Search error:", error);
    return [];
  }
}
