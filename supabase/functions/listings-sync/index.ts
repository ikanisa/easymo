import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { logStructuredEvent } from "../_shared/observability.ts";
import { googleSearch } from "shared/google_search.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

serve(async (req) => {
  try {
    // 1. Get active sources
    const { data: sources, error } = await supabase
      .from("listing_sources")
      .select("*")
      .eq("is_active", true);

    if (error) throw error;

    let stats = { jobs_added: 0, properties_added: 0, errors: 0 };

    for (const source of sources || []) {
      const config = source.config as { queries: string[], country: string };
      
      for (const query of config.queries) {
        await logStructuredEvent("LOG", { data: `Processing query: ${query} for ${source.type}` });
        
        // 2. Search
        const results = await googleSearch(query, 10); // Get top 10 results

        for (const result of results) {
          try {
            // 3. Check for duplicates
            const table = source.type === 'jobs' ? 'job_listings' : 'property_listings';
            const { data: existing } = await supabase
              .from(table)
              .select('id')
              .eq('external_id', result.link)
              .single();

            if (existing) {
              await logStructuredEvent("LOG", { data: `Skipping duplicate: ${result.link}` });
              continue;
            }

            // 4. Extract Data using Gemini
            const extractionPrompt = `
              Extract structured data from this search result snippet for a ${source.type} listing in ${config.country}.
              
              Title: ${result.title}
              Link: ${result.link}
              Snippet: ${result.snippet}
              
              Return ONLY valid JSON.
              
              For 'jobs':
              {
                "title": "Job Title",
                "company": "Company Name",
                "location": "City, Country",
                "description": "Short description",
                "salary_min": number or null,
                "salary_max": number or null,
                "job_type": "full_time" | "part_time" | "contract" | "gig",
                "requirements": ["req1", "req2"],
                "contact_info": {"email": "...", "phone": "..."}
              }

              For 'real_estate':
              {
                "title": "Property Title",
                "location": "City, Neighborhood",
                "price": number or null,
                "currency": "RWF" or "USD",
                "bedrooms": number or null,
                "bathrooms": number or null,
                "property_type": "apartment" | "house" | "land" | "commercial",
                "listing_type": "rent" | "sale",
                "description": "Short description",
                "amenities": ["wifi", "parking"],
                "owner_contact": "phone number"
              }
            `;

            const extractionResult = await model.generateContent(extractionPrompt);
            const text = extractionResult.response.text().replace(/```json|```/g, "").trim();
            const data = JSON.parse(text);

            // 5. Insert
            if (source.type === 'jobs') {
              await supabase.from('job_listings').insert({
                title: data.title || result.title,
                company: data.company,
                location: data.location,
                description: data.description || result.snippet,
                salary_min: data.salary_min,
                salary_max: data.salary_max,
                job_type: data.job_type || 'full_time',
                requirements: data.requirements,
                contact_info: data.contact_info,
                source_url: result.link,
                external_id: result.link,
                source_id: source.id,
                verified: false,
                last_scraped_at: new Date().toISOString()
              });
              stats.jobs_added++;
            } else {
              await supabase.from('property_listings').insert({
                title: data.title || result.title,
                location: data.location,
                price: data.price,
                currency: data.currency || 'RWF',
                bedrooms: data.bedrooms,
                bathrooms: data.bathrooms,
                property_type: data.property_type || 'house',
                listing_type: data.listing_type || 'rent',
                description: data.description || result.snippet,
                amenities: data.amenities,
                owner_phone: data.owner_contact,
                source_url: result.link,
                external_id: result.link,
                source_id: source.id,
                verified: false,
                last_scraped_at: new Date().toISOString()
              });
              stats.properties_added++;
            }

          } catch (e) {
            await logStructuredEvent("ERROR", { data: `Error processing result ${result.link}:`, e });
            stats.errors++;
          }
        }
      }
      
      // Update last run
      await supabase.from('listing_sources').update({ last_run_at: new Date().toISOString() }).eq('id', source.id);
    }

    return new Response(JSON.stringify(stats), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    await logStructuredEvent("ERROR", { data: "Sync error:", e });
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
