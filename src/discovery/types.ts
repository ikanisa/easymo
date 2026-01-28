export type DiscoveryEngine = "openai" | "gemini" | "auto";

export type SearchResult = {
  title?: string;
  url?: string;
  snippet?: string;
};

export type CandidateVendor = {
  name: string;
  phones: string[];
  website?: string;
  address?: string;
  area?: string;
  confidence: number;
  sources: SearchResult[];
};

export type WebDiscoveryInput = {
  request_id: string;
  need: string;
  category?: string;
  location_text?: string;
  max_results?: number;
  engine?: DiscoveryEngine;
};

export type WebDiscoveryResult = {
  engine: Exclude<DiscoveryEngine, "auto"> | "none";
  candidates: CandidateVendor[];
  raw_results: SearchResult[];
  disabled?: boolean;
  reason?: string;
};
