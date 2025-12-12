/**
 * Embedding Generator Service
 * Generates vector embeddings for semantic search using OpenAI or Gemini
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokens: number;
}

/**
 * Generate embeddings using OpenAI text-embedding-3-small (1536 dimensions)
 */
export async function generateEmbeddingOpenAI(
  text: string
): Promise<EmbeddingResult> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  
  return {
    embedding: data.data[0].embedding,
    model: "text-embedding-3-small",
    tokens: data.usage.total_tokens,
  };
}

/**
 * Generate embeddings using Google Gemini (embedding-001)
 * Note: Gemini embeddings are 768 dimensions, we'll need to pad to 1536
 */
export async function generateEmbeddingGemini(
  text: string
): Promise<EmbeddingResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: {
          parts: [{ text }],
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  let embedding = data.embedding.values;

  // Pad Gemini's 768-dim to 1536-dim with zeros
  if (embedding.length < 1536) {
    embedding = [...embedding, ...Array(1536 - embedding.length).fill(0)];
  }

  return {
    embedding,
    model: "embedding-001",
    tokens: text.split(/\s+/).length, // Approximate
  };
}

/**
 * Generate embedding with automatic fallback
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  // Prefer OpenAI (better quality, native 1536 dims)
  if (OPENAI_API_KEY) {
    try {
      return await generateEmbeddingOpenAI(text);
    } catch (error) {
      console.error("OpenAI embedding failed, trying Gemini:", error);
    }
  }

  // Fallback to Gemini
  if (GEMINI_API_KEY) {
    return await generateEmbeddingGemini(text);
  }

  throw new Error("No embedding API configured (need OPENAI_API_KEY or GEMINI_API_KEY)");
}

/**
 * Index content for semantic search
 */
export interface SearchIndexEntry {
  domain: string;
  entityId: string;
  entityType: string;
  title: string;
  description?: string;
  fullText: string;
  metadata?: Record<string, any>;
  location?: { lat: number; lon: number };
  locationName?: string;
  relevanceScore?: number;
}

export async function indexForSearch(
  entry: SearchIndexEntry,
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Generate embedding for the full text
  const { embedding } = await generateEmbedding(entry.fullText);

  // Convert location to PostGIS point if provided
  let locationPoint = null;
  if (entry.location) {
    locationPoint = `SRID=4326;POINT(${entry.location.lon} ${entry.location.lat})`;
  }

  // Upsert into search_embeddings
  const { error } = await supabase
    .from("search_embeddings")
    .upsert({
      domain: entry.domain,
      entity_id: entry.entityId,
      entity_type: entry.entityType,
      title: entry.title,
      description: entry.description || null,
      full_text: entry.fullText,
      embedding: JSON.stringify(embedding), // PostgreSQL vector type handles array
      metadata: entry.metadata || {},
      location: locationPoint,
      location_name: entry.locationName || null,
      relevance_score: entry.relevanceScore || 1.0,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "domain,entity_id",
    });

  if (error) {
    throw new Error(`Failed to index content: ${error.message}`);
  }
}

/**
 * Perform semantic search
 */
export interface SearchOptions {
  domains?: string[];
  matchCount?: number;
  minSimilarity?: number;
  userLocation?: { lat: number; lon: number };
  maxDistanceMeters?: number;
}

export async function semanticSearch(
  query: string,
  options: SearchOptions,
  supabaseUrl: string,
  supabaseKey: string
): Promise<any[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Generate query embedding
  const { embedding: queryEmbedding } = await generateEmbedding(query);

  // Convert location to PostGIS point
  let userLocationPoint = null;
  if (options.userLocation) {
    userLocationPoint = `SRID=4326;POINT(${options.userLocation.lon} ${options.userLocation.lat})`;
  }

  // Call semantic_search function
  const { data, error } = await supabase.rpc("semantic_search", {
    query_embedding: JSON.stringify(queryEmbedding),
    search_domains: options.domains || ["marketplace", "jobs", "properties"],
    match_count: options.matchCount || 10,
    min_similarity: options.minSimilarity || 0.7,
    user_location: userLocationPoint,
    max_distance_meters: options.maxDistanceMeters || 50000,
  });

  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }

  return data || [];
}

/**
 * Hybrid search (vector + full-text)
 */
export async function hybridSearch(
  query: string,
  options: SearchOptions,
  supabaseUrl: string,
  supabaseKey: string
): Promise<any[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Generate query embedding
  const { embedding: queryEmbedding } = await generateEmbedding(query);

  // Call hybrid_search function
  const { data, error } = await supabase.rpc("hybrid_search", {
    search_query: query,
    query_embedding: JSON.stringify(queryEmbedding),
    search_domains: options.domains || ["marketplace", "jobs", "properties"],
    match_count: options.matchCount || 10,
    vector_weight: 0.7,
    text_weight: 0.3,
  });

  if (error) {
    throw new Error(`Hybrid search failed: ${error.message}`);
  }

  return data || [];
}
