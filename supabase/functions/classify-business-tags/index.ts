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
  search_keywords: string[];
}

interface ClassificationResult {
  tag: string;
  confidence: number;
  reasoning: string;
}

serve(async (req) => {
  try {
    const { businessId, batchSize = 10 } = await req.json();

    // Classify single business or batch
    if (businessId) {
      const result = await classifySingleBusiness(businessId);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Batch classification
    const result = await classifyBatch(batchSize);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("classify-business-tags.error", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

async function classifySingleBusiness(businessId: string) {
  const startTime = Date.now();

  // Get business details
  const { data: business, error: businessError } = await supabase
    .from("business")
    .select("id, name, description, tag, category_name")
    .eq("id", businessId)
    .single();

  if (businessError || !business) {
    throw new Error(`Business not found: ${businessId}`);
  }

  // Get available tags
  const { data: tags, error: tagsError } = await supabase
    .from("business_tags")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (tagsError || !tags || tags.length === 0) {
    throw new Error("No active tags found");
  }

  // Classify with OpenAI
  const classification = await classifyWithOpenAI(business, tags as BusinessTag[]);

  // Store assignments
  const assignments = [];
  for (const result of classification.results) {
    const tag = tags.find((t) => t.slug === result.tag);
    if (tag && result.confidence >= 0.5) {
      const { error: assignError } = await supabase
        .from("business_tag_assignments")
        .upsert({
          business_id: business.id,
          tag_id: tag.id,
          confidence_score: result.confidence,
          assigned_by: "ai",
        }, { onConflict: "business_id,tag_id" });

      if (!assignError) {
        assignments.push({
          tag: tag.name,
          slug: tag.slug,
          confidence: result.confidence,
        });
      }
    }
  }

  // Log classification
  await supabase.from("business_tag_classification_logs").insert({
    business_id: business.id,
    business_name: business.name,
    business_description: business.description,
    original_tag: business.tag,
    classified_tags: classification.results,
    ai_model: "gpt-4o-mini",
    ai_response: JSON.stringify(classification.raw_response),
    processing_time_ms: Date.now() - startTime,
    success: assignments.length > 0,
  });

  return {
    business_id: business.id,
    business_name: business.name,
    assignments,
    processing_time_ms: Date.now() - startTime,
  };
}

async function classifyBatch(batchSize: number) {
  const startTime = Date.now();

  // Get unclassified businesses in "Shops & Services" category
  const { data: businesses, error } = await supabase
    .from("business")
    .select("id, name, description, tag")
    .eq("category_name", "Shops & Services")
    .eq("is_active", true)
    .is("tag", null) // Only untagged
    .limit(batchSize);

  if (error || !businesses || businesses.length === 0) {
    return {
      message: "No businesses to classify",
      processed: 0,
      processing_time_ms: Date.now() - startTime,
    };
  }

  const results = [];
  for (const business of businesses) {
    try {
      const result = await classifySingleBusiness(business.id);
      results.push(result);
    } catch (err) {
      console.error(`Failed to classify ${business.id}:`, err);
      results.push({
        business_id: business.id,
        error: err.message,
      });
    }
  }

  return {
    processed: results.length,
    results,
    processing_time_ms: Date.now() - startTime,
  };
}

async function classifyWithOpenAI(
  business: { name: string; description?: string; tag?: string },
  tags: BusinessTag[],
): Promise<{ results: ClassificationResult[]; raw_response: any }> {
  const tagDescriptions = tags.map((t) =>
    `- ${t.name} (${t.slug}): ${t.description}\n  Keywords: ${t.search_keywords.join(", ")}`
  ).join("\n");

  const prompt = `You are an expert business classifier. Analyze the following business and assign it to the most appropriate tag(s) from the list below.

Business Name: ${business.name}
Business Description: ${business.description || "No description provided"}
Original Tag: ${business.tag || "None"}

Available Tags:
${tagDescriptions}

Instructions:
1. Analyze the business name, description, and original tag
2. Assign 1-3 most relevant tags
3. Provide a confidence score (0-1) for each tag
4. Provide brief reasoning for each classification

Return ONLY a valid JSON array with this structure:
[
  {
    "tag": "electronics",
    "confidence": 0.95,
    "reasoning": "Business sells phones and computers"
  }
]`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a business classification expert. Always return valid JSON arrays.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("No response from OpenAI");
  }

  // Parse JSON response
  let results: ClassificationResult[];
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
      content.match(/\[([\s\S]*?)\]/);
    const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
    results = JSON.parse(jsonString);
  } catch (err) {
    console.error("Failed to parse OpenAI response:", content);
    throw new Error("Invalid JSON response from OpenAI");
  }

  return {
    results,
    raw_response: data,
  };
}
