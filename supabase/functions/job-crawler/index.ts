import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import OpenAI from "https://esm.sh/openai@4.26.0";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    });

    // 1. Fetch Job Sources
    const { data: jobSources, error: jobError } = await supabaseClient
      .from('job_sources')
      .select('*')
      .eq('crawl_strategy', 'openai_web_search');

    if (jobError) throw jobError;

    // 2. Fetch Real Estate Sources
    const { data: propertySources, error: propError } = await supabaseClient
      .from('real_estate_sources')
      .select('*')
      .eq('crawl_strategy', 'openai_web_search');

    if (propError) throw propError;

    const results = {
      jobsProcessed: 0,
      propertiesProcessed: 0,
      errors: [] as string[],
    };

    // 3. Process Job Sources
    for (const source of jobSources || []) {
      try {
        console.log(`Crawling job source: ${source.name} (${source.url})`);
        
        // Fetch HTML content
        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch ${source.url}: ${response.status} ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // Parse HTML and extract text
        const doc = new DOMParser().parseFromString(html, "text/html");
        const textContent = doc?.body?.textContent || "";
        
        // Clean up text (remove excessive whitespace)
        const cleanText = textContent.replace(/\s+/g, ' ').trim().substring(0, 15000); // Limit to 15k chars for token limits
        
        if (!cleanText) {
          throw new Error("No text content extracted");
        }

        // Use OpenAI to extract jobs from the text
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a job extractor. Analyze the following web page text from ${source.name} (${source.url}) and extract the 5 most recent job listings.
              Return a JSON array of objects with keys: title, description (brief summary), category, type (full_time, part_time, contract, freelance), location, salary_min (number or null), salary_max (number or null), url (absolute URL if possible, or relative).
              If no specific jobs are found, return an empty array.`
            },
            {
              role: 'user',
              content: `Extract jobs from this text:\n\n${cleanText}`
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        if (content) {
          const parsed = JSON.parse(content);
          const jobs = parsed.jobs || parsed.listings || [];

          for (const job of jobs) {
            // Fix relative URLs
            let jobUrl = job.url;
            if (jobUrl && !jobUrl.startsWith('http')) {
              const baseUrl = new URL(source.url);
              jobUrl = new URL(jobUrl, baseUrl.origin).toString();
            }

            const { error: insertError } = await supabaseClient.from('job_listings').insert({
              title: job.title || 'Untitled Position',
              description: job.description || '',
              category: job.category || 'General',
              job_type: job.type || 'full_time',
              location: job.location || source.country_code,
              pay_min: job.salary_min,
              pay_max: job.salary_max,
              pay_type: 'annual',
              currency: source.country_code === 'MT' ? 'EUR' : 'RWF',
              status: 'open',
              posted_by: source.name,
              country_code: source.country_code,
              created_at: new Date().toISOString(),
              source_id: source.id,
              // Store original URL if we have a column for it, otherwise it might be lost or need a schema update
              // Based on previous check, we don't have original_url column, but we have source_id
            });
            
            if (!insertError) {
              results.jobsProcessed++;
            } else {
              console.error('Insert error:', insertError);
            }
          }
        }

      } catch (e) {
        console.error(`Error processing job source ${source.name}:`, e);
        results.errors.push(`Job Source ${source.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 4. Process Real Estate Sources
    for (const source of propertySources || []) {
      try {
        console.log(`Crawling property source: ${source.source_name} (${source.url})`);
        
        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch ${source.url}: ${response.status} ${response.statusText}`);
        }
        
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const textContent = doc?.body?.textContent || "";
        const cleanText = textContent.replace(/\s+/g, ' ').trim().substring(0, 15000);
        
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a real estate extractor. Analyze the following web page text from ${source.source_name} (${source.url}) and extract the 5 most recent property listings.
              Return a JSON array of objects with keys: title, description, type (rent/sale), property_type (apartment, house, villa, office, land), bedrooms (number), bathrooms (number), price (number), location (string), url.
              If no specific listings are found, return an empty array.`
            },
            {
              role: 'user',
              content: `Extract properties from this text:\n\n${cleanText}`
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        if (content) {
          const parsed = JSON.parse(content);
          const properties = parsed.properties || parsed.listings || [];

          for (const prop of properties) {
            let propUrl = prop.url;
            if (propUrl && !propUrl.startsWith('http')) {
              const baseUrl = new URL(source.url);
              propUrl = new URL(propUrl, baseUrl.origin).toString();
            }

            const { error: insertError } = await supabaseClient.from('property_listings').insert({
              title: prop.title || 'Property Listing',
              description: prop.description || '',
              type: prop.type || 'rent',
              property_type: prop.property_type || 'apartment',
              bedrooms: prop.bedrooms || 1,
              bathrooms: prop.bathrooms || 1,
              price: prop.price,
              currency: source.country_code === 'MT' ? 'EUR' : 'RWF',
              location: { address: prop.location || source.country_code },
              status: 'available',
              source_url: propUrl || source.url,
              created_at: new Date().toISOString(),
              source_id: source.id
            });
            
            if (!insertError) {
              results.propertiesProcessed++;
            } else {
              console.error('Insert error:', insertError);
            }
          }
        }

      } catch (e) {
        console.error(`Error processing property source ${source.source_name}:`, e);
        results.errors.push(`Property Source ${source.source_name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
