import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import OpenAI from "https://esm.sh/openai@4.26.0";

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
        
        // Use OpenAI to extract jobs from the URL (simulated via search/completion)
        // In a real scenario, we might fetch the HTML and pass it, or ask GPT to search for recent jobs from this site.
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a job crawler. Search for and extract recent job listings from ${source.url} (${source.name}) in ${source.country_code}. 
              Return a JSON array of objects with keys: title, company, location, description, url, is_remote (boolean).
              Limit to 5 most recent jobs.`
            },
            {
              role: 'user',
              content: `Find jobs at ${source.name}`
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        if (content) {
          const parsed = JSON.parse(content);
          const jobs = parsed.jobs || parsed.listings || []; // Handle potential root keys

          for (const job of jobs) {
            // Upsert job listing with actual schema
            const { error: insertError } = await supabaseClient.from('job_listings').insert({
              title: job.title || 'Untitled Position',
              description: job.description || '',
              category: job.category || 'General',
              job_type: job.job_type || job.type || 'full_time',
              location: job.location || source.country_code,
              pay_min: job.salary_min || job.pay_min,
              pay_max: job.salary_max || job.pay_max,
              pay_type: 'annual',
              currency: source.country_code === 'MT' ? 'EUR' : 'RWF',
              status: 'open',
              posted_by: source.name,
              country_code: source.country_code,
              created_at: new Date().toISOString(),
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
        
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a real estate crawler. Search for and extract recent property listings from ${source.url} (${source.source_name}) in ${source.country_code}.
              Return a JSON array of objects with keys: title, price, location, description, url, type (rent/sale), bedrooms (number).
              Limit to 5 most recent listings.`
            },
            {
              role: 'user',
              content: `Find properties at ${source.source_name}`
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        if (content) {
          const parsed = JSON.parse(content);
          const properties = parsed.properties || parsed.listings || [];

          for (const prop of properties) {
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
              source_url: prop.url || source.url,
              created_at: new Date().toISOString(),
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
