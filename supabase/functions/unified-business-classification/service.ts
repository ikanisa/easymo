/**
 * Unified Business Tag Classification Service
 * Merges: intelligent-tag-allocation + classify-business-tags
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { logError,logStructuredEvent } from "../_shared/observability.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

interface BusinessTag {
  id: string;
  name: string;
  slug: string;
  description: string;
  search_keywords?: string[];
  sort_order: number;
}

interface Business {
  id: string;
  name: string;
  description: string | null;
  tag: string | null;
  tag_id: string | null;
  category_name?: string;
}

interface ClassificationResult {
  business_id: string;
  business_name: string;
  tag_id: string;
  tag_name: string;
  tag_slug: string;
  confidence: number;
  reasoning: string;
}

interface ClassificationOptions {
  batchSize?: number;
  dryRun?: boolean;
  minConfidence?: number;
  categoryFilter?: string;
}

export class BusinessClassificationService {
  private supabase;
  private primaryTags: BusinessTag[] = [];
  private othersTag: BusinessTag | null = null;

  constructor(supabaseClient: ReturnType<typeof createClient>) {
    this.supabase = supabaseClient;
  }

  /**
   * Initialize tags from database
   */
  async loadTags(): Promise<void> {
    const { data: allTags, error } = await this.supabase
      .from("business_tags")
      .select("id, name, slug, description, search_keywords, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error || !allTags?.length) {
      throw new Error(`Failed to fetch business tags: ${error?.message || "No tags found"}`);
    }

    this.primaryTags = allTags.slice(0, 11);
    this.othersTag = allTags.find(t => 
      t.slug === "others" || t.name.toLowerCase() === "others"
    ) || null;

    await logStructuredEvent("CLASSIFICATION_TAGS_LOADED", {
      primaryCount: this.primaryTags.length,
      hasOthersTag: !!this.othersTag,
    });
  }

  /**
   * Classify a single business
   */
  async classifySingle(businessId: string): Promise<ClassificationResult | null> {
    const { data: business, error } = await this.supabase
      .from("business")
      .select("id, name, description, tag, tag_id, category_name")
      .eq("id", businessId)
      .single();

    if (error || !business) {
      throw new Error(`Business not found: ${businessId} - ${error?.message}`);
    }

    if (!this.primaryTags.length) {
      await this.loadTags();
    }

    const results = await this.classifyWithOpenAI([business]);
    return results[0] || null;
  }

  /**
   * Classify businesses in batch
   */
  async classifyBatch(options: ClassificationOptions = {}): Promise<{
    processed: number;
    updated: number;
    results: ClassificationResult[];
    dryRun: boolean;
  }> {
    const { 
      batchSize = 50, 
      dryRun = false, 
      minConfidence = 0.5,
      categoryFilter 
    } = options;

    if (!this.primaryTags.length) {
      await this.loadTags();
    }

    // Build query
    let query = this.supabase
      .from("business")
      .select("id, name, description, tag, tag_id, category_name")
      .is("tag_id", null)
      .eq("is_active", true)
      .limit(batchSize);

    if (categoryFilter) {
      query = query.eq("category_name", categoryFilter);
    }

    const { data: businesses, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch businesses: ${error.message}`);
    }

    if (!businesses?.length) {
      return { processed: 0, updated: 0, results: [], dryRun };
    }

    await logStructuredEvent("CLASSIFICATION_BATCH_START", {
      batchSize: businesses.length,
      dryRun,
      categoryFilter,
    });

    const results = await this.classifyWithOpenAI(businesses);

    // Apply updates if not dry run
    let updated = 0;
    if (!dryRun) {
      for (const result of results) {
        if (result.confidence >= minConfidence) {
          const { error: updateError } = await this.supabase
            .from("business")
            .update({ tag_id: result.tag_id })
            .eq("id", result.business_id);

          if (!updateError) {
            updated++;
          } else {
            logError("BUSINESS_UPDATE_FAILED", updateError, {
              business_id: result.business_id,
              tag_id: result.tag_id,
            });
          }
        }
      }
    }

    // Log results (non-blocking)
    this.logClassification(results, dryRun).catch(err => 
      logError("CLASSIFICATION_LOG_FAILED", err)
    );

    return {
      processed: businesses.length,
      updated,
      results,
      dryRun,
    };
  }

  /**
   * Classify businesses using OpenAI
   */
  private async classifyWithOpenAI(businesses: Business[]): Promise<ClassificationResult[]> {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const tagDescriptions = this.primaryTags.map((t, idx) => {
      const keywords = t.search_keywords?.length 
        ? `\n  Keywords: ${t.search_keywords.join(", ")}` 
        : "";
      return `${idx + 1}. ${t.name} (${t.slug}): ${t.description || "Various " + t.name}${keywords}`;
    }).join("\n");

    const othersInfo = this.othersTag
      ? `\n12. Others (${this.othersTag.slug}): For businesses that don't fit above`
      : "";

    const businessList = businesses.map((b, idx) =>
      `${idx + 1}. Name: "${b.name}", Description: "${b.description || "N/A"}", Current: "${b.tag || "None"}"`
    ).join("\n");

    const prompt = `You are an expert business categorization AI. Classify each business to the most appropriate tag. 

**Available Tags:**
${tagDescriptions}${othersInfo}

**Businesses:**
${businessList}

**Instructions:**
1. Analyze name, description, and current tag
2. Match to THE MOST APPROPRIATE primary tag (1-11)
3. Use "Others" (12) ONLY if truly no fit
4. Provide confidence (0-1) and brief reasoning

**Output JSON:**
{
  "allocations": [
    { "business_index": 1, "tag_slug": "electronics", "confidence": 0.95, "reasoning": "Sells phones" }
  ]
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a business classification expert. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response content from OpenAI");
    }

    const parsed = JSON.parse(content);
    const allocations = parsed.allocations || parsed;

    if (!Array.isArray(allocations)) {
      throw new Error("Expected allocations array from OpenAI");
    }

    // Map to results
    const allTags = [...this.primaryTags, this.othersTag].filter(Boolean) as BusinessTag[];
    
    return allocations
      .map((alloc: any) => {
        const business = businesses[alloc.business_index - 1];
        const tag = allTags.find(t => t.slug === alloc.tag_slug);

        if (!business || !tag) {
          logError("INVALID_ALLOCATION", new Error("Business or tag not found"), {
            business_index: alloc.business_index,
            tag_slug: alloc.tag_slug,
          });
          return null;
        }

        return {
          business_id: business.id,
          business_name: business.name,
          tag_id: tag.id,
          tag_name: tag.name,
          tag_slug: tag.slug,
          confidence: alloc.confidence,
          reasoning: alloc.reasoning,
        };
      })
      .filter(Boolean) as ClassificationResult[];
  }

  /**
   * Log classification results (checks if table exists)
   */
  private async logClassification(results: ClassificationResult[], dryRun: boolean): Promise<void> {
    try {
      for (const result of results) {
        await this.supabase.from("business_tag_classification_logs").insert({
          business_id: result.business_id,
          business_name: result.business_name,
          classified_tags: [result],
          ai_model: "gpt-4o-mini",
          success: !dryRun && result.confidence >= 0.5,
        });
      }
    } catch (error) {
      // Table might not exist, log but don't fail
      logError("CLASSIFICATION_LOG_INSERT_FAILED", error, {
        results_count: results.length,
      });
    }
  }
}
