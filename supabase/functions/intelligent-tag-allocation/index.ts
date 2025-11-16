import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface BusinessTag {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
}

interface Business {
  id: string;
  name: string;
  description: string | null;
  tag: string | null;
  tag_id: string | null;
}

serve(async (req) => {
  try {
    const { batchSize = 50, dryRun = false } = await req.json().catch(() => ({}));

    console.log("Starting intelligent tag allocation...");
    console.log(`Batch size: ${batchSize}, Dry run: ${dryRun}`);

    // Get active tags (first 11 primary tags)
    const { data: allTags, error: tagsError } = await supabase
      .from("business_tags")
      .select("id, name, slug, description, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (tagsError || !allTags || allTags.length === 0) {
      throw new Error("Failed to fetch business tags");
    }

    // Get first 11 tags as primary, rest as "Others"
    const primaryTags = allTags.slice(0, 11);
    const othersTag = allTags.find(t => t.slug === "others" || t.name.toLowerCase() === "others");

    console.log(`Primary tags: ${primaryTags.map(t => t.name).join(", ")}`);
    console.log(`Others tag: ${othersTag?.name || "Not found"}`);

    // Get businesses without tag_id
    const { data: businesses, error: businessError } = await supabase
      .from("business")
      .select("id, name, description, tag, tag_id")
      .is("tag_id", null)
      .eq("is_active", true)
      .limit(batchSize);

    if (businessError) {
      throw new Error(`Failed to fetch businesses: ${businessError.message}`);
    }

    if (!businesses || businesses.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No businesses need tag allocation",
          processed: 0 
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${businesses.length} businesses...`);

    // Use OpenAI to intelligently allocate tags
    const results = await allocateTagsWithOpenAI(businesses, primaryTags, othersTag);

    // Update database if not dry run
    let updated = 0;
    if (!dryRun) {
      for (const result of results) {
        const { error: updateError } = await supabase
          .from("business")
          .update({ tag_id: result.tag_id })
          .eq("id", result.business_id);

        if (!updateError) {
          updated++;
        } else {
          console.error(`Failed to update ${result.business_name}:`, updateError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: businesses.length,
        updated: updated,
        dryRun: dryRun,
        results: results,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function allocateTagsWithOpenAI(
  businesses: Business[],
  primaryTags: BusinessTag[],
  othersTag: BusinessTag | undefined,
): Promise<Array<{ business_id: string; business_name: string; tag_id: string; tag_name: string; confidence: number; reasoning: string }>> {
  // Prepare tag descriptions for OpenAI
  const tagDescriptions = primaryTags.map((t, idx) => 
    `${idx + 1}. ${t.name} (${t.slug}): ${t.description || "Various products/services related to " + t.name}`
  ).join("\n");

  const othersInfo = othersTag 
    ? `\n12. Others: For businesses that don't fit the above categories`
    : "";

  // Prepare businesses data
  const businessList = businesses.map((b, idx) => 
    `${idx + 1}. Name: "${b.name}", Description: "${b.description || "N/A"}", Current tag: "${b.tag || "None"}"`
  ).join("\n");

  const prompt = `You are an expert business categorization AI with advanced reasoning capabilities. Your task is to intelligently allocate the most appropriate tag to each business from a predefined list.

**Available Tags (Primary - use these first):**
${tagDescriptions}${othersInfo}

**Businesses to Categorize:**
${businessList}

**Instructions:**
1. Analyze each business name, description, and current tag
2. Use your reasoning to understand the business type
3. Match each business to THE MOST APPROPRIATE tag from the primary list (1-11)
4. Only use "Others" (12) if the business truly doesn't fit any primary category
5. Provide confidence score (0-1) and brief reasoning

**Output Format (JSON object with allocations array):**
{
  "allocations": [
    {
      "business_index": 1,
      "tag_slug": "electronics_store",
      "confidence": 0.95,
      "reasoning": "Sells phones and computers - clear electronics store"
    }
  ]
}

Respond with ONLY the JSON object, no other text.`;

  try {
    console.log("Calling OpenAI with gpt-4o-mini for intelligent reasoning...");
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Using GPT-4o-mini with enhanced prompting
        messages: [
          {
            role: "system",
            content: "You are an expert business categorization AI. You analyze business names and descriptions to assign the most appropriate category. You always respond with valid JSON arrays only."
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent categorization
        response_format: { type: "json_object" }, // Force JSON response
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No response from OpenAI");
    }

    console.log("OpenAI response received");

    // Parse JSON response
    let allocations: Array<{
      business_index: number;
      tag_slug: string;
      confidence: number;
      reasoning: string;
    }>;

    try {
      const parsed = JSON.parse(content);
      allocations = parsed.allocations || parsed;
      
      if (!Array.isArray(allocations)) {
        throw new Error("Expected array of allocations");
      }
    } catch (err) {
      console.error("Failed to parse OpenAI response:", content);
      throw new Error("Invalid JSON response from OpenAI");
    }

    // Map allocations to results
    const results = allocations.map((alloc) => {
      const business = businesses[alloc.business_index - 1];
      const tag = [...primaryTags, othersTag].find(t => t?.slug === alloc.tag_slug);

      if (!business || !tag) {
        console.warn(`Invalid allocation: business_index=${alloc.business_index}, tag_slug=${alloc.tag_slug}`);
        return null;
      }

      return {
        business_id: business.id,
        business_name: business.name,
        tag_id: tag.id,
        tag_name: tag.name,
        confidence: alloc.confidence,
        reasoning: alloc.reasoning,
      };
    }).filter(r => r !== null) as Array<{
      business_id: string;
      business_name: string;
      tag_id: string;
      tag_name: string;
      confidence: number;
      reasoning: string;
    }>;

    console.log(`Successfully allocated tags for ${results.length} businesses`);
    return results;
  } catch (error) {
    console.error("OpenAI allocation error:", error);
    throw error;
  }
}
